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

function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString();
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
// LUA SYNTAX VALIDATOR
// ============================================

function validateLua(code: string): { valid: boolean; error?: string } {
  try {
    luaparse.parse(code, { luaVersion: '5.1' });
    return { valid: true };
  } catch (e: any) {
    return { 
      valid: false, 
      error: e.message 
    };
  }
}

// ============================================
// SAFE IDENTIFIER GENERATOR
// ============================================

const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall'
]);

const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VALID_DIGITS = '0123456789';

class SafeIdentifierGenerator {
  private usedNames: Set<string> = new Set();
  
  generate(): string {
    const length = randomInt(3, 8);
    let name = '_' + VALID_CHARS[randomInt(0, VALID_CHARS.length - 1)];
    
    for (let i = 1; i < length; i++) {
      const chars = VALID_CHARS + VALID_DIGITS;
      name += chars[randomInt(0, chars.length - 1)];
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
  
  has(name: string): boolean {
    return this.usedNames.has(name);
  }
  
  add(name: string): void {
    this.usedNames.add(name);
  }
}

// ============================================
// SAFE CODE GENERATOR
// ============================================

class SafeCodeGenerator {
  private lines: string[] = [];
  private indentLevel: number = 0;
  private identifiers: SafeIdentifierGenerator;
  
  constructor(identifiers: SafeIdentifierGenerator) {
    this.identifiers = identifiers;
  }
  
  addLine(line: string): void {
    this.lines.push('  '.repeat(this.indentLevel) + line);
  }
  
  addEmptyLine(): void {
    this.lines.push('');
  }
  
  beginBlock(): void {
    this.indentLevel++;
  }
  
  endBlock(): void {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
  }
  
  getCode(): string {
    return this.lines.join('\n');
  }
}

// ============================================
// SAFE NUMBER ENCODING
// ============================================

function safeEncodeNumber(num: number): string {
  if (num < 10) return num.toString();
  
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
}

// ============================================
// SAFE STRING ENCODING
// ============================================

function safeEncodeString(str: string): string {
  if (str.length === 0) return '""';
  if (str.length < 3) return `"${str}"`;
  
  const method = randomInt(0, 3);
  
  if (method === 0) {
    // Simple concatenation
    const parts: string[] = [];
    for (let i = 0; i < str.length; i += 10) {
      const part = str.slice(i, i + 10);
      parts.push(`"${part}"`);
    }
    return parts.join(' .. ');
    
  } else if (method === 1) {
    // Byte array
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return `string.char(${bytes.join(', ')})`;
    
  } else if (method === 2) {
    // Table lookup
    const chars: string[] = [];
    for (let i = 0; i < str.length; i++) {
      chars.push(`[${i+1}] = ${str.charCodeAt(i)}`);
    }
    return `(function() local t = { ${chars.join(', ')} } local r = '' for i = 1, #t do r = r .. string.char(t[i]) end return r end)()`;
    
  } else {
    // Base64
    const encoded = base64Encode(str);
    return `(function() local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' local s='${encoded}' local r='' for i=1,#s,4 do local a=(b:find(s:sub(i,i))or 65)-1 local c=(b:find(s:sub(i+1,i+1))or 65)-1 local d=(b:find(s:sub(i+2,i+2))or 65)-1 local e=(b:find(s:sub(i+3,i+3))or 65)-1 local n=(((a*64+c)*64+d)*64+e) r=r..string.char(bit32.rshift(n,16)) r=r..string.char(bit32.band(bit32.rshift(n,8),255)) r=r..string.char(bit32.band(n,255)) end return r end)()`;
  }
}

// ============================================
// SAFE JUNK CODE GENERATOR
// ============================================

class SafeJunkGenerator {
  private identifiers: SafeIdentifierGenerator;
  
  constructor(identifiers: SafeIdentifierGenerator) {
    this.identifiers = identifiers;
  }
  
  generate(): string {
    const type = randomInt(0, 6);
    
    switch (type) {
      case 0:
        return `local ${this.identifiers.generate()} = math.random(1, 100)`;
      case 1:
        return `if false then end`;
      case 2:
        return `local ${this.identifiers.generate()} = {1, 2, 3}`;
      case 3:
        return `for i = 1, 0 do end`;
      case 4:
        return `local ${this.identifiers.generate()} = string.char(65)`;
      case 5:
        return `local ${this.identifiers.generate()} = type(nil)`;
      case 6:
        return `local ${this.identifiers.generate()} = os.clock()`;
      default:
        return `local ${this.identifiers.generate()} = nil`;
    }
  }
}

// ============================================
// SAFE CONTROL FLOW FLATTENING
// ============================================

class SafeControlFlow {
  private identifiers: SafeIdentifierGenerator;
  
  constructor(identifiers: SafeIdentifierGenerator) {
    this.identifiers = identifiers;
  }
  
  flatten(lines: string[]): string[] {
    if (lines.length < 10) return lines;
    
    const stateVar = this.identifiers.generate();
    const blocks: string[][] = [];
    let currentBlock: string[] = [];
    
    for (const line of lines) {
      currentBlock.push(line);
      if (line.includes('end') && currentBlock.length > 3) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    }
    
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }
    
    if (blocks.length < 2) return lines;
    
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
    
    return result;
  }
}

// ============================================
// AST TRANSFORMER
// ============================================

class ASTTransformer {
  private identifiers: SafeIdentifierGenerator;
  private nameMap: Map<string, string> = new Map();
  
  constructor(identifiers: SafeIdentifierGenerator) {
    this.identifiers = identifiers;
  }
  
  transform(ast: any): any {
    if (!ast) return ast;
    this.visitNode(ast);
    return ast;
  }
  
  private visitNode(node: any): void {
    if (!node) return;
    
    // Handle identifiers
    if (node.type === 'Identifier' && node.name && !RESERVED_WORDS.has(node.name)) {
      if (!this.nameMap.has(node.name)) {
        this.nameMap.set(node.name, this.identifiers.generate());
      }
      node.name = this.nameMap.get(node.name)!;
    }
    
    // Handle function parameters
    if (node.parameters && Array.isArray(node.parameters)) {
      node.parameters.forEach((param: any) => {
        if (param && param.type === 'Identifier' && param.name) {
          if (!this.nameMap.has(param.name)) {
            this.nameMap.set(param.name, this.identifiers.generate());
          }
          param.name = this.nameMap.get(param.name)!;
        }
      });
    }
    
    // Handle local variables
    if (node.type === 'LocalStatement' && node.variables) {
      node.variables.forEach((variable: any) => {
        if (variable && variable.type === 'Identifier' && variable.name) {
          if (!this.nameMap.has(variable.name)) {
            this.nameMap.set(variable.name, this.identifiers.generate());
          }
          variable.name = this.nameMap.get(variable.name)!;
        }
      });
    }
    
    // Recursively process children
    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const value = node[key];
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (value[i] && typeof value[i] === 'object') {
              this.visitNode(value[i]);
            }
          }
        } else if (value && typeof value === 'object') {
          this.visitNode(value);
        }
      }
    }
  }
}

// ============================================
// SAFE VM GENERATOR
// ============================================

function generateSafeVM(code: string, buildId: string): string {
  const encoded = base64Encode(code);
  
  return `--[[ XZX VIRTUAL MACHINE ]]
-- Build: ${buildId}

local XZXVM = {}

XZXVM.code = "${encoded}"

XZXVM.decode = function(s)
  local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local r = ''
  for i = 1, #s, 4 do
    local a = (b:find(s:sub(i, i)) or 65) - 1
    local c = (b:find(s:sub(i+1, i+1)) or 65) - 1
    local d = (b:find(s:sub(i+2, i+2)) or 65) - 1
    local e = (b:find(s:sub(i+3, i+3)) or 65) - 1
    local n = (((a * 64 + c) * 64 + d) * 64 + e)
    r = r .. string.char(bit32.rshift(n, 16))
    r = r .. string.char(bit32.band(bit32.rshift(n, 8), 255))
    r = r .. string.char(bit32.band(n, 255))
  end
  return r
end

XZXVM.run = function()
  local decoded = XZXVM.decode(XZXVM.code)
  local fn, err = load(decoded, "XZXVM")
  if not fn then return nil end
  local success, result = pcall(fn)
  if not success then return nil end
  return result
end

return XZXVM.run()
`;
}

// ============================================
// SAFE WRAPPER GENERATOR
// ============================================

function generateSafeWrapper(code: string, buildId: string): string {
  return `--[[ XZX PROTECTED ]]
-- Build: ${buildId}

return function(...)
${code.split('\n').map(l => '  ' + l).join('\n')}
end)(...)
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
  const maxAttempts = 5;
  
  try {
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const level = options.protectionLevel || 50;
    const layersApplied: string[] = [];
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);
    const identifiers = new SafeIdentifierGenerator();
    
    let finalCode = '';
    let attempts = 0;
    let lastError = '';

    while (attempts < maxAttempts && !finalCode) {
      attempts++;
      identifiers.reset();
      
      try {
        const generator = new SafeCodeGenerator(identifiers);
        const junkGen = new SafeJunkGenerator(identifiers);
        const controlFlow = new SafeControlFlow(identifiers);
        
        // Add header
        generator.addLine(`--[[ XZX ULTIMATE OBFUSCATOR ]]`);
        generator.addLine(`-- Build: ${buildId}`);
        generator.addLine(`-- Protection Level: ${level}`);
        generator.addLine(`-- Attempt: ${attempts}/${maxAttempts}`);
        generator.addLine(`-- https://discord.gg/5q5bEKmYqF`);
        generator.addEmptyLine();
        
        // Wrap in function
        generator.addLine(`return function(...)`);
        generator.beginBlock();
        
        // Process source
        let processedCode = source;
        
        // Try AST parsing for high protection
        if (level >= 70 && options.mangleNames !== false) {
          try {
            const ast = luaparse.parse(source, { 
              comments: false, 
              luaVersion: (options.targetVersion as any) || '5.1' 
            });
            const transformer = new ASTTransformer(identifiers);
            const transformed = transformer.transform(ast);
            
            // Generate code from AST (simplified)
            const astLines: string[] = [];
            if (transformed.body) {
              for (const stmt of transformed.body) {
                if (stmt.type === 'LocalStatement' && stmt.variables) {
                  const vars = stmt.variables.map((v: any) => v.name).join(', ');
                  if (stmt.init && stmt.init.length > 0) {
                    const vals = stmt.init.map((v: any) => {
                      if (v.type === 'StringLiteral') return safeEncodeString(v.value);
                      if (v.type === 'NumericLiteral') return safeEncodeNumber(v.value);
                      if (v.type === 'BooleanLiteral') return v.value ? 'true' : 'false';
                      if (v.type === 'NilLiteral') return 'nil';
                      return v.name || 'nil';
                    }).join(', ');
                    astLines.push(`local ${vars} = ${vals}`);
                  } else {
                    astLines.push(`local ${vars}`);
                  }
                }
              }
            }
            processedCode = astLines.join('\n');
            layersApplied.push('astTransformation');
          } catch (e) {
            // Fall back to simple processing
            layersApplied.push('astFailed');
          }
        }
        
        // Split into lines
        let lines = processedCode.split('\n').filter(l => l.trim().length > 0);
        
        // Apply number encoding
        if (options.encodeNumbers !== false && level >= 40) {
          lines = lines.map(line => {
            return line.replace(/\b(\d+)\b/g, (match) => {
              return safeEncodeNumber(parseInt(match, 10));
            });
          });
          layersApplied.push('numberEncoding');
        }
        
        // Apply string encoding
        if (options.encodeStrings !== false && level >= 50) {
          lines = lines.map(line => {
            return line.replace(/"([^"\\]*)"/g, (match, str) => {
              return safeEncodeString(str);
            });
          });
          layersApplied.push('stringEncoding');
        }
        
        // Apply junk code injection
        if (options.deadCodeInjection !== false && level >= 60) {
          const junkCount = Math.floor(level / 20);
          for (let i = 0; i < junkCount; i++) {
            const pos = randomInt(0, lines.length);
            lines.splice(pos, 0, junkGen.generate());
          }
          layersApplied.push('junkCode');
        }
        
        // Apply control flow flattening
        if (options.controlFlowFlattening !== false && level >= 80) {
          lines = controlFlow.flatten(lines);
          layersApplied.push('controlFlow');
        }
        
        // Write all lines
        for (const line of lines) {
          generator.addLine(line);
        }
        
        // Close function
        generator.endBlock();
        generator.addLine(`end)(...)`);
        
        const candidate = generator.getCode();
        
        // Validate
        const validation = validateLua(candidate);
        if (validation.valid) {
          finalCode = candidate;
          if (options.debug) {
            console.log(`Generated valid code on attempt ${attempts}`);
          }
        } else {
          lastError = validation.error || 'Unknown error';
          if (options.debug) {
            console.log(`Attempt ${attempts} invalid: ${lastError}`);
          }
        }
        
      } catch (e: any) {
        lastError = e.message;
        if (options.debug) {
          console.log(`Attempt ${attempts} error: ${lastError}`);
        }
      }
    }
    
    // Apply VM wrapper if requested
    if (options.useVM !== false && level >= 90 && finalCode) {
      finalCode = generateSafeVM(finalCode, buildId);
      layersApplied.push('virtualMachine');
    }
    
    // If all attempts failed, use simple wrapper
    if (!finalCode) {
      finalCode = generateSafeWrapper(source, buildId);
      layersApplied.push('fallback');
      if (options.debug) {
        console.log(`All attempts failed, using fallback. Last error: ${lastError}`);
      }
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
    // Ultimate fallback
    const fallback = `--[[ XZX PROTECTED ]]
-- Build: FALLBACK

return function(...)
${source.split('\n').map(l => '  ' + l).join('\n')}
end)(...)`;
    
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
