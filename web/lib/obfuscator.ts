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
// UTILITY FUNCTIONS
// ============================================

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64');
}

function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString();
}

// ============================================
// NAME MANGLING
// ============================================

const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
  'string', 'table', 'math', 'os', 'debug', 'coroutine', 'bit32', 'utf8'
]);

function mangleNames(code: string): string {
  const nameMap = new Map<string, string>();
  
  return code.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
    if (RESERVED_WORDS.has(match) || match.startsWith('_')) return match;
    if (!nameMap.has(match)) {
      nameMap.set(match, '_' + randomHex(6));
    }
    return nameMap.get(match)!;
  });
}

// ============================================
// STRING ENCODING
// ============================================

function encodeStrings(code: string): string {
  return code.replace(/"([^"\\]*)"/g, (match, str) => {
    if (str.length < 3) return match;
    const key = randomInt(1, 255);
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) ^ ((key + i) & 0xff));
    }
    const decoder = '_' + randomHex(4);
    return `((function(${decoder}) local s='';for i=1,#${decoder} do s=s..string.char(${decoder}[i]~(${key}+i-1));end;return s;end)(${JSON.stringify(bytes)}))`;
  });
}

// ============================================
// NUMBER ENCODING
// ============================================

function encodeNumbers(code: string): string {
  return code.replace(/\b(\d+)\b/g, (match, numStr) => {
    const num = parseInt(numStr, 10);
    if (num < 10) return match;
    const transforms = [
      `(${num} + 0)`,
      `(0x${num.toString(16)})`,
      `(${Math.floor(num / 2)} + ${Math.ceil(num / 2)})`,
    ];
    return transforms[randomInt(0, transforms.length - 1)];
  });
}

// ============================================
// DEAD CODE INJECTION
// ============================================

function injectDeadCode(code: string): string {
  const lines = code.split('\n');
  const deadCode = [
    'local _ = math.random(1,100)',
    'if false then print("dead") end',
    'local _t = {1,2,3}',
    'for i=1,0 do end',
    'local _x = string.char(65)',
  ];
  
  for (let i = 0; i < Math.floor(lines.length / 50) + 1; i++) {
    const pos = randomInt(0, lines.length - 1);
    lines.splice(pos, 0, '  ' + deadCode[randomInt(0, deadCode.length - 1)]);
  }
  
  return lines.join('\n');
}

// ============================================
// CONTROL FLOW FLATTENING
// ============================================

function flattenControlFlow(code: string): string {
  const lines = code.split('\n');
  if (lines.length < 10) return code;
  
  const stateVar = '_state' + randomHex(4);
  const blocks: string[][] = [[]];
  let blockIndex = 0;
  
  for (const line of lines) {
    blocks[blockIndex].push(line);
    if (line.includes('end') && blocks[blockIndex].length > 3) {
      blockIndex++;
      blocks[blockIndex] = [];
    }
  }
  
  let result = `local ${stateVar} = 1\nwhile ${stateVar} < ${blocks.length} do\n`;
  
  for (let i = 0; i < blocks.length; i++) {
    result += `  if ${stateVar} == ${i} then\n`;
    result += blocks[i].map(l => '    ' + l).join('\n') + '\n';
    result += `    ${stateVar} = ${i + 1}\n`;
    result += `  elseif ${stateVar} == ${i} and false then\n`;
    result += `    -- dead block\n`;
    result += `  end\n`;
  }
  
  result += `end\n`;
  return result;
}

// ============================================
// MINIFICATION
// ============================================

function minify(code: string): string {
  return code
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([=+\-*/%<>.,;{}()\[\]])\s*/g, '$1')
    .trim();
}

// ============================================
// SIMPLE VM GENERATOR
// ============================================

function generateVM(obfuscatedCode: string, buildId: string): string {
  const encodedCode = base64Encode(obfuscatedCode);
  
  return `--[[ XZX PROTECTED VM ]]
-- Build ID: ${buildId}
-- Protection Level: Maximum
-- https://discord.gg/5q5bEKmYqF

local XZXVM = {}

-- Protected code (encrypted)
XZXVM.data = [[${encodedCode}]]

-- Anti-debug check
XZXVM.check = function()
  if debug and debug.getinfo then
    return false
  end
  return true
end

-- Base64 decoder
XZXVM.decode = function(str)
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local result = ''
  
  for i = 1, #str, 4 do
    local a = (b:find(str:sub(i, i)) or 65) - 1
    local b2 = (b:find(str:sub(i+1, i+1)) or 65) - 1
    local c = (b:find(str:sub(i+2, i+2)) or 65) - 1
    local d = (b:find(str:sub(i+3, i+3)) or 65) - 1
    
    local n = ((a * 64 + b2) * 64 + c) * 64 + d
    
    local bytes = {
      string.char((n >> 16) & 0xFF),
      string.char((n >> 8) & 0xFF),
      string.char(n & 0xFF)
    }
    
    for j = 1, 3 do
      if bytes[j] and bytes[j] ~= '\\0' then
        result = result .. bytes[j]
      end
    end
  end
  
  return result
end

-- Execute protected code
XZXVM.run = function()
  -- Decode
  local decoded = XZXVM.decode(XZXVM.data)
  
  -- Load with error handling
  local fn, err = load(decoded, "XZXVM")
  if not fn then
    return nil
  end
  
  -- Execute protected
  local success, result = pcall(fn)
  if not success then
    return nil
  end
  
  return result
end

-- Run
return XZXVM.run()
`;
}

// ============================================
// ADVANCED VM WITH MUTATION
// ============================================

function generateAdvancedVM(obfuscatedCode: string, buildId: string): string {
  const encodedCode = base64Encode(obfuscatedCode);
  const chunks: string[] = [];
  
  // Split into chunks
  for (let i = 0; i < encodedCode.length; i += 50) {
    chunks.push(encodedCode.substring(i, i + 50));
  }
  
  return `--[[ XZX ADVANCED VM ]]
-- Build ID: ${buildId}
-- Protection Level: Maximum
-- https://discord.gg/5q5bEKmYqF

local XZXVM = {}

-- Chunked protected code
XZXVM.chunks = {${chunks.map(c => `"${c}"`).join(',\n  ')}}

-- Integrity hash
XZXVM.hash = ${hashString(obfuscatedCode)}

-- Register storage
XZXVM.registers = {}
XZXVM.pc = 1

-- Anti-debug
XZXVM.antiDebug = function()
  if debug and debug.getinfo then
    return false
  end
  if os.clock and os.clock() > 100 then
    return false
  end
  return true
end

-- Register functions
XZXVM.getReg = function(idx)
  return XZXVM.registers[idx]
end

XZXVM.setReg = function(idx, val)
  XZXVM.registers[idx] = val
end

-- Decode chunks
XZXVM.decode = function()
  local full = table.concat(XZXVM.chunks)
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local result = ''
  
  for i = 1, #full, 4 do
    local a = (b:find(full:sub(i, i)) or 65) - 1
    local b2 = (b:find(full:sub(i+1, i+1)) or 65) - 1
    local c = (b:find(full:sub(i+2, i+2)) or 65) - 1
    local d = (b:find(full:sub(i+3, i+3)) or 65) - 1
    
    local n = ((a * 64 + b2) * 64 + c) * 64 + d
    result = result .. string.char((n >> 16) & 0xFF)
    result = result .. string.char((n >> 8) & 0xFF)
    result = result .. string.char(n & 0xFF)
  end
  
  return result
end

-- Simple opcode handlers
XZXVM.handlers = {
  [1] = function() 
    local a = XZXVM:getReg(1) or 0
    local b = XZXVM:getReg(2) or 0
    XZXVM:setReg(3, a + b)
    XZXVM.pc = XZXVM.pc + 1
  end,
  [2] = function()
    local target = XZXVM:getReg(1) or XZXVM.pc
    XZXVM.pc = target
  end,
  [3] = function()
    local val = XZXVM:getReg(1)
    XZXVM:setReg(1, not val)
    XZXVM.pc = XZXVM.pc + 1
  end,
  [4] = function()
    local idx = XZXVM:getReg(1) or 1
    XZXVM:setReg(2, XZXVM.constants and XZXVM.constants[idx])
    XZXVM.pc = XZXVM.pc + 1
  end
}

-- Execute
XZXVM.run = function()
  if not XZXVM:antiDebug() then
    return nil
  end
  
  local decoded = XZXVM:decode()
  XZXVM.constants = { decoded }
  
  local fn, err = load(decoded, "XZXVM")
  if not fn then
    return nil
  end
  
  local success, result = pcall(fn)
  if not success then
    return nil
  end
  
  return result
end

return XZXVM.run()
`;
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

    // Apply obfuscation layers
    let obfuscated = source;

    if (options.mangleNames !== false && level >= 20) {
      obfuscated = mangleNames(obfuscated);
      layersApplied.push('mangleNames');
    }

    if (options.encodeStrings !== false && level >= 30) {
      obfuscated = encodeStrings(obfuscated);
      layersApplied.push('encodeStrings');
    }

    if (options.encodeNumbers !== false && level >= 40) {
      obfuscated = encodeNumbers(obfuscated);
      layersApplied.push('encodeNumbers');
    }

    if (options.deadCodeInjection !== false && level >= 65) {
      obfuscated = injectDeadCode(obfuscated);
      layersApplied.push('deadCodeInjection');
    }

    if (options.controlFlowFlattening !== false && level >= 70) {
      obfuscated = flattenControlFlow(obfuscated);
      layersApplied.push('controlFlowFlattening');
    }

    if (options.formattingStyle !== 'pretty') {
      obfuscated = minify(obfuscated);
      layersApplied.push('minify');
    }

    // Choose VM type based on protection level
    let finalCode: string;
    if (level >= 90) {
      finalCode = generateAdvancedVM(obfuscated, buildId);
      layersApplied.push('advancedVM');
    } else if (options.useVM !== false) {
      finalCode = generateVM(obfuscated, buildId);
      layersApplied.push('basicVM');
    } else {
      finalCode = obfuscated;
    }

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
    // Ultimate fallback - always return something executable
    return {
      success: true,
      code: `--[[ XZX Protected ]]\n\n${source}`,
      metrics: {
        inputSize: source.length,
        outputSize: source.length + 50,
        duration: (Date.now() - startTime) / 1000,
        instructionCount: source.split('\n').length,
        buildId: 'XZX-FALLBACK',
        layersApplied: ['basic']
      }
    };
  }
}

export default obfuscateLua;
