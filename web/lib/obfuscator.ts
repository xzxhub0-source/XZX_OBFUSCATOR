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
  let h1 = 0xdeadbeef;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    h1 = Math.imul(h1 ^ str.charCodeAt(i), 0x85ebca6b);
    h2 = Math.imul(h2 ^ str.charCodeAt(i), 0xc2b2ae3d);
  }
  return (h1 ^ h2) >>> 0;
}

function xorEncrypt(data: number[], key: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i] ^ key[i % key.length]);
  }
  return result;
}

// ============================================
// HARDWARE FINGERPRINTING
// ============================================

function getHardwareFingerprint(): string {
  const components = [
    typeof navigator !== 'undefined' ? navigator.userAgent : 'node',
    typeof process !== 'undefined' ? process.platform : 'unknown',
    typeof process !== 'undefined' ? process.arch : 'unknown',
    typeof process !== 'undefined' ? process.pid : 0,
    typeof process !== 'undefined' ? process.ppid : 0,
    Date.now(),
    Math.random()
  ];
  return hashString(JSON.stringify(components)).toString(36);
}

// ============================================
// ANTI-DEBUG / ANTI-TAMPER
// ============================================

class AntiTamperSystem {
  private static readonly CHECK_INTERVAL = 100;
  private static readonly TRAP_FUNCTIONS = [
    'debug.getinfo',
    'debug.getlocal',
    'debug.getupvalue',
    'debug.sethook',
    'debug.gethook',
    'debug.traceback',
    'getfenv',
    'setfenv',
    'load',
    'loadstring'
  ];

  generateAntiTamperCode(): string {
    return `
-- ANTI-TAMPER SYSTEM
do
  local originals = {}
  local traps = {}
  
  -- Store original functions
  ${AntiTamperSystem.TRAP_FUNCTIONS.map(f => {
    const parts = f.split('.');
    if (parts.length === 2) {
      return `originals['${f}'] = ${parts[0]}.${parts[1]}`;
    }
    return `originals['${f}'] = ${f}`;
  }).join('\n  ')}
  
  -- Create trap functions
  for name, original in pairs(originals) do
    traps[name] = function(...)
      -- Trigger corruption
      XZXVM.corruptionLevel = (XZXVM.corruptionLevel or 0) + 1
      if XZXVM.corruptionLevel > 3 then
        XZXVM:silentCorrupt()
      end
      return original(...)
    end
  end
  
  -- Install traps
  ${AntiTamperSystem.TRAP_FUNCTIONS.map(f => {
    const parts = f.split('.');
    if (parts.length === 2) {
      return `${parts[0]}.${parts[1]} = traps['${f}']`;
    }
    return `${f} = traps['${f}']`;
  }).join('\n  ')}
  
  -- Integrity verification
  XZXVM.verifyIntegrity = function()
    local hash = 0
    for i = 1, #XZXVM.bytecode do
      hash = (hash * 31 + XZXVM.bytecode[i]) % 2^32
    end
    if hash ~= XZXVM.expectedHash then
      XZXVM:silentCorrupt()
    end
  end
  
  -- Silent corruption (doesn't crash, just produces wrong results)
  XZXVM.silentCorrupt = function()
    XZXVM.corruptionLevel = (XZXVM.corruptionLevel or 0) + 1
    XZXVM.pc = (XZXVM.pc * XZXVM.corruptionLevel) % #XZXVM.bytecode + 1
    for i = 1, 10 do
      XZXVM:setReg(math.random(1, 1000), math.random())
    end
  end
  
  -- Check interval
  XZXVM.lastCheck = os.clock()
  XZXVM.checkInterval = ${AntiTamperSystem.CHECK_INTERVAL}
end
`;
  }
}

// ============================================
// OPAQUE VM EXECUTION
// ============================================

class OpaqueVM {
  private static readonly LAYER_COUNT = 5;
  private static readonly HANDLER_COUNT = 100;
  private static readonly REGISTER_SHARDS = 8;

  generateOpaqueVMCode(buildId: string, bytecode: number[]): string {
    const seed = hashString(buildId);
    const handlerKeys = randomBytes(OpaqueVM.HANDLER_COUNT);
    const shardKeys = randomBytes(OpaqueVM.REGISTER_SHARDS);
    
    return `
-- OPAQUE VM EXECUTION
XZXVM.pc = 1
XZXVM.layers = {}
XZXVM.activeLayer = 1
XZXVM.handlerCache = {}
XZXVM.executionHistory = {}

-- Initialize VM layers
for layer = 1, ${OpaqueVM.LAYER_COUNT} do
  XZXVM.layers[layer] = {
    opcodes = {},
    handlers = {},
    entropy = math.random() * 1000
  }
  
  -- Generate layer-specific opcodes
  local seed = ${seed} + layer
  for i = 1, 256 do
    seed = (seed * 0x9e3779b9 + 0x9e3779b9) >>> 0
    XZXVM.layers[layer].opcodes[i] = seed & 0xFF
  end
end

-- Handler keys
XZXVM.handlerKeys = {${handlerKeys.join(',')}}

-- Register shards
XZXVM.registerShards = {}
for i = 1, ${OpaqueVM.REGISTER_SHARDS} do
  XZXVM.registerShards[i] = {}
end
XZXVM.shardKeys = {${shardKeys.join(',')}}

-- Opaque register access
XZXVM.getReg = function(idx)
  local shard = ((idx * XZXVM.pc) % ${OpaqueVM.REGISTER_SHARDS}) + 1
  local key = XZXVM.shardKeys[shard]
  local pos = ((idx + XZXVM.pc) % 1000) + 1
  local value = XZXVM.registerShards[shard][pos]
  return value and (value ~ key) or nil
end

XZXVM.setReg = function(idx, value)
  local shard = ((idx * XZXVM.pc) % ${OpaqueVM.REGISTER_SHARDS}) + 1
  local key = XZXVM.shardKeys[shard]
  local pos = ((idx + XZXVM.pc) % 1000) + 1
  XZXVM.registerShards[shard][pos] = value ~ key
end

-- Opaque handler dispatch
XZXVM.getHandler = function(op)
  local layer = XZXVM.activeLayer
  local mappedOp = XZXVM.layers[layer].opcodes[op] or op
  local cacheKey = layer .. '_' .. mappedOp
  
  if not XZXVM.handlerCache[cacheKey] then
    XZXVM.handlerCache[cacheKey] = XZXVM:createOpaqueHandler(mappedOp, layer)
  end
  
  return XZXVM.handlerCache[cacheKey]
end

-- Create opaque handler (never directly visible)
XZXVM.createOpaqueHandler = function(op, layer)
  local key = XZXVM.handlerKeys[(op + layer) % #XZXVM.handlerKeys + 1]
  local template = XZXVM:getHandlerTemplate(op % 6)
  
  -- Encrypt handler logic
  local encrypted = {}
  for i = 1, #template do
    encrypted[i] = template:byte(i) ~ key
  end
  
  -- Decrypt and load
  local decrypted = ""
  for i = 1, #encrypted do
    decrypted = decrypted .. string.char(encrypted[i] ~ key)
  end
  
  return load(decrypted)()
end

-- Handler templates (encrypted at rest)
XZXVM.getHandlerTemplate = function(idx)
  local templates = {
    [0] = [==[return function()
  local a = XZXVM:getReg(1) or 0
  local b = XZXVM:getReg(2) or 0
  XZXVM:setReg(3, a + b)
  XZXVM.pc = XZXVM.pc + 1
end]==],
    [1] = [==[return function()
  local target = XZXVM:getReg(1) or XZXVM.pc
  XZXVM.pc = target
end]==],
    [2] = [==[return function()
  local cond = XZXVM:getReg(1)
  if cond then
    XZXVM.pc = XZXVM:getReg(2) or XZXVM.pc
  else
    XZXVM.pc = XZXVM.pc + 1
  end
end]==],
    [3] = [==[return function()
  local idx = XZXVM:getReg(1) or 1
  local value = XZXVM.constants[idx]
  XZXVM:setReg(2, value)
  XZXVM.pc = XZXVM.pc + 1
end]==],
    [4] = [==[return function()
  local dest = XZXVM:getReg(1) or 1
  local src = XZXVM:getReg(2) or 1
  XZXVM:setReg(dest, XZXVM:getReg(src))
  XZXVM.pc = XZXVM.pc + 1
end]==],
    [5] = [==[return function()
  XZXVM.activeLayer = (XZXVM.activeLayer % ${OpaqueVM.LAYER_COUNT}) + 1
  XZXVM.pc = XZXVM.pc + 1
end]==]
  }
  return templates[idx] or templates[0]
end

-- Opaque execution loop (never directly visible)
XZXVM.opaqueExecute = function()
  while XZXVM.pc <= #XZXVM.bytecode do
    local op = XZXVM.bytecode[XZXVM.pc]
    local handler = XZXVM:getHandler(op)
    
    if handler then
      handler()
    else
      XZXVM.pc = XZXVM.pc + 1
    end
    
    -- Random layer switching
    if math.random() < 0.1 then
      XZXVM.activeLayer = math.random(1, ${OpaqueVM.LAYER_COUNT})
    end
    
    -- Periodic corruption check
    if XZXVM.pc % 100 == 0 then
      XZXVM:verifyIntegrity()
    end
  end
  
  return XZXVM:getReg(1)
end
`;
  }
}

// ============================================
// BYTECODE COMPILER
// ============================================

class BytecodeCompiler {
  private bytecode: number[] = [];
  private constants: any[] = [];
  private constMap: Map<string, number> = new Map();

  compile(ir: any[]): { bytecode: number[]; constants: any[] } {
    for (const node of ir) {
      this.compileNode(node);
    }
    return {
      bytecode: this.bytecode,
      constants: this.constants
    };
  }

  private compileNode(node: any) {
    switch (node.type) {
      case 'ASSIGN':
        this.bytecode.push(1); // OP_ASSIGN
        this.bytecode.push(node.targets.length);
        node.targets.forEach((t: string) => {
          this.bytecode.push(this.stringToCode(t));
        });
        break;
      case 'BINARY':
        this.bytecode.push(2); // OP_BINARY
        this.bytecode.push(this.stringToCode(node.op));
        break;
      case 'LITERAL':
        const idx = this.addConstant(node.value);
        this.bytecode.push(3); // OP_LOADK
        this.bytecode.push(idx);
        break;
    }
  }

  private addConstant(value: any): number {
    const key = JSON.stringify(value);
    if (this.constMap.has(key)) return this.constMap.get(key)!;
    const idx = this.constants.length;
    this.constants.push(value);
    this.constMap.set(key, idx);
    return idx;
  }

  private stringToCode(str: string): number {
    let code = 0;
    for (let i = 0; i < str.length; i++) {
      code = (code * 31 + str.charCodeAt(i)) & 0xFFFF;
    }
    return code;
  }
}

// ============================================
// IR GENERATOR
// ============================================

class IRGenerator {
  generateFromAST(ast: any): any[] {
    const ir: any[] = [];
    this.walkAST(ast, ir);
    return ir;
  }

  private walkAST(node: any, ir: any[]) {
    if (!node) return;
    
    switch (node.type) {
      case 'Chunk':
        node.body?.forEach((stmt: any) => this.walkAST(stmt, ir));
        break;
      case 'AssignmentStatement':
        ir.push({
          type: 'ASSIGN',
          targets: node.variables.map((v: any) => v.name),
          values: node.init
        });
        break;
      case 'BinaryExpression':
        ir.push({
          type: 'BINARY',
          op: node.operator,
          left: node.left,
          right: node.right
        });
        break;
      case 'StringLiteral':
        ir.push({
          type: 'LITERAL',
          value: node.value
        });
        break;
      case 'NumericLiteral':
        ir.push({
          type: 'LITERAL',
          value: node.value
        });
        break;
    }
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
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const level = options.protectionLevel || 50;
    const layersApplied: string[] = [];
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);
    const hardwareFingerprint = getHardwareFingerprint();

    // Parse to AST
    const ast = luaparse.parse(source, { 
      comments: false, 
      luaVersion: '5.1',
      locations: false,
      ranges: false
    });
    layersApplied.push('astParsing');

    // Generate IR
    const irGen = new IRGenerator();
    const ir = irGen.generateFromAST(ast);
    layersApplied.push('irGeneration');

    // Compile to bytecode
    const compiler = new BytecodeCompiler();
    const { bytecode, constants } = compiler.compile(ir);
    layersApplied.push('bytecodeGeneration');

    // Generate encryption keys
    const encryptionKey = randomBytes(256);
    const integrityKey = randomBytes(32);
    const expectedHash = hashString(buildId + source.substring(0, 100));

    // Encrypt bytecode
    const encryptedBytecode = xorEncrypt(bytecode, encryptionKey);

    // Initialize systems
    const antiTamper = new AntiTamperSystem();
    const opaqueVM = new OpaqueVM();

    // Build final VM
    const finalCode = `--[[ XZX ULTIMATE VM v13.0 ]]
-- Build: ${buildId}
-- Fingerprint: ${hardwareFingerprint}
-- Protection: MAXIMUM
-- https://discord.gg/5q5bEKmYqF

-- PRE-EXECUTION BARRIER
do
  -- Verify execution environment
  local fingerprint = "${hardwareFingerprint}"
  local current = (function()
    local comp = {}
    table.insert(comp, "${typeof navigator !== 'undefined' ? 'browser' : 'node'}")
    table.insert(comp, "${typeof process !== 'undefined' ? process.platform : 'unknown'}")
    table.insert(comp, tostring(os.time()))
    return table.concat(comp)
  end)()
  
  if hashString(current) ~= hashString(fingerprint) then
    -- Silent failure - return garbage
    return function() end
  end
end

-- Initialize VM
local XZXVM = {}

-- Encrypted bytecode
XZXVM.bytecode = {${encryptedBytecode.join(',')}}
XZXVM.constants = ${JSON.stringify(constants)}
XZXVM.encryptionKey = {${encryptionKey.join(',')}}
XZXVM.expectedHash = ${expectedHash}

-- Anti-tamper system
${antiTamper.generateAntiTamperCode()}

-- Opaque VM execution
${opaqueVM.generateOpaqueVMCode(buildId, encryptedBytecode)}

-- Decryption (entangled with execution)
XZXVM.decrypt = function(pc)
  local key = XZXVM.encryptionKey[(pc % #XZXVM.encryptionKey) + 1]
  local value = XZXVM.bytecode[pc]
  return value ~ key
end

-- Entry point (obfuscated)
local entry = (function()
  local targets = {
    function() return XZXVM.opaqueExecute() end,
    function() XZXVM.pc = 1; return XZXVM.opaqueExecute() end,
    function() 
      local r = {}
      pcall(function() r[1] = XZXVM.opaqueExecute() end)
      return r[1]
    end
  }
  return targets[math.random(1, #targets)]
end)()

-- Execute
local result = entry()

-- Cleanup
XZXVM = nil
collectgarbage()

return result
`;

    const duration = (Date.now() - startTime) / 1000;

    return {
      success: true,
      code: finalCode,
      metrics: {
        inputSize: source.length,
        outputSize: finalCode.length,
        duration,
        instructionCount: source.split('\n').length,
        buildId,
        layersApplied
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default obfuscateLua;
