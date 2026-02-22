// web/lib/obfuscator-simple.ts
// A simplified, type-safe obfuscator for Lua code

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

// Utility functions
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Reserved words that shouldn't be mangled
const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
  'string', 'table', 'math', 'os', 'debug', 'coroutine', 'bit32', 'utf8'
]);

// Safe name mangling
function mangleNames(code: string): string {
  const nameMap = new Map<string, string>();
  
  return code.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match: string) => {
    if (RESERVED_WORDS.has(match) || match.startsWith('_')) return match;
    if (!nameMap.has(match)) {
      nameMap.set(match, '_' + randomHex(6));
    }
    return nameMap.get(match)!;
  });
}

// Safe string encoding
function encodeStrings(code: string): string {
  return code.replace(/"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g, (match: string, str: string) => {
    if (!str || str.length < 3) return match;
    
    const key = Math.floor(Math.random() * 255) + 1;
    const bytes: number[] = [];
    
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) ^ ((key + i) & 0xff));
    }
    
    const decoderName = '_' + randomHex(4);
    const bytesStr = '{' + bytes.join(',') + '}';
    
    return `((function(${decoderName}) local s='';for i=1,#${decoderName} do s=s..string.char(${decoderName}[i]~(${key}+i-1));end;return s;end)(${bytesStr}))`;
  });
}

// Safe number encoding
function encodeNumbers(code: string): string {
  return code.replace(/\b(\d+)\b/g, (match: string, numStr: string) => {
    const num = parseInt(numStr, 10);
    if (num < 10) return match;
    
    const transformations = [
      `(${num} + 0)`,
      `(0x${num.toString(16)})`,
      `(${Math.floor(num / 2)} + ${Math.ceil(num / 2)})`,
      `(${num} * 1)`,
      `(${num} - 0)`,
    ];
    
    return transformations[Math.floor(Math.random() * transformations.length)];
  });
}

// Safe dead code injection
function injectDeadCode(code: string): string {
  const lines = code.split('\n');
  const deadCodeTemplates = [
    'local _ = math.random(1,100)',
    'if false then print("dead") end',
    'local _t = {1,2,3}',
    'for i=1,0 do end',
    'local _x = string.char(65)',
  ];
  
  const numBlocks = Math.floor(Math.random() * 3) + 1;
  
  for (let i = 0; i < numBlocks; i++) {
    const pos = Math.floor(Math.random() * lines.length);
    const template = deadCodeTemplates[Math.floor(Math.random() * deadCodeTemplates.length)];
    lines.splice(pos, 0, '  ' + template);
  }
  
  return lines.join('\n');
}

// Safe minification
function minify(code: string): string {
  let result = code
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([=+\-*/%<>.,;{}()\[\]])\s*/g, '$1')
    .trim();
  
  return result;
}

// Main obfuscation function
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
    let obfuscated = source;
    const layersApplied: string[] = [];

    // Apply transformations based on protection level
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

    // Always minify unless explicitly disabled
    if (options.formattingStyle !== 'pretty') {
      obfuscated = minify(obfuscated);
      layersApplied.push('minify');
    }

    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);
    const duration = (Date.now() - startTime) / 1000;

    return {
      success: true,
      code: obfuscated,
      metrics: {
        inputSize: source.length,
        outputSize: obfuscated.length,
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

export default obfuscateLua;
