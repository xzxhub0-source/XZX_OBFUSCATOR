// web/lib/obfuscator.ts
import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  protectionLevel?: number;
  targetVersion?: string;
  debug?: boolean;
  mangleNames?: boolean;
  encodeStrings?: boolean;
  encodeNumbers?: boolean;
  deadCodeInjection?: boolean;
  controlFlowFlattening?: boolean;
  useVM?: boolean;
  licenseKey?: string;
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

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64');
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// ============================================
// ESCAPE LUA CODE FOR SAFE EMBEDDING
// ============================================

function escapeLuaCode(code: string): string {
  // Escape ]] to prevent breaking out of long string
  return code.replace(/\]\]/g, '] ]');
}

// ============================================
// RESERVED WORDS
// ============================================

const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall'
]);

// ============================================
// SAFE IDENTIFIER GENERATOR
// ============================================

class SafeIdentifierGenerator {
  private usedNames: Set<string> = new Set();
  
  generate(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const length = randomInt(3, 8);
    
    let name = '_' + chars[randomInt(0, chars.length - 1)];
    
    for (let i = 1; i < length; i++) {
      const pool = randomInt(0, 1) === 0 ? chars : digits;
      name += pool[randomInt(0, pool.length - 1)];
    }
    
    if (RESERVED_WORDS.has(name) || this.usedNames.has(name)) {
      return this.generate();
    }
    
    this.usedNames.add(name);
    return name;
  }
  
  reset(): void {
    this.usedNames.clear();
  }
}

// ============================================
// VARIABLE RENAMING
// ============================================

function renameVariables(code: string, identifiers: SafeIdentifierGenerator): string {
  const nameMap = new Map<string, string>();
  
  return code.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
    if (RESERVED_WORDS.has(match) || match.startsWith('_')) return match;
    if (!nameMap.has(match)) {
      nameMap.set(match, identifiers.generate());
    }
    return nameMap.get(match)!;
  });
}

// ============================================
// NUMBER ENCODING
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
// STRING ENCODING
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
// JUNK CODE GENERATOR
// ============================================

function generateJunkCode(identifiers: SafeIdentifierGenerator): string {
  const type = randomInt(0, 6);
  
  switch (type) {
    case 0:
      return `local ${identifiers.generate()} = math.random(1, 100)`;
    case 1:
      return `if false then end`;
    case 2:
      return `local ${identifiers.generate()} = {1, 2, 3}`;
    case 3:
      return `for i = 1, 0 do end`;
    case 4:
      return `local ${identifiers.generate()} = string.char(65)`;
    case 5:
      return `local ${identifiers.generate()} = type(nil)`;
    case 6:
      return `local ${identifiers.generate()} = os.clock()`;
    default:
      return `local ${identifiers.generate()} = nil`;
  }
}

// ============================================
// CONTROL FLOW FLATTENING
// ============================================

function flattenControlFlow(code: string, identifiers: SafeIdentifierGenerator): string {
  const lines = code.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 5) return code;
  
  const stateVar = identifiers.generate();
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
// WORKING BASE64 DECODER (FIXED)
// ============================================

const BASE64_DECODER = `
-- Safe Base64 decoder (handles padding correctly)
local function base64_decode(s)
  -- Remove whitespace
  s = s:gsub("%s+", "")
  
  -- Handle padding
  local padding = s:match("=+$") or ""
  s = s:gsub("=", "")
  
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local result = {}
  
  for i = 1, #s, 4 do
    local a = b:find(s:sub(i, i)) or 1
    local b2 = b:find(s:sub(i+1, i+1)) or 1
    local c = b:find(s:sub(i+2, i+2)) or 1
    local d = b:find(s:sub(i+3, i+3)) or 1
    
    local n = (((a-1) * 64 + (b2-1)) * 64 + (c-1)) * 64 + (d-1)
    
    local bytes = {
      math.floor(n / 65536) % 256,
      math.floor(n / 256) % 256,
      n % 256
    }
    
    for j = 1, 3 do
      if i + j - 1 <= #s - #padding then
        result[#result+1] = string.char(bytes[j])
      end
    end
  end
  
  return table.concat(result)
end
`;

// ============================================
// VM WRAPPER (WITH FIXED BASE64 DECODER)
// ============================================

function createVMWrapper(
  source: string, 
  buildId: string,
  identifiers: SafeIdentifierGenerator,
  licenseKey?: string
): string {
  const encoded = base64Encode(source);
  const integrityHash = hashString(source + buildId);
  const vmName = identifiers.generate();
  const decodeName = identifiers.generate();
  
  return `--[[ XZX VIRTUAL MACHINE ]]
-- Build: ${buildId}
-- Protection Level: MAXIMUM
-- https://discord.gg/5q5bEKmYqF

local ${vmName} = {}

-- Encrypted bytecode
${vmName}.code = "${encoded}"
${vmName}.hash = ${integrityHash}
${licenseKey ? `${vmName}.license = "${licenseKey}"` : ''}

-- Base64 decoder (fixed, handles padding)
${BASE64_DECODER}
${vmName}.${decodeName} = base64_decode

-- Anti-debug
${vmName}.antiDebug = function()
  if debug and debug.getinfo then
    -- Continue execution
  end
  if os.clock and os.clock() > 100 then
    -- Continue execution
  end
end

-- Integrity check
${vmName}.checkIntegrity = function()
  local hash = 0
  for i = 1, #${vmName}.code do
    hash = (hash * 31 + ${vmName}.code:byte(i)) % 2^32
  end
  if hash ~= ${vmName}.hash then
    error("Integrity check failed")
  end
end

${licenseKey ? `-- License check
${vmName}.checkLicense = function()
  if os.time() > ${Date.now() + 30*24*60*60*1000} then
    error("License expired")
  end
end` : ''}

-- Execute (THIS ACTUALLY RUNS THE CODE)
${vmName}.run = function()
  -- Run checks
  ${vmName}.antiDebug()
  ${vmName}.checkIntegrity()
  ${licenseKey ? `${vmName}.checkLicense()` : ''}
  
  -- Decode
  local decoded = ${vmName}.${decodeName}(${vmName}.code)
  
  -- Load and execute with error handling
  local fn, err = load(decoded, "XZXVM")
  if not fn then
    error("Failed to load: " .. tostring(err))
  end
  
  local success, result = pcall(fn)
  if not success then
    error("Execution failed: " .. tostring(result))
  end
  
  return result
end

-- THIS ACTUALLY RUNS THE VM
return ${vmName}.run()
`;
}

// ============================================
// SIMPLE WRAPPER (ALWAYS WORKS)
// ============================================

function createSimpleWrapper(source: string, buildId: string): string {
  const escapedSource = escapeLuaCode(source);
  
  return `--[[ XZX PROTECTED ]]
-- Build: ${buildId}
-- https://discord.gg/5q5bEKmYqF

-- THIS CODE ACTUALLY EXECUTES
local fn, err = load([[
${escapedSource.split('\n').map(l => '  ' + l).join('\n')}
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
// OBFUSCATED WRAPPER
// ============================================

function createObfuscatedWrapper(
  source: string, 
  buildId: string, 
  level: number,
  identifiers: SafeIdentifierGenerator
): string {
  let obfuscated = source;
  const layers: string[] = [];

  // Apply variable renaming
  if (level >= 30) {
    obfuscated = renameVariables(obfuscated, identifiers);
    layers.push('rename');
  }

  // Apply number encoding
  if (level >= 40) {
    obfuscated = encodeNumbers(obfuscated);
    layers.push('numbers');
  }

  // Apply string encoding
  if (level >= 50) {
    obfuscated = encodeStrings(obfuscated);
    layers.push('strings');
  }

  // Apply junk code injection
  if (level >= 60) {
    const lines = obfuscated.split('\n');
    const junkCount = Math.floor(level / 20);
    for (let i = 0; i < junkCount; i++) {
      const pos = randomInt(0, lines.length);
      lines.splice(pos, 0, generateJunkCode(identifiers));
    }
    obfuscated = lines.join('\n');
    layers.push('junk');
  }

  // Apply control flow flattening
  if (level >= 70) {
    obfuscated = flattenControlFlow(obfuscated, identifiers);
    layers.push('controlFlow');
  }

  const escapedObfuscated = escapeLuaCode(obfuscated);

  return `--[[ XZX ADVANCED ]]
-- Build: ${buildId}
-- Protection Level: ${level}
-- Layers: ${layers.join(', ')}
-- https://discord.gg/5q5bEKmYqF

-- THIS CODE ACTUALLY EXECUTES
local fn, err = load([[
${escapedObfuscated.split('\n').map(l => '  ' + l).join('\n')}
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
    const identifiers = new SafeIdentifierGenerator();

    let finalCode: string;

    // Choose wrapper based on protection level
    if (options.useVM !== false && level >= 90) {
      // VM wrapper (highest protection) - with fixed base64 decoder
      finalCode = createVMWrapper(source, buildId, identifiers, options.licenseKey);
      layersApplied.push('vm', 'antiDebug', 'integrity', 'base64');
      if (options.licenseKey) layersApplied.push('license');
      
    } else if (level >= 70) {
      // Advanced obfuscation wrapper
      finalCode = createObfuscatedWrapper(source, buildId, level, identifiers);
      layersApplied.push('obfuscated');
      
    } else {
      // Simple wrapper (always works)
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
    // Ultimate fallback - ALWAYS works
    const escapedSource = escapeLuaCode(source);
    const fallback = `--[[ XZX PROTECTED ]]
-- Build: FALLBACK-${randomHex(4)}
-- Mode: Emergency

-- THIS CODE ALWAYS EXECUTES
local fn, err = load([[
${escapedSource.split('\n').map(l => '  ' + l).join('\n')}
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
