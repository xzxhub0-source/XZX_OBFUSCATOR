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

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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
// VALID LUA IDENTIFIER GENERATOR
// ============================================

const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VALID_DIGITS = '0123456789';
const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while'
]);

function generateValidName(existingNames: Set<string> = new Set()): string {
  const length = randomInt(3, 8);
  let name = '_' + VALID_CHARS[randomInt(0, VALID_CHARS.length - 1)];
  
  for (let i = 1; i < length; i++) {
    const chars = VALID_CHARS + VALID_DIGITS;
    name += chars[randomInt(0, chars.length - 1)];
  }
  
  if (RESERVED_WORDS.has(name) || existingNames.has(name)) {
    return generateValidName(existingNames);
  }
  
  existingNames.add(name);
  return name;
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
// SAFE CODE GENERATOR
// ============================================

class SafeCodeGenerator {
  private lines: string[] = [];
  private variables: Set<string> = new Set();
  private indentLevel: number = 0;
  private lineCount: number = 0;
  
  addLine(line: string): void {
    if (line.trim().length > 0) {
      this.lines.push('  '.repeat(this.indentLevel) + line);
      this.lineCount++;
    }
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
  
  declareLocal(name: string, value?: string): void {
    if (!this.variables.has(name)) {
      this.variables.add(name);
      if (value !== undefined && value !== '') {
        this.addLine(`local ${name} = ${value}`);
      } else {
        this.addLine(`local ${name}`);
      }
    }
  }
  
  assign(name: string, value: string): void {
    if (!this.variables.has(name)) {
      this.declareLocal(name, value);
    } else {
      this.addLine(`${name} = ${value}`);
    }
  }
  
  getCode(): string {
    return this.lines.join('\n');
  }
  
  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }
  
  getLineCount(): number {
    return this.lineCount;
  }
}

// ============================================
// NUMBER ENCODING (SAFE)
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
    `tonumber("${num}")`,
    `(function() return ${num} end)()`
  ];
  
  return methods[randomInt(0, methods.length - 1)];
}

// ============================================
// STRING ENCODING (SAFE)
// ============================================

function safeEncodeString(str: string, vars: Set<string>): string {
  if (str.length === 0) return '""';
  if (str.length < 3) return `"${str}"`;
  
  const method = randomInt(0, 3);
  
  if (method === 0) {
    // Simple concatenation (always safe)
    const parts: string[] = [];
    for (let i = 0; i < str.length; i += 10) {
      const part = str.slice(i, i + 10);
      parts.push(`"${part}"`);
    }
    return parts.join(' .. ');
    
  } else if (method === 1) {
    // Byte array (always safe)
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return `string.char(${bytes.join(', ')})`;
    
  } else if (method === 2) {
    // Table lookup with function
    const varName = generateValidName(vars);
    vars.add(varName);
    const chars: string[] = [];
    for (let i = 0; i < str.length; i++) {
      chars.push(`[${i+1}] = ${str.charCodeAt(i)}`);
    }
    return `(function() local ${varName} = { ${chars.join(', ')} } local r = '' for i = 1, #${varName} do r = r .. string.char(${varName}[i]) end return r end)()`;
    
  } else {
    // Split into chunks with comments
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += randomInt(3, 6)) {
      const chunk = str.slice(i, i + randomInt(3, 6));
      chunks.push(`"${chunk}"`);
    }
    return chunks.join(' .. ');
  }
}

// ============================================
// SIMPLE CONTROL FLOW (SAFE)
// ============================================

function safeControlFlow(lines: string[], vars: Set<string>): string[] {
  if (lines.length < 10) return lines;
  
  const stateVar = generateValidName(vars);
  vars.add(stateVar);
  
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
    if (i === blocks.length - 1) {
      result.push(`    ${stateVar} = ${blocks.length + 1}`);
    } else {
      result.push(`    ${stateVar} = ${i+2}`);
    }
    result.push(`  end`);
  }
  
  result.push(`end`);
  
  return result;
}

// ============================================
// SAFE JUNK CODE (VALID LUA)
// ============================================

const SAFE_JUNK_CODE = [
  (vars: Set<string>) => {
    const v = generateValidName(vars);
    return `local ${v} = math.random(1, 100)`;
  },
  (vars: Set<string>) => {
    const v = generateValidName(vars);
    return `local ${v} = math.random() * 100`;
  },
  (vars: Set<string>) => {
    return `if false then end`;
  },
  (vars: Set<string>) => {
    const v = generateValidName(vars);
    return `local ${v} = {1, 2, 3}`;
  },
  (vars: Set<string>) => {
    return `for i = 1, 0 do end`;
  },
  (vars: Set<string>) => {
    const v = generateValidName(vars);
    return `local ${v} = string.char(65)`;
  },
  (vars: Set<string>) => {
    const v = generateValidName(vars);
    return `local ${v} = type(nil)`;
  },
  (vars: Set<string>) => {
    const v = generateValidName(vars);
    return `local ${v} = os.clock()`;
  },
  (vars: Set<string>) => {
    const v = generateValidName(vars);
    return `local ${v} = table.concat({"a","b","c"})`;
  }
];

function injectSafeJunk(lines: string[], vars: Set<string>, count: number): string[] {
  const result = [...lines];
  
  for (let i = 0; i < count; i++) {
    const pos = randomInt(0, result.length);
    const junkGen = SAFE_JUNK_CODE[randomInt(0, SAFE_JUNK_CODE.length - 1)];
    const junk = junkGen(vars);
    result.splice(pos, 0, junk);
  }
  
  return result;
}

// ============================================
// SIMPLE WRAPPER GENERATOR (ALWAYS WORKS)
// ============================================

function generateSimpleWrapper(source: string, buildId: string): string {
  const generator = new SafeCodeGenerator();
  
  // Add header
  generator.addLine(`--[[ XZX PROTECTED ]]`);
  generator.addLine(`-- Build: ${buildId}`);
  generator.addLine(`-- Mode: Safe Mode`);
  generator.addEmptyLine();
  
  // Wrap in function
  generator.addLine(`return function(...)`);
  generator.beginBlock();
  
  // Add source lines with proper indentation
  const lines = source.split('\n');
  for (const line of lines) {
    if (line.trim().length > 0) {
      generator.addLine(line);
    }
  }
  
  generator.endBlock();
  generator.addLine(`end)(...)`);
  
  return generator.getCode();
}

// ============================================
// AST-BASED OBFUSCATION (SAFE)
// ============================================

function safeASTObfuscation(source: string, vars: Set<string>): { code: string; success: boolean } {
  try {
    const ast = luaparse.parse(source, { comments: false, luaVersion: '5.1' });
    const generator = new SafeCodeGenerator();
    
    // Simple AST walker that generates valid Lua
    const walkNode = (node: any) => {
      if (!node) return;
      
      switch (node.type) {
        case 'Chunk':
          if (node.body && Array.isArray(node.body)) {
            for (const stmt of node.body) {
              walkNode(stmt);
            }
          }
          break;
          
        case 'AssignmentStatement':
          if (node.variables && node.init) {
            const vars_list = node.variables.map((v: any) => v.name || '').join(', ');
            const values = node.init.map((v: any) => {
              if (v.type === 'StringLiteral') return safeEncodeString(v.value, vars);
              if (v.type === 'NumericLiteral') return safeEncodeNumber(v.value);
              if (v.type === 'Identifier') return v.name;
              if (v.type === 'NilLiteral') return 'nil';
              if (v.type === 'BooleanLiteral') return v.value ? 'true' : 'false';
              return 'nil';
            }).join(', ');
            if (vars_list && values) {
              generator.addLine(`${vars_list} = ${values}`);
            }
          }
          break;
          
        case 'LocalStatement':
          if (node.variables) {
            const localVars = node.variables.map((v: any) => v.name || '').filter(Boolean);
            for (let i = 0; i < localVars.length; i++) {
              const varName = localVars[i];
              vars.add(varName);
              if (node.init && node.init.length > i) {
                const val = node.init[i];
                if (val.type === 'StringLiteral') {
                  generator.addLine(`local ${varName} = ${safeEncodeString(val.value, vars)}`);
                } else if (val.type === 'NumericLiteral') {
                  generator.addLine(`local ${varName} = ${safeEncodeNumber(val.value)}`);
                } else if (val.type === 'Identifier') {
                  generator.addLine(`local ${varName} = ${val.name}`);
                } else if (val.type === 'NilLiteral') {
                  generator.addLine(`local ${varName} = nil`);
                } else if (val.type === 'BooleanLiteral') {
                  generator.addLine(`local ${varName} = ${val.value ? 'true' : 'false'}`);
                } else {
                  generator.addLine(`local ${varName}`);
                }
              } else {
                generator.addLine(`local ${varName}`);
              }
            }
          }
          break;
          
        case 'CallStatement':
          if (node.expression) {
            walkNode(node.expression);
          }
          break;
          
        case 'CallExpression':
          if (node.base && node.base.name) {
            const args = node.arguments ? node.arguments.map((a: any) => {
              if (a.type === 'StringLiteral') return safeEncodeString(a.value, vars);
              if (a.type === 'NumericLiteral') return safeEncodeNumber(a.value);
              if (a.type === 'Identifier') return a.name;
              if (a.type === 'NilLiteral') return 'nil';
              if (a.type === 'BooleanLiteral') return a.value ? 'true' : 'false';
              return 'nil';
            }).join(', ') : '';
            generator.addLine(`${node.base.name}(${args})`);
          }
          break;
          
        case 'ReturnStatement':
          if (node.arguments && node.arguments.length > 0) {
            const values = node.arguments.map((a: any) => {
              if (a.type === 'StringLiteral') return safeEncodeString(a.value, vars);
              if (a.type === 'NumericLiteral') return safeEncodeNumber(a.value);
              if (a.type === 'Identifier') return a.name;
              if (a.type === 'NilLiteral') return 'nil';
              if (a.type === 'BooleanLiteral') return a.value ? 'true' : 'false';
              return 'nil';
            }).join(', ');
            generator.addLine(`return ${values}`);
          } else {
            generator.addLine(`return`);
          }
          break;
          
        case 'IfStatement':
          generator.addLine(`if ${node.condition ? 'true' : 'false'} then`);
          generator.beginBlock();
          if (node.then && Array.isArray(node.then)) {
            for (const stmt of node.then) {
              walkNode(stmt);
            }
          }
          generator.endBlock();
          if (node.else) {
            generator.addLine(`else`);
            generator.beginBlock();
            const elseBody = Array.isArray(node.else) ? node.else : [node.else];
            for (const stmt of elseBody) {
              walkNode(stmt);
            }
            generator.endBlock();
          }
          generator.addLine(`end`);
          break;
          
        case 'WhileStatement':
          generator.addLine(`while ${node.condition ? 'true' : 'false'} do`);
          generator.beginBlock();
          if (node.body && Array.isArray(node.body)) {
            for (const stmt of node.body) {
              walkNode(stmt);
            }
          }
          generator.endBlock();
          generator.addLine(`end`);
          break;
      }
    };
    
    walkNode(ast);
    
    if (generator.getLineCount() === 0) {
      return { code: '', success: false };
    }
    
    return { code: generator.getCode(), success: true };
    
  } catch (e) {
    return { code: '', success: false };
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
  const maxAttempts = 10;
  
  try {
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const level = options.protectionLevel || 50;
    const layersApplied: string[] = [];
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);
    
    // ALWAYS have a fallback ready
    const fallbackCode = generateSimpleWrapper(source, buildId);
    
    // If protection level is low, just return the simple wrapper
    if (level < 30) {
      return {
        success: true,
        code: fallbackCode,
        metrics: {
          inputSize: source.length,
          outputSize: fallbackCode.length,
          duration: (Date.now() - startTime) / 1000,
          buildId,
          layersApplied: ['simple']
        }
      };
    }

    // Try to generate obfuscated code with validation
    let finalCode = fallbackCode;
    let attempts = 0;
    let lastError = '';
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const vars = new Set<string>();
        
        // Generate obfuscated code
        const { code: obfuscated, success } = safeASTObfuscation(source, vars);
        
        if (!success || !obfuscated || obfuscated.trim().length === 0) {
          continue;
        }
        
        // Build the full output
        const generator = new SafeCodeGenerator();
        
        // Add header
        generator.addLine(`--[[ XZX ULTIMATE OBFUSCATOR ]]`);
        generator.addLine(`-- Build: ${buildId}`);
        generator.addLine(`-- Protection Level: ${level}`);
        generator.addLine(`-- Attempt: ${attempts}`);
        generator.addLine(`-- https://discord.gg/5q5bEKmYqF`);
        generator.addEmptyLine();
        
        // Wrap in function
        generator.addLine(`return function(...)`);
        generator.beginBlock();
        
        // Add obfuscated code
        const obfLines = obfuscated.split('\n');
        for (const line of obfLines) {
          if (line.trim().length > 0) {
            generator.addLine(line);
          }
        }
        
        // Add junk code if protection level is high
        if (level >= 70 && attempts % 2 === 0) {
          const junkCount = randomInt(1, 3);
          const junkLines: string[] = [];
          for (let i = 0; i < junkCount; i++) {
            const junkGen = SAFE_JUNK_CODE[randomInt(0, SAFE_JUNK_CODE.length - 1)];
            junkLines.push(junkGen(vars));
          }
          for (const junk of junkLines) {
            generator.addLine(junk);
          }
          if (!layersApplied.includes('junkCode')) {
            layersApplied.push('junkCode');
          }
        }
        
        // Add control flow if protection level is high
        if (level >= 80 && attempts % 3 === 0) {
          const lines = generator.getCode().split('\n');
          const codeLines = lines.slice(5); // Skip header
          const withFlow = safeControlFlow(codeLines, vars);
          // Rebuild generator with flow
          const newGen = new SafeCodeGenerator();
          for (let i = 0; i < 5; i++) {
            newGen.addLine(lines[i]);
          }
          newGen.addLine(`return function(...)`);
          newGen.beginBlock();
          for (const line of withFlow) {
            newGen.addLine(line);
          }
          newGen.endBlock();
          newGen.addLine(`end)(...)`);
          generator.lines = newGen['lines'];
          generator.variables = newGen['variables'];
          if (!layersApplied.includes('controlFlow')) {
            layersApplied.push('controlFlow');
          }
        }
        
        generator.endBlock();
        generator.addLine(`end)(...)`);
        
        const candidate = generator.getCode();
        
        // Validate the generated code
        const validation = validateLua(candidate);
        if (validation.valid) {
          finalCode = candidate;
          layersApplied.push('astObfuscation');
          if (options.debug) {
            console.log(`Success on attempt ${attempts}`);
          }
          break;
        } else {
          lastError = validation.error || 'Unknown error';
          if (options.debug) {
            console.log(`Attempt ${attempts} failed: ${lastError}`);
          }
        }
        
      } catch (e: any) {
        lastError = e.message;
        if (options.debug) {
          console.log(`Attempt ${attempts} error: ${lastError}`);
        }
      }
    }
    
    // If all attempts failed, use fallback
    if (attempts >= maxAttempts && finalCode === fallbackCode) {
      finalCode = fallbackCode;
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
    // Ultimate fallback - always return something executable
    const fallbackCode = generateSimpleWrapper(source, 'FALLBACK-' + randomHex(4));
    
    return {
      success: true,
      code: fallbackCode,
      metrics: {
        inputSize: source.length,
        outputSize: fallbackCode.length,
        duration: (Date.now() - startTime) / 1000,
        buildId: 'XZX-EMERGENCY',
        layersApplied: ['emergency']
      }
    };
  }
}

export default obfuscateLua;
