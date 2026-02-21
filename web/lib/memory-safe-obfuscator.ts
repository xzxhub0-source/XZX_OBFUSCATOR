// lib/memory-safe-obfuscator.ts
// Memory-efficient obfuscator for large Lua files

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

// ---------- Utility Functions ----------

/**
 * Generate a random string of specified length
 */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate a random hex string
 */
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Calculate simple hash of a string
 */
function simpleHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x1000193) >>> 0;
  }
  return hash;
}

/**
 * Split string into chunks (memory efficient)
 */
function splitIntoChunks(str: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Process large string in chunks to avoid memory issues
 */
function processInChunks(
  input: string,
  chunkSize: number,
  processor: (chunk: string) => string
): string {
  const chunks = splitIntoChunks(input, chunkSize);
  const results: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    results.push(processor(chunks[i]));
    // Clear reference to allow garbage collection
    chunks[i] = null as any;
  }
  
  return results.join('');
}

// ---------- Reserved Words ----------
const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
  'string', 'table', 'math', 'os', 'debug', 'coroutine', 'bit32', 'utf8',
  'rawget', 'rawset', 'rawlen', 'rawequal', 'next', 'pairs', 'ipairs',
  'select', 'unpack', 'tonumber', 'tostring', 'type', 'typeof',
  'collectgarbage', 'gcinfo', 'newproxy'
]);

// ---------- Memory-Safe Name Mangling ----------
function mangleNamesSafe(code: string): string {
  const nameMap = new Map<string, string>();
  const chunkSize = 1024 * 1024; // 1MB chunks
  
  return processInChunks(code, chunkSize, (chunk) => {
    return chunk.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match: string) => {
      if (RESERVED_WORDS.has(match) || match.startsWith('_')) return match;
      if (!nameMap.has(match)) {
        nameMap.set(match, '_' + randomHex(6));
      }
      return nameMap.get(match)!;
    });
  });
}

// ---------- Memory-Safe String Encoding ----------
function encodeStringsSafe(code: string): string {
  const chunkSize = 512 * 1024; // 512KB chunks
  
  return processInChunks(code, chunkSize, (chunk) => {
    return chunk.replace(/"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g, (match: string, str: string) => {
      if (!str) return match;
      
      // Skip very short strings
      if (str.length < 3) return match;
      
      const key = Math.floor(Math.random() * 255) + 1;
      const bytes: number[] = [];
      
      // Convert string to bytes with XOR encryption
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) ^ ((key + i) & 0xff));
      }
      
      // Generate decoder function
      const decoderName = '_' + randomHex(4);
      const bytesStr = '{' + bytes.join(',') + '}';
      
      return `((function(${decoderName}) local s='';for i=1,#${decoderName} do s=s..string.char(${decoderName}[i]~(${key}+i-1));end;return s;end)(${bytesStr}))`;
    });
  });
}

// ---------- Memory-Safe Number Encoding ----------
function encodeNumbersSafe(code: string): string {
  const chunkSize = 1024 * 1024; // 1MB chunks
  
  return processInChunks(code, chunkSize, (chunk) => {
    return chunk.replace(/\b(\d+)\b/g, (match: string, numStr: string) => {
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
  });
}

// ---------- Memory-Safe Dead Code Injection ----------
function injectDeadCodeSafe(code: string): string {
  const lines = code.split('\n');
  const deadCodeTemplates = [
    'local _ = math.random(1,100)',
    'if false then print("dead") end',
    'local _t = {1,2,3}',
    'for i=1,0 do end',
    'local _x = string.char(65)',
    'local _y = type(nil)',
  ];
  
  // Inject 1-3 dead code blocks
  const numBlocks = Math.floor(Math.random() * 3) + 1;
  
  for (let i = 0; i < numBlocks; i++) {
    const pos = Math.floor(Math.random() * lines.length);
    const template = deadCodeTemplates[Math.floor(Math.random() * deadCodeTemplates.length)];
    lines.splice(pos, 0, '  ' + template);
  }
  
  return lines.join('\n');
}

// ---------- Memory-Safe Minification ----------
function minifySafe(code: string): string {
  const chunkSize = 1024 * 1024; // 1MB chunks
  
  return processInChunks(code, chunkSize, (chunk) => {
    return chunk
      .replace(/--\[\[.*?\]\]--/gs, '')
      .replace(/--.*$/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([=+\-*/%<>.,;{}()\[\]])\s*/g, '$1')
      .trim();
  });
}

// ---------- Memory-Safe Control Flow Flattening (Simplified) ----------
function flattenControlFlowSafe(code: string): string {
  // For very large files, this is a simplified version
  // that adds some control flow obfuscation without heavy parsing
  
  const lines = code.split('\n');
  if (lines.length < 20) return code;
  
  // Add a simple dispatcher pattern
  const dispatcherName = '_' + randomHex(4);
  const blockCount = Math.min(5, Math.floor(lines.length / 10));
  
  let result = `local ${dispatcherName} = 1\n`;
  result += `while ${dispatcherName} < ${blockCount + 1} do\n`;
  result += `  if ${dispatcherName} == 1 then\n`;
  
  // First block of code
  for (let i = 0; i < lines.length / blockCount; i++) {
    if (lines[i]) result += `    ${lines[i]}\n`;
  }
  
  result += `    ${dispatcherName} = 2\n`;
  result += `  elseif ${dispatcherName} == 2 then\n`;
  
  // Second block of code
  for (let i = Math.floor(lines.length / blockCount); i < (2 * lines.length / blockCount); i++) {
    if (lines[i]) result += `    ${lines[i]}\n`;
  }
  
  result += `    ${dispatcherName} = 3\n`;
  result += `  elseif ${dispatcherName} == 3 then\n`;
  
  // Third block of code
  for (let i = Math.floor(2 * lines.length / blockCount); i < (3 * lines.length / blockCount); i++) {
    if (lines[i]) result += `    ${lines[i]}\n`;
  }
  
  result += `    ${dispatcherName} = 4\n`;
  result += `  else\n`;
  result += `    break\n`;
  result += `  end\n`;
  result += `end\n`;
  
  // Add remaining lines
  for (let i = Math.floor(3 * lines.length / blockCount); i < lines.length; i++) {
    if (lines[i]) result += lines[i] + '\n';
  }
  
  return result;
}

// ---------- Memory-Safe AST Parsing (for smaller files) ----------
function parseWithMemoryLimit(source: string): any {
  // Check file size - for very large files, skip AST parsing
  if (source.length > 10 * 1024 * 1024) { // > 10MB
    throw new Error('File too large for AST parsing, using safe mode');
  }
  
  try {
    return luaparse.parse(source, {
      comments: false,
      luaVersion: '5.1',
      locations: false,
      ranges: false,
      scope: false,
      wait: false
    });
  } catch (error) {
    throw new Error(`Failed to parse Lua: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ---------- Main Memory-Safe Obfuscator ----------
export async function obfuscateLuaMemorySafe(
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

    // Apply memory-safe transformations based on file size
    const isLargeFile = source.length > 1024 * 1024; // > 1MB

    if (options.mangleNames !== false && level >= 20) {
      obfuscated = mangleNamesSafe(obfuscated);
      layersApplied.push('mangleNames');
    }

    if (options.encodeStrings !== false && level >= 30) {
      obfuscated = encodeStringsSafe(obfuscated);
      layersApplied.push('encodeStrings');
    }

    if (options.encodeNumbers !== false && level >= 40) {
      obfuscated = encodeNumbersSafe(obfuscated);
      layersApplied.push('encodeNumbers');
    }

    if (options.deadCodeInjection !== false && level >= 65 && !isLargeFile) {
      obfuscated = injectDeadCodeSafe(obfuscated);
      layersApplied.push('deadCodeInjection');
    }

    if (options.controlFlowFlattening !== false && level >= 70 && !isLargeFile) {
      obfuscated = flattenControlFlowSafe(obfuscated);
      layersApplied.push('controlFlowFlattening');
    }

    // Always minify unless explicitly disabled
    if (options.formattingStyle !== 'pretty') {
      obfuscated = minifySafe(obfuscated);
      layersApplied.push('minify');
    }

    // Generate build ID
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

// ---------- Batch Processing for Multiple Files ----------
export async function obfuscateBatchMemorySafe(
  files: { name: string; content: string }[],
  options: ObfuscationOptions = {}
): Promise<{
  results: { name: string; result: ObfuscationResult }[];
  totalTime: number;
}> {
  const startTime = Date.now();
  const results: { name: string; result: ObfuscationResult }[] = [];

  // Process files sequentially to avoid memory spikes
  for (const file of files) {
    try {
      const result = await obfuscateLuaMemorySafe(file.content, options);
      results.push({ name: file.name, result });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      results.push({
        name: file.name,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  return {
    results,
    totalTime: (Date.now() - startTime) / 1000
  };
}

// ---------- Streaming Obfuscation for Very Large Files ----------
export async function obfuscateStreaming(
  inputStream: NodeJS.ReadableStream,
  options: ObfuscationOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    let result = '';
    const chunks: Buffer[] = [];
    
    inputStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      
      // Process incrementally if needed
      if (chunks.length > 10) {
        const partial = Buffer.concat(chunks).toString();
        // Could do partial processing here for very large files
      }
    });
    
    inputStream.on('end', async () => {
      try {
        const fullContent = Buffer.concat(chunks).toString();
        const obfuscated = await obfuscateLuaMemorySafe(fullContent, options);
        if (obfuscated.success && obfuscated.code) {
          resolve(obfuscated.code);
        } else {
          reject(new Error(obfuscated.error || 'Obfuscation failed'));
        }
      } catch (error) {
        reject(error);
      }
    });
    
    inputStream.on('error', reject);
  });
}

// ---------- Memory Usage Monitoring ----------
export function getMemoryUsage(): {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
} {
  const memoryUsage = process.memoryUsage();
  return {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };
}

// ---------- Export Default ----------
export default obfuscateLuaMemorySafe;
