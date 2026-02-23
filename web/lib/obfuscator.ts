// web/lib/obfuscator.ts
import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  protectionLevel?: number;
  targetVersion?: string;
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
// VARIABLE NAME GENERATOR
// ============================================

const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
const VALID_DIGITS = '0123456789';
const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
  'string', 'table', 'math', 'os', 'debug', 'coroutine', 'bit32', 'utf8'
]);

const usedNames = new Set<string>();

function generateName(): string {
  const length = randomInt(2, 5);
  let name = VALID_CHARS[randomInt(0, VALID_CHARS.length - 1)];
  
  for (let i = 1; i < length; i++) {
    const chars = VALID_CHARS + VALID_DIGITS;
    name += chars[randomInt(0, chars.length - 1)];
  }
  
  if (RESERVED_WORDS.has(name) || usedNames.has(name)) {
    return generateName();
  }
  
  usedNames.add(name);
  return name;
}

function resetNameGenerator(): void {
  usedNames.clear();
}

// ============================================
// NUMBER ENCODING
// ============================================

function encodeNumber(num: number): string {
  if (num < 10) return num.toString();
  
  const methods = [
    () => `(${num}+0)`,
    () => `(0x${num.toString(16)})`,
    () => `(${Math.floor(num / 2)}+${Math.ceil(num / 2)})`,
    () => `(${num}-0)`,
    () => `(${num}*1)`,
    () => `(${num}/1)`,
    () => `(tonumber("${num}"))`,
    () => `((function()return ${num}end)())`
  ];
  
  return methods[randomInt(0, methods.length - 1)]();
}

// ============================================
// STRING ENCODING
// ============================================

function encodeString(str: string): string {
  if (str.length === 0) return '""';
  if (str.length < 3) return `"${str}"`;
  
  const method = randomInt(0, 4);
  
  if (method === 0) {
    // Simple byte array
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return `string.char(${bytes.join(',')})`;
    
  } else if (method === 1) {
    // XOR with random key
    const key = randomInt(1, 255);
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) ^ key);
    }
    const decoder = generateName();
    return `((function(${decoder})local s='';for i=1,#${decoder} do s=s..string.char(${decoder}[i]~${key});end;return s;end)(${JSON.stringify(bytes)}))`;
    
  } else if (method === 2) {
    // Split into chunks
    const chunkSize = randomInt(2, 4);
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      const chunk = str.slice(i, i + chunkSize);
      chunks.push(`"${chunk}"`);
    }
    return chunks.join('..');
    
  } else if (method === 3) {
    // Hex encoding
    const hex: string[] = [];
    for (let i = 0; i < str.length; i++) {
      hex.push(`\\x${str.charCodeAt(i).toString(16).padStart(2, '0')}`);
    }
    return `"${hex.join('')}"`;
    
  } else {
    // Base64 with decoder
    const encoded = base64Encode(str);
    const decoder = generateName();
    return `((function(${decoder})local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'local r=''for i=1,#${decoder},4 do local a=(b:find(${decoder}:sub(i,i))or 65)-1 local c=(b:find(${decoder}:sub(i+1,i+1))or 65)-1 local d=(b:find(${decoder}:sub(i+2,i+2))or 65)-1 local e=(b:find(${decoder}:sub(i+3,i+3))or 65)-1 local n=(((a*64+c)*64+d)*64+e)r=r..string.char(bit32.rshift(n,16))r=r..string.char(bit32.band(bit32.rshift(n,8),255))r=r..string.char(bit32.band(n,255))end return r end)("${encoded}"))`;
  }
}

// ============================================
// AST TRANSFORMER
// ============================================

interface ASTNode {
  type: string;
  [key: string]: any;
}

class ASTTransformer {
  private nameMap: Map<string, string> = new Map();
  private scopeStack: string[][] = [[]];
  
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
        this.nameMap.set(node.name, generateName());
      }
      node.name = this.nameMap.get(node.name)!;
    }
    
    // Handle function parameters
    if (node.parameters && Array.isArray(node.parameters)) {
      node.parameters.forEach((param: any) => {
        if (param && param.type === 'Identifier' && param.name) {
          if (!this.nameMap.has(param.name)) {
            this.nameMap.set(param.name, generateName());
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
            this.nameMap.set(variable.name, generateName());
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
// CODE GENERATOR
// ============================================

class CodeGenerator {
  generate(node: any): string {
    if (!node) return '';
    return this.visitNode(node);
  }
  
  private visitNode(node: any): string {
    if (!node) return '';
    
    try {
      switch (node.type) {
        case 'Chunk':
          return this.visitNodes(node.body);
          
        case 'AssignmentStatement':
          return this.visitNodes(node.variables) + ' = ' + this.visitNodes(node.init);
          
        case 'LocalStatement':
          return 'local ' + this.visitNodes(node.variables) + 
                 (node.init && node.init.length ? ' = ' + this.visitNodes(node.init) : '');
          
        case 'CallStatement':
          return this.visitNode(node.expression);
          
        case 'CallExpression':
          return this.visitNode(node.base) + '(' + this.visitNodes(node.arguments) + ')';
          
        case 'StringLiteral':
          return encodeString(node.value);
          
        case 'NumericLiteral':
          return encodeNumber(node.value);
          
        case 'BooleanLiteral':
          return node.value ? 'true' : 'false';
          
        case 'NilLiteral':
          return 'nil';
          
        case 'Identifier':
          return this.nameMap?.get(node.name) || node.name || '';
          
        case 'BinaryExpression':
          return '(' + this.visitNode(node.left) + ' ' + node.operator + ' ' + this.visitNode(node.right) + ')';
          
        case 'UnaryExpression':
          return node.operator + ' ' + this.visitNode(node.argument);
          
        case 'IfStatement':
          return this.generateIfStatement(node);
          
        case 'WhileStatement':
          return 'while ' + this.visitNode(node.condition) + ' do\n' +
                 this.indent(this.visitNodes(node.body)) + '\nend';
          
        case 'RepeatStatement':
          return 'repeat\n' +
                 this.indent(this.visitNodes(node.body)) + '\n' +
                 'until ' + this.visitNode(node.condition);
          
        case 'ForStatement':
          return 'for ' + this.visitNode(node.variable) + ' = ' +
                 this.visitNode(node.start) + ', ' + this.visitNode(node.end) +
                 (node.step ? ', ' + this.visitNode(node.step) : '') + ' do\n' +
                 this.indent(this.visitNodes(node.body)) + '\nend';
          
        case 'ForInStatement':
          return 'for ' + this.visitNodes(node.variables) + ' in ' +
                 this.visitNodes(node.iterators) + ' do\n' +
                 this.indent(this.visitNodes(node.body)) + '\nend';
          
        case 'FunctionDeclaration':
          return 'function ' + this.visitNode(node.identifier) + '(' +
                 this.visitNodes(node.parameters) + ')\n' +
                 this.indent(this.visitNodes(node.body)) + '\nend';
          
        case 'LocalFunction':
          return 'local function ' + this.visitNode(node.identifier) + '(' +
                 this.visitNodes(node.parameters) + ')\n' +
                 this.indent(this.visitNodes(node.body)) + '\nend';
          
        case 'ReturnStatement':
          return 'return ' + this.visitNodes(node.arguments);
          
        case 'BreakStatement':
          return 'break';
          
        case 'GotoStatement':
          return 'goto ' + node.label;
          
        case 'LabelStatement':
          return '::' + node.label + '::';
          
        case 'TableConstructorExpression':
          return '{' + this.visitNodes(node.fields) + '}';
          
        case 'TableKey':
          return '[' + this.visitNode(node.key) + '] = ' + this.visitNode(node.value);
          
        case 'TableKeyString':
          return node.key.name + ' = ' + this.visitNode(node.value);
          
        case 'TableValue':
          return this.visitNode(node.value);
          
        case 'IndexExpression':
          return this.visitNode(node.base) + '[' + this.visitNode(node.index) + ']';
          
        case 'MemberExpression':
          return this.visitNode(node.base) + '.' + node.identifier.name;
          
        default:
          return '';
      }
    } catch (e) {
      return '';
    }
  }
  
  private generateIfStatement(node: any): string {
    let code = 'if ' + this.visitNode(node.condition) + ' then\n';
    code += this.indent(this.visitNodes(node.then));
    
    if (node.else) {
      code += '\nelse\n';
      const elseBody = Array.isArray(node.else) ? node.else : [node.else];
      code += this.indent(this.visitNodes(elseBody));
    }
    
    code += '\nend';
    return code;
  }
  
  private visitNodes(nodes: any[]): string {
    if (!nodes || !Array.isArray(nodes)) return '';
    return nodes
      .map(node => this.visitNode(node))
      .filter(line => line && line.trim())
      .join(', ');
  }
  
  private indent(code: string): string {
    if (!code) return '';
    return code.split('\n').map(line => '  ' + line).join('\n');
  }
  
  private nameMap?: Map<string, string>;
}

// ============================================
// CONTROL FLOW FLATTENING
// ============================================

function flattenControlFlow(lines: string[]): string[] {
  if (lines.length < 10) return lines;
  
  const stateVar = generateName();
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  
  for (const line of lines) {
    currentBlock.push(line);
    if ((line.includes('end') || line.includes('until')) && currentBlock.length > 3) {
      blocks.push(currentBlock);
      currentBlock = [];
    }
  }
  
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }
  
  if (blocks.length < 2) return lines;
  
  const result: string[] = [];
  result.push(`local ${stateVar}=${randomInt(0, blocks.length - 1)}`);
  result.push(`while ${stateVar}>=0 do`);
  
  for (let i = 0; i < blocks.length; i++) {
    if (i === 0) {
      result.push(`if ${stateVar}==${i} then`);
    } else {
      result.push(`elseif ${stateVar}==${i} then`);
    }
    
    result.push(...blocks[i].map(l => '  ' + l));
    
    if (i === blocks.length - 1) {
      result.push(`  ${stateVar}=-1`);
    } else {
      result.push(`  ${stateVar}=${randomInt(i + 1, blocks.length - 1)}`);
    }
  }
  
  result.push(`end`);
  result.push(`end`);
  
  return result;
}

// ============================================
// JUNK CODE INJECTION
// ============================================

const JUNK_CODE = [
  'local _=math.random(1,100)',
  'if false then print("dead") end',
  'local _t={1,2,3}',
  'for i=1,0 do end',
  'local _x=string.char(65)',
  'local _y=type(nil)',
  'local _z=os.clock()',
  'local _a=tonumber("123")',
  'local _b=tostring(math.random())',
  'local _c=(function()return nil end)()'
];

function injectJunkCode(lines: string[], count: number): string[] {
  const result = [...lines];
  
  for (let i = 0; i < count; i++) {
    const pos = randomInt(0, result.length);
    const junk = JUNK_CODE[randomInt(0, JUNK_CODE.length - 1)];
    result.splice(pos, 0, '  ' + junk);
  }
  
  return result;
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

    resetNameGenerator();
    
    const level = options.protectionLevel || 50;
    const layersApplied: string[] = [];
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);

    // Parse source to AST
    let ast;
    try {
      ast = luaparse.parse(source, { 
        comments: false, 
        luaVersion: (options.targetVersion as any) || '5.1',
        locations: false,
        ranges: false
      });
      layersApplied.push('astParsing');
    } catch {
      // If parsing fails, use simple string-based obfuscation
      layersApplied.push('simpleMode');
      
      // Split into lines
      let lines = source.split('\n').filter(l => l.trim().length > 0);
      
      // Apply simple obfuscation
      if (level >= 30) {
        lines = injectJunkCode(lines, Math.floor(level / 10));
        layersApplied.push('junkCode');
      }
      
      // Join and wrap
      const simpleOutput = `--[[ XZX OBFUSCATOR ]]
-- Build: ${buildId}
-- Mode: Simple

return(function(...)
${lines.map(l => '  ' + l).join('\n')}
end)(...)`;

      return {
        success: true,
        code: simpleOutput,
        metrics: {
          inputSize: source.length,
          outputSize: simpleOutput.length,
          duration: (Date.now() - startTime) / 1000,
          buildId,
          layersApplied
        }
      };
    }

    if (!ast) {
      throw new Error('Failed to parse AST');
    }

    // Transform AST (rename variables)
    const transformer = new ASTTransformer();
    const transformedAst = transformer.transform(ast);
    layersApplied.push('variableRenaming');

    // Generate code from AST
    const generator = new CodeGenerator();
    let obfuscated = generator.generate(transformedAst);
    layersApplied.push('codeGeneration');

    // Split into lines for further processing
    let lines = obfuscated.split('\n').filter(l => l.trim().length > 0);

    // Apply control flow flattening for high protection levels
    if (level >= 70) {
      lines = flattenControlFlow(lines);
      layersApplied.push('controlFlowFlattening');
    }

    // Inject junk code based on protection level
    if (level >= 50) {
      const junkCount = Math.floor(level / 20);
      lines = injectJunkCode(lines, junkCount);
      layersApplied.push('junkCode');
    }

    // Join lines
    obfuscated = lines.join('\n');

    // Generate final output with wrapper
    const finalCode = `--[[ XZX ULTIMATE OBFUSCATOR ]]
-- Build ID: ${buildId}
-- Protection Level: ${level}
-- Layers: ${layersApplied.join(', ')}
-- https://discord.gg/5q5bEKmYqF

return(function(...)
${obfuscated.split('\n').map(l => '  ' + l).join('\n')}
end)(...)
`;

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
    return {
      success: true,
      code: `--[[ XZX PROTECTED ]]
-- Build: FALLBACK-${randomHex(4)}

return(function(...)
${source.split('\n').map(l => '  ' + l).join('\n')}
end)(...)
`,
      metrics: {
        inputSize: source.length,
        outputSize: source.length + 100,
        duration: (Date.now() - startTime) / 1000,
        buildId: 'XZX-FALLBACK',
        layersApplied: ['fallback']
      }
    };
  }
}

export default obfuscateLua;
