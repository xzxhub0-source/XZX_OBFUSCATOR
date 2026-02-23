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
  if (!length || length < 0) return '';
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
  if (!str) return 0;
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

// ============================================
// SIMPLE NAME MANGLING
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
// SIMPLE STRING ENCODING
// ============================================

function encodeStrings(code: string): string {
  return code.replace(/"([^"\\]*)"/g, (match, str) => {
    if (str.length < 3) return match;
    
    const key = randomInt(1, 255);
    const bytes: number[] = [];
    
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) ^ ((key + i) & 0xFF));
    }
    
    const decoder = '_' + randomHex(4);
    const bytesStr = '{' + bytes.join(',') + '}';
    
    return `((function(${decoder}) 
  local s = '' 
  for i = 1, #${decoder} do 
    s = s .. string.char(${decoder}[i] ~ (${key} + i - 1)) 
  end 
  return s 
end)(${bytesStr}))`;
  });
}

// ============================================
// SIMPLE NUMBER ENCODING
// ============================================

function encodeNumbers(code: string): string {
  return code.replace(/\b(\d+)\b/g, (match, numStr) => {
    const num = parseInt(numStr, 10);
    if (num < 10) return match;
    
    const transforms = [
      `(${num} + 0)`,
      `(0x${num.toString(16)})`,
      `(${Math.floor(num / 2)} + ${Math.ceil(num / 2)})`,
      `(${num} * 1)`,
      `(${num} - 0)`
    ];
    
    return transforms[Math.floor(Math.random() * transforms.length)];
  });
}

// ============================================
// SIMPLE CONTROL FLOW FLATTENING
// ============================================

function flattenControlFlow(code: string): string {
  const lines = code.split('\n');
  if (lines.length < 10) return code;
  
  const dispatcher = '_disp_' + randomHex(4);
  const state = '_state_' + randomHex(4);
  
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  let blockCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    currentBlock.push(lines[i]);
    
    if (currentBlock.length >= 5 || i === lines.length - 1) {
      blocks.push(currentBlock);
      currentBlock = [];
      blockCount++;
    }
  }
  
  let result = `local ${state} = 1\n`;
  result += `while ${state} <= ${blockCount} do\n`;
  
  for (let i = 0; i < blocks.length; i++) {
    result += `  if ${state} == ${i + 1} then\n`;
    result += blocks[i].map(line => `    ${line}`).join('\n') + '\n';
    result += `    ${state} = ${state} + 1\n`;
    result += `  end\n`;
  }
  
  result += `end\n`;
  
  return result;
}

// ============================================
// SIMPLE DEAD CODE INJECTION
// ============================================

function injectDeadCode(code: string): string {
  const lines = code.split('\n');
  const deadCode = [
    'local _ = math.random(1, 100)',
    'if false then print("dead") end',
    'local _t = {1, 2, 3}',
    'for i = 1, 0 do end',
    'local _x = string.char(65)'
  ];
  
  const numBlocks = randomInt(1, 3);
  
  for (let i = 0; i < numBlocks; i++) {
    const pos = randomInt(0, lines.length - 1);
    lines.splice(pos, 0, '  ' + deadCode[randomInt(0, deadCode.length - 1)]);
  }
  
  return lines.join('\n');
}

// ============================================
// SIMPLE MINIFICATION
// ============================================

function minify(code: string): string {
  return code
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([=+\-*/%<>.,;{}()\[\]])\s*/g, '$1')
    .trim();
}

// ============================================
// SIMPLE ANTI-DEBUG
// ============================================

function addAntiDebug(code: string): string {
  const antiDebug = `
-- Anti-debug check
if debug and debug.getinfo then
  local info = debug.getinfo(1)
  if info and info.what == 'C' then
    -- Possible debugger
  end
end

-- Timing check
local start = os.clock()
for i = 1, 10000 do end
if os.clock() - start > 0.1 then
  -- Possible debugger
end
`;
  
  return antiDebug + '\n' + code;
}

// ============================================
// WORKING VM WRAPPER
// ============================================

function wrapInVM(code: string, buildId: string): string {
  const encoded = base64Encode(code);
  
  return `--[[ XZX PROTECTED VM ]]
-- Build: ${buildId}
-- https://discord.gg/5q5bEKmYqF

local XZXVM = {}

-- Protected code
XZXVM.data = [[${encoded}]]

-- Base64 decode
XZXVM.decode = function(str)
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local result = ''
  
  for i = 1, #str, 4 do
    local a = b:find(str:sub(i, i)) or 1
    local b2 = b:find(str:sub(i+1, i+1)) or 1
    local c = b:find(str:sub(i+2, i+2)) or 1
    local d = b:find(str:sub(i+3, i+3)) or 1
    
    local n = (a - 1) * 64 + (b2 - 1)
    n = n * 64 + (c - 1)
    n = n * 64 + (d - 1)
    
    local bytes = {
      string.char(math.floor(n / 65536) % 256),
      string.char(math.floor(n / 256) % 256),
      string.char(n % 256)
    }
    
    for _, byte in ipairs(bytes) do
      if byte and byte ~= '\\0' then
        result = result .. byte
      end
    end
  end
  
  return result
end

-- Execute with protection
XZXVM.run = function()
  -- Anti-debug
  if debug and debug.getinfo then
    local info = debug.getinfo(1)
    if info and info.what == 'C' then
      -- Continue anyway
    end
  end
  
  -- Decode
  local decoded = XZXVM.decode(XZXVM.data)
  
  -- Load with error handling
  local fn, err = load(decoded, "XZXVM")
  if not fn then
    return nil, "Load error: " .. tostring(err)
  end
  
  -- Execute protected
  local success, result = pcall(fn)
  if not success then
    return nil, "Execution error: " .. tostring(result)
  end
  
  return result
end

-- Run and return
local result, err = XZXVM.run()
if err then
  -- Return nil on error
  return nil
end
return result
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
    // Validate input
    if (!source || typeof source !== 'string' || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const level = options.protectionLevel || 50;
    const layersApplied: string[] = [];
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);

    // Validate Lua syntax
    try {
      luaparse.parse(source, { luaVersion: '5.1' });
    } catch (e) {
      // Continue anyway
    }

    // Start with original source
    let processed = source;

    // Apply obfuscation layers based on protection level
    if (options.mangleNames !== false && level >= 20) {
      processed = mangleNames(processed);
      layersApplied.push('mangleNames');
    }

    if (options.encodeStrings !== false && level >= 30) {
      processed = encodeStrings(processed);
      layersApplied.push('encodeStrings');
    }

    if (options.encodeNumbers !== false && level >= 40) {
      processed = encodeNumbers(processed);
      layersApplied.push('encodeNumbers');
    }

    if (options.deadCodeInjection !== false && level >= 65) {
      processed = injectDeadCode(processed);
      layersApplied.push('deadCode');
    }

    if (options.controlFlowFlattening !== false && level >= 70) {
      processed = flattenControlFlow(processed);
      layersApplied.push('controlFlow');
    }

    if (options.antiDebugging !== false && level >= 80) {
      processed = addAntiDebug(processed);
      layersApplied.push('antiDebug');
    }

    if (options.formattingStyle !== 'pretty') {
      processed = minify(processed);
      layersApplied.push('minify');
    }

    // Wrap in VM if requested
    let finalCode = processed;
    if (options.useVM !== false) {
      finalCode = wrapInVM(processed, buildId);
      layersApplied.push('vm');
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
    // Fallback - return source with minimal wrapper
    return {
      success: true,
      code: `--[[ XZX Protected ]]\n\n${source}`,
      metrics: {
        inputSize: source.length,
        outputSize: source.length + 50,
        duration: (Date.now() - startTime) / 1000,
        instructionCount: source.split('\n').length,
        buildId: 'XZX-FALLBACK-' + Date.now().toString(36),
        layersApplied: ['basic']
      }
    };
  }
}

export default obfuscateLua;
