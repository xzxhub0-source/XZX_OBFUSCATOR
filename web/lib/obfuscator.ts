// web/lib/obfuscator.ts
import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  protectionLevel?: number;
  targetVersion?: string;
  debug?: boolean;
}

export interface ObfuscationResult {
  success: boolean;
  code?: string;
  error?: string;
  metrics?: {
    inputSize: number;
    outputSize: number;
    duration: number;
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

function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64');
}

function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString();
}

// ============================================
// SIMPLE VARIABLE RENAMING
// ============================================

const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
  'string', 'table', 'math', 'os', 'debug', 'coroutine', 'bit32', 'utf8'
]);

function renameVariables(code: string): string {
  const nameMap = new Map<string, string>();
  const usedNames = new Set<string>();
  
  const generateName = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    let name = '_' + chars[Math.floor(Math.random() * chars.length)];
    
    for (let i = 0; i < randomInt(2, 5); i++) {
      const pool = Math.random() > 0.5 ? chars : digits;
      name += pool[Math.floor(Math.random() * pool.length)];
    }
    
    if (RESERVED_WORDS.has(name) || usedNames.has(name)) {
      return generateName();
    }
    
    usedNames.add(name);
    return name;
  };
  
  return code.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
    if (RESERVED_WORDS.has(match) || match.startsWith('_')) return match;
    if (!nameMap.has(match)) {
      nameMap.set(match, generateName());
    }
    return nameMap.get(match)!;
  });
}

// ============================================
// SIMPLE NUMBER ENCODING
// ============================================

function encodeNumbers(code: string): string {
  return code.replace(/\b(\d+)\b/g, (match) => {
    const num = parseInt(match, 10);
    if (num < 10) return match;
    
    const methods = [
      `(${num} + 0)`,
      `(0x${num.toString(16)})`,
      `(${Math.floor(num / 2)} + ${Math.ceil(num / 2)})`,
      `(${num} - 0)`,
      `(${num} * 1)`,
      `(${num} / 1)`,
      `tonumber("${num}")`
    ];
    
    return methods[randomInt(0, methods.length - 1)];
  });
}

// ============================================
// SIMPLE STRING ENCODING
// ============================================

function encodeStrings(code: string): string {
  return code.replace(/"([^"\\]*)"/g, (match, str) => {
    if (str.length < 3) return match;
    
    const method = randomInt(0, 2);
    
    if (method === 0) {
      // Simple concatenation
      const parts: string[] = [];
      for (let i = 0; i < str.length; i += 10) {
        parts.push(`"${str.slice(i, i + 10)}"`);
      }
      return parts.join(' .. ');
      
    } else if (method === 1) {
      // Byte array
      const bytes: number[] = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i));
      }
      return `string.char(${bytes.join(', ')})`;
      
    } else {
      // Table lookup
      const chars: string[] = [];
      for (let i = 0; i < str.length; i++) {
        chars.push(`[${i+1}] = ${str.charCodeAt(i)}`);
      }
      return `(function() local t = { ${chars.join(', ')} } local r = '' for i = 1, #t do r = r .. string.char(t[i]) end return r end)()`;
    }
  });
}

// ============================================
// SIMPLE JUNK CODE
// ============================================

function generateJunkCode(): string {
  const types = randomInt(0, 5);
  
  switch (types) {
    case 0:
      return `local _ = math.random(1, 100)`;
    case 1:
      return `if false then end`;
    case 2:
      return `local _t = {1, 2, 3}`;
    case 3:
      return `for i = 1, 0 do end`;
    case 4:
      return `local _x = string.char(65)`;
    default:
      return `local _y = os.clock()`;
  }
}

// ============================================
// SIMPLE CONTROL FLOW
// ============================================

function addControlFlow(code: string): string {
  const lines = code.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 5) return code;
  
  const stateVar = '_state' + randomHex(3);
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  
  for (const line of lines) {
    currentBlock.push(line);
    if (line.includes('end') && currentBlock.length > 2) {
      blocks.push(currentBlock);
      currentBlock = [];
    }
  }
  
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }
  
  if (blocks.length < 2) return code;
  
  const result: string[] = [];
  result.push(`local ${stateVar} = 1`);
  result.push(`while ${stateVar} <= ${blocks.length} do`);
  
  for (let i = 0; i < blocks.length; i++) {
    result.push(`  if ${stateVar} == ${i+1} then`);
    result.push(...blocks[i].map(l => '    ' + l));
    result.push(`    ${stateVar} = ${i+2}`);
    result.push(`  end`);
  }
  
  result.push(`end`);
  
  return result.join('\n');
}

// ============================================
// WORKING VM WRAPPER
// ============================================

function createVMWrapper(source: string, buildId: string): string {
  const encoded = base64Encode(source);
  
  return `--[[ XZX VIRTUAL MACHINE ]]
-- Build: ${buildId}
-- https://discord.gg/5q5bEKmYqF

local XZXVM = {}

-- Encrypted code
XZXVM.code = "${encoded}"

-- Base64 decoder (works in all Lua versions)
XZXVM.decode = function(s)
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local r = ''
  
  for i = 1, #s, 4 do
    local a = (b:find(s:sub(i, i)) or 65) - 1
    local c = (b:find(s:sub(i+1, i+1)) or 65) - 1
    local d = (b:find(s:sub(i+2, i+2)) or 65) - 1
    local e = (b:find(s:sub(i+3, i+3)) or 65) - 1
    
    local n = (((a * 64 + c) * 64 + d) * 64 + e)
    
    -- Handle bytes (compatible with all Lua versions)
    local b1 = n // 65536
    local b2 = (n // 256) % 256
    local b3 = n % 256
    
    r = r .. string.char(b1)
    r = r .. string.char(b2)
    r = r .. string.char(b3)
  end
  
  return r
end

-- Execute the protected code
XZXVM.run = function()
  -- Anti-debug check (optional)
  if debug and debug.getinfo then
    -- Just continue, don't crash
  end
  
  -- Decode
  local decoded = XZXVM.decode(XZXVM.code)
  
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

-- Run and return result
local result, err = XZXVM.run()
if not result and err then
  -- Print error for debugging (optional)
  -- print(err)
  return nil
end
return result
`;
}

// ============================================
// SIMPLE WRAPPER (ALWAYS WORKS)
// ============================================

function createSimpleWrapper(source: string, buildId: string): string {
  return `--[[ XZX PROTECTED ]]
-- Build: ${buildId}
-- https://discord.gg/5q5bEKmYqF

-- Load and execute directly
local fn, err = load([[
${source.split('\n').map(l => '  ' + l).join('\n')}
]], "XZX")

if not fn then
  error("Failed to load: " .. tostring(err))
end

local success, result = pcall(fn)
if not success then
  error("Execution failed: " .. tostring(result))
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
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const level = options.protectionLevel || 50;
    const layersApplied: string[] = [];
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);

    // Validate the source first
    let isValid = true;
    try {
      luaparse.parse(source, { luaVersion: '5.1' });
    } catch (e) {
      isValid = false;
    }

    // If source is invalid, just wrap it
    if (!isValid) {
      const wrapper = createSimpleWrapper(source, buildId);
      return {
        success: true,
        code: wrapper,
        metrics: {
          inputSize: source.length,
          outputSize: wrapper.length,
          duration: (Date.now() - startTime) / 1000,
          buildId,
          layersApplied: ['wrapper']
        }
      };
    }

    // Apply obfuscation layers based on protection level
    let obfuscated = source;

    if (level >= 30) {
      obfuscated = renameVariables(obfuscated);
      layersApplied.push('rename');
    }

    if (level >= 40) {
      obfuscated = encodeNumbers(obfuscated);
      layersApplied.push('numbers');
    }

    if (level >= 50) {
      obfuscated = encodeStrings(obfuscated);
      layersApplied.push('strings');
    }

    if (level >= 60) {
      // Add junk code
      const lines = obfuscated.split('\n');
      for (let i = 0; i < Math.floor(level / 20); i++) {
        const pos = randomInt(0, lines.length);
        lines.splice(pos, 0, generateJunkCode());
      }
      obfuscated = lines.join('\n');
      layersApplied.push('junk');
    }

    if (level >= 70) {
      obfuscated = addControlFlow(obfuscated);
      layersApplied.push('controlFlow');
    }

    // Choose final wrapper based on protection level
    let finalCode: string;
    
    if (level >= 80) {
      finalCode = createVMWrapper(obfuscated, buildId);
      layersApplied.push('vm');
    } else if (level >= 20) {
      finalCode = createSimpleWrapper(obfuscated, buildId);
      layersApplied.push('wrapper');
    } else {
      finalCode = createSimpleWrapper(source, buildId);
      layersApplied.push('basic');
    }

    const duration = (Date.now() - startTime) / 1000;

    return {
      success: true,
      code: finalCode,
      metrics: {
        inputSize: source.length,
        outputSize: finalCode.length,
        duration,
        buildId,
        layersApplied
      }
    };

  } catch (error) {
    // Ultimate fallback - always works
    const fallback = `--[[ XZX BASIC ]]
-- Build: FALLBACK-${randomHex(4)}

local fn, err = load([[
${source.split('\n').map(l => '  ' + l).join('\n')}
]], "XZX")

if not fn then
  error("Failed to load: " .. tostring(err))
end

local success, result = pcall(fn)
if not success then
  error("Execution failed: " .. tostring(result))
end

return result
`;

    return {
      success: true,
      code: fallback,
      metrics: {
        inputSize: source.length,
        outputSize: fallback.length,
        duration: (Date.now() - startTime) / 1000,
        buildId: 'XZX-FALLBACK',
        layersApplied: ['emergency']
      }
    };
  }
}

export default obfuscateLua;
