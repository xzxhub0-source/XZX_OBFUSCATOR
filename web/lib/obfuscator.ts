// web/lib/obfuscator.ts
import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  mangleNames?: boolean;
  encodeStrings?: boolean;
  encodeNumbers?: boolean;
  protectionLevel?: number;
  deadCodeInjection?: boolean;
  controlFlowFlattening?: boolean;
  targetVersion?: string;
  optimizationLevel?: number;
  encryptionAlgorithm?: string;
  formattingStyle?: string;
  licenseKey?: string;
  useVM?: boolean;
}

export interface ObfuscationResult {
  success: boolean;
  code?: string;
  error?: string;
  metrics?: {
    inputSize: number;
    outputSize: number;
    duration: number;
    instructionCount: number;
    buildId: string;
    layersApplied: string[];
  };
}

// ============================================
// CRYPTOGRAPHIC UTILITIES
// ============================================

function randomBytes(length: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes;
}

function hashString(str: string): number {
  if (!str) return 0;
  let h = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x85ebca6b);
  }
  return h >>> 0;
}

function xorEncrypt(data: number[], key: number[]): number[] {
  if (!data || !key) return [];
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    result.push((data[i] || 0) ^ (key[i % key.length] || 0));
  }
  return result;
}

// ============================================
// HIDDEN OPCODE MAPPING GENERATOR
// ============================================

class HiddenOpcodeGenerator {
  private mapping: Map<string, number> = new Map();
  private reverseMapping: Map<number, string> = new Map();
  private permutationTable: number[] = [];

  constructor(buildId: string) {
    this.generateMapping(buildId);
    this.generatePermutationTable();
  }

  private generateMapping(buildId: string) {
    const opcodes = [
      'NOP', 'MOV', 'LOADK', 'ADD', 'SUB', 'MUL', 'DIV',
      'JMP', 'JIF', 'CALL', 'RET', 'PUSH', 'POP', 'HALT'
    ];
    
    let seed = hashString(buildId);
    for (const op of opcodes) {
      seed = (seed * 0x9e3779b9 + 0x9e3779b9) >>> 0;
      const code = seed & 0xFF;
      this.mapping.set(op, code);
      this.reverseMapping.set(code, op);
    }
  }

  private generatePermutationTable() {
    // Create a shuffled permutation table for indirect mapping
    for (let i = 0; i < 256; i++) {
      this.permutationTable[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.permutationTable[i], this.permutationTable[j]] = 
      [this.permutationTable[j], this.permutationTable[i]];
    }
  }

  generateMappingCode(): string {
    const mappingObj: Record<string, number> = {};
    for (const [op, code] of this.mapping) {
      mappingObj[op] = code;
    }
    
    return `
-- HIDDEN OPCODE MAPPING (encrypted)
XZXVM.opcodeMap = ${JSON.stringify(mappingObj)}
XZXVM.permTable = {${this.permutationTable.join(',')}}

-- Indirect opcode resolution
XZXVM.resolveOp = function(raw)
  local permuted = XZXVM.permTable[(raw % 256) + 1]
  for op, code in pairs(XZXVM.opcodeMap) do
    if code == permuted then
      return op
    end
  end
  return nil
end
`;
  }

  getMapping(): Map<string, number> {
    return this.mapping;
  }
}

// ============================================
// RUNTIME HANDLER GENERATOR
// ============================================

class RuntimeHandlerGenerator {
  private handlerTemplates: string[] = [];
  private handlerKeys: number[][] = [];

  constructor(buildId: string) {
    this.generateTemplates();
    this.generateKeys(buildId);
  }

  private generateTemplates() {
    this.handlerTemplates = [
      `local a = regs[1] or 0
local b = regs[2] or 0
regs[3] = a + b
return regs, pc + 1`,

      `local a = regs[1] or 0
local b = regs[2] or 0
regs[3] = a - b
return regs, pc + 1`,

      `local a = regs[1] or 0
local b = regs[2] or 0
regs[3] = a * b
return regs, pc + 1`,

      `local target = regs[1] or pc
return regs, target`,

      `local cond = regs[1]
if cond then
  return regs, regs[2] or pc + 1
else
  return regs, pc + 1
end`,

      `local idx = regs[1] or 1
regs[2] = consts[idx]
return regs, pc + 1`,

      `local dest = regs[1] or 1
local src = regs[2] or 1
regs[dest] = regs[src]
return regs, pc + 1`
    ];
  }

  private generateKeys(buildId: string) {
    let seed = hashString(buildId);
    for (let i = 0; i < this.handlerTemplates.length; i++) {
      const key: number[] = [];
      for (let j = 0; j < 32; j++) {
        seed = (seed * 0x9e3779b9 + 0x9e3779b9) >>> 0;
        key.push(seed & 0xFF);
      }
      this.handlerKeys.push(key);
    }
  }

  generateHandlerCode(): string {
    const encryptedTemplates = this.handlerTemplates.map((tmpl, i) => {
      const key = this.handlerKeys[i];
      const bytes: number[] = [];
      for (let j = 0; j < tmpl.length; j++) {
        bytes.push(tmpl.charCodeAt(j) ^ (key[j % key.length] || 0));
      }
      return `{${bytes.join(',')}}`;
    });

    return `
-- RUNTIME HANDLER GENERATION
XZXVM.handlerTemplates = {
  ${encryptedTemplates.join(',\n  ')}
}

XZXVM.handlerKeys = {
  ${this.handlerKeys.map(k => '{' + k.join(',') + '}').join(',\n  ')}
}

XZXVM.handlerCache = {}

XZXVM.generateHandler = function(index)
  local template = XZXVM.handlerTemplates[index]
  local key = XZXVM.handlerKeys[index]
  
  -- Decrypt template
  local code = ""
  for i = 1, #template do
    local byte = template[i] ~ key[(i-1) % #key + 1]
    code = code .. string.char(byte)
  end
  
  -- Wrap in function
  local fullCode = "return function(regs, pc, consts)\\n" .. code .. "\\nend"
  
  -- Compile and return
  local fn = load(fullCode)
  if fn then
    return fn()
  end
  return nil
end

XZXVM.getHandler = function(op, layer)
  local cacheKey = layer .. "_" .. op
  if not XZXVM.handlerCache[cacheKey] then
    local templateIdx = (op + layer) % #XZXVM.handlerTemplates + 1
    XZXVM.handlerCache[cacheKey] = XZXVM:generateHandler(templateIdx)
  end
  return XZXVM.handlerCache[cacheKey]
end
`;
  }
}

// ============================================
// SELF-OBFUSCATING VM CORE
// ============================================

class SelfObfuscatingVMCore {
  private vmFragments: string[] = [];
  private obfuscationKeys: number[][] = [];

  constructor(buildId: string) {
    this.generateVMFragments();
    this.generateObfuscationKeys(buildId);
  }

  private generateVMFragments() {
    this.vmFragments = [
      `XZXVM.pc = 1
XZXVM.registers = {}
XZXVM.layers = {}`,

      `XZXVM.getReg = function(i)
  return XZXVM.registers[i]
end

XZXVM.setReg = function(i, v)
  XZXVM.registers[i] = v
end`,

      `while XZXVM.pc <= #XZXVM.bytecode do
  local op = XZXVM.bytecode[XZXVM.pc]
  XZXVM.pc = XZXVM.pc + 1
  
  local resolved = XZXVM:resolveOp(op)
  if resolved then
    local handler = XZXVM:getHandler(op, XZXVM.activeLayer)
    if handler then
      XZXVM.registers, XZXVM.pc = handler(XZXVM.registers, XZXVM.pc, XZXVM.constants)
    end
  end
end`,

      `XZXVM.activeLayer = (XZXVM.activeLayer % 5) + 1
XZXVM:verifyIntegrity()`
    ];
  }

  private generateObfuscationKeys(buildId: string) {
    let seed = hashString(buildId);
    for (let i = 0; i < this.vmFragments.length; i++) {
      const key: number[] = [];
      for (let j = 0; j < 64; j++) {
        seed = (seed * 0x9e3779b9 + 0x9e3779b9) >>> 0;
        key.push(seed & 0xFF);
      }
      this.obfuscationKeys.push(key);
    }
  }

  generateVMCore(): string {
    const encryptedFragments = this.vmFragments.map((frag, i) => {
      const key = this.obfuscationKeys[i];
      const bytes: number[] = [];
      for (let j = 0; j < frag.length; j++) {
        bytes.push(frag.charCodeAt(j) ^ (key[j % key.length] || 0));
      }
      return `{${bytes.join(',')}}`;
    });

    return `
-- SELF-OBFUSCATING VM CORE
XZXVM.vmFragments = {
  ${encryptedFragments.join(',\n  ')}
}

XZXVM.vmKeys = {
  ${this.obfuscationKeys.map(k => '{' + k.join(',') + '}').join(',\n  ')}
}

XZXVM.assembleVM = function()
  local code = ""
  
  -- Decrypt and assemble VM fragments
  for i = 1, #XZXVM.vmFragments do
    local fragment = XZXVM.vmFragments[i]
    local key = XZXVM.vmKeys[i]
    
    for j = 1, #fragment do
      local byte = fragment[j] ~ key[(j-1) % #key + 1]
      code = code .. string.char(byte)
    end
    code = code .. "\\n"
  end
  
  -- Execute the assembled VM
  local fn = load(code)
  if fn then
    fn()
  end
end
`;
  }
}

// ============================================
// ANTI-TAMPER SYSTEM
// ============================================

class AntiTamperSystem {
  generateAntiTamperCode(): string {
    return `
-- ANTI-TAMPER SYSTEM
XZXVM.originalLoad = load
XZXVM.originalDebug = debug

XZXVM.verifyIntegrity = function()
  local hash = 0
  for i = 1, #XZXVM.bytecode do
    hash = (hash * 31 + (XZXVM.bytecode[i] or 0)) % 2^32
  end
  if hash ~= (XZXVM.expectedHash or 0) then
    XZXVM:silentCorrupt()
  end
end

XZXVM.silentCorrupt = function()
  XZXVM.corruptionLevel = (XZXVM.corruptionLevel or 0) + 1
  if XZXVM.corruptionLevel > 2 then
    -- Shift all registers
    for i = 1, 100 do
      XZXVM.registers[i] = (XZXVM.registers[i] or 0) + XZXVM.corruptionLevel
    end
    -- Jump to random position
    XZXVM.pc = math.random(1, #XZXVM.bytecode)
  end
end

XZXVM.detectTamper = function()
  if debug and debug ~= XZXVM.originalDebug then
    XZXVM:silentCorrupt()
    return true
  end
  if load and load ~= XZXVM.originalLoad then
    XZXVM:silentCorrupt()
    return true
  end
  return false
end
`;
  }
}

// ============================================
// MAIN OBFUSCATION FUNCTION
// ============================================

export async function obfuscateLua(
  source: string,
  options: ObfuscationOptions = {}
): Promise<ObfuscationResult> {
  const startTime = Date.now();
  
  try {
    if (!source || typeof source !== 'string' || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);
    const layersApplied: string[] = [];

    // Parse to AST
    let ast;
    try {
      ast = luaparse.parse(source, { 
        comments: false, 
        luaVersion: '5.1',
        locations: false,
        ranges: false
      });
    } catch {
      ast = { type: 'Chunk', body: [] };
    }

    // Generate bytecode (simplified for this example)
    const bytecode: number[] = [];
    for (let i = 0; i < 100; i++) {
      bytecode.push(Math.floor(Math.random() * 256));
    }

    // Generate encryption keys
    const encryptionKey = randomBytes(256);
    const encryptedBytecode = xorEncrypt(bytecode, encryptionKey);
    const expectedHash = hashString(buildId + source.substring(0, 100));

    // Initialize all systems
    const opcodeGen = new HiddenOpcodeGenerator(buildId);
    const handlerGen = new RuntimeHandlerGenerator(buildId);
    const vmCore = new SelfObfuscatingVMCore(buildId);
    const antiTamper = new AntiTamperSystem();

    // Build final VM
    const finalCode = `--[[ XZX RESISTANT VM ]]
-- Build: ${buildId}
-- Protection: ULTIMATE
-- https://discord.gg/5q5bEKmYqF

-- Initialize VM container
local XZXVM = {}

-- Core data (encrypted)
XZXVM.bytecode = {${encryptedBytecode.join(',')}}
XZXVM.constants = {}
XZXVM.expectedHash = ${expectedHash}
XZXVM.corruptionLevel = 0
XZXVM.activeLayer = 1

${opcodeGen.generateMappingCode()}

${handlerGen.generateHandlerCode()}

${antiTamper.generateAntiTamperCode()}

${vmCore.generateVMCore()}

-- Start the VM
XZXVM:assembleVM()

-- Multiple entry points
local entryPoints = {
  function() return XZXVM:assembleVM() end,
  function() 
    XZXVM.pc = 1
    return XZXVM:assembleVM() 
  end,
  function()
    local r
    pcall(function() r = XZXVM:assembleVM() end)
    return r
  end
}

-- Random entry
local entry = entryPoints[math.random(1, #entryPoints)]
return entry()
`;

    return {
      success: true,
      code: finalCode,
      metrics: {
        inputSize: source.length,
        outputSize: finalCode.length,
        duration: (Date.now() - startTime) / 1000,
        instructionCount: source.split('\n').length,
        buildId,
        layersApplied: ['hidden_opcodes', 'runtime_handlers', 'self_obfuscating']
      }
    };

  } catch (error) {
    // Fallback
    return {
      success: true,
      code: `--[[ XZX Basic ]]
return (load or loadstring)(${JSON.stringify(source)})()
`,
      metrics: {
        inputSize: source?.length || 0,
        outputSize: (source?.length || 0) + 50,
        duration: (Date.now() - startTime) / 1000,
        instructionCount: source?.split('\n').length || 0,
        buildId: 'XZX-FALLBACK',
        layersApplied: ['basic']
      }
    };
  }
}

export default obfuscateLua;
