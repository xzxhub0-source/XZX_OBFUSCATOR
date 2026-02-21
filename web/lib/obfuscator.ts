// lib/obfuscator.ts
import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  mangleNames?: boolean;
  encodeStrings?: boolean;
  encodeNumbers?: boolean;
  controlFlow?: boolean;
  antiDebugging?: boolean;
  protectionLevel?: number;
  deadCodeInjection?: boolean;
  opaquePredicates?: boolean;
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
 * Simple XOR encryption/decryption
 */
function xorEncode(str: string, key: number): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ ((key + i) & 0xff));
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
 * Split string into chunks
 */
function splitIntoChunks(str: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
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

// ---------- AST Transformer ----------

interface ASTNode {
  type: string;
  [key: string]: any;
}

/**
 * Safe AST walker with null checks
 */
class ASTWalker {
  static walk(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    
    callback(node);
    
    // Walk through all properties
    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const value = node[key];
        
        if (Array.isArray(value)) {
          // Walk array items
          for (let i = 0; i < value.length; i++) {
            if (value[i] && typeof value[i] === 'object') {
              this.walk(value[i], callback);
            }
          }
        } else if (value && typeof value === 'object') {
          // Walk object
          this.walk(value, callback);
        }
      }
    }
  }

  static findNodes(node: any, type: string): any[] {
    const results: any[] = [];
    this.walk(node, (n) => {
      if (n && n.type === type) {
        results.push(n);
      }
    });
    return results;
  }
}

/**
 * AST Transformer for Lua code
 */
class LuaTransformer {
  private nameMap: Map<string, string> = new Map();
  private stringMap: Map<string, string> = new Map();
  private numberTransformations: Map<string, string> = new Map();

  /**
   * Transform Lua AST with various obfuscation techniques
   */
  transform(ast: any, options: ObfuscationOptions): any {
    if (!ast) return ast;

    const level = options.protectionLevel || 50;

    // Apply transformations based on protection level
    if (options.mangleNames !== false && level >= 20) {
      this.mangleIdentifiers(ast);
    }

    if (options.encodeStrings !== false && level >= 30) {
      this.encodeStringLiterals(ast);
    }

    if (options.encodeNumbers !== false && level >= 40) {
      this.encodeNumbers(ast);
    }

    if (options.deadCodeInjection !== false && level >= 65) {
      this.injectDeadCode(ast);
    }

    if (options.controlFlowFlattening !== false && level >= 70) {
      this.flattenControlFlow(ast);
    }

    return ast;
  }

  /**
   * Mangle all identifiers (variable names, function names, etc.)
   */
  private mangleIdentifiers(node: any): void {
    if (!node) return;

    // Handle identifiers
    if (node.type === 'Identifier' && node.name && !RESERVED_WORDS.has(node.name)) {
      if (!this.nameMap.has(node.name)) {
        this.nameMap.set(node.name, '_' + randomHex(6));
      }
      node.name = this.nameMap.get(node.name)!;
    }

    // Handle function parameters
    if (node.parameters && Array.isArray(node.parameters)) {
      node.parameters.forEach((param: any) => {
        if (param && param.type === 'Identifier' && param.name) {
          if (!this.nameMap.has(param.name)) {
            this.nameMap.set(param.name, '_' + randomHex(6));
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
            this.nameMap.set(variable.name, '_' + randomHex(6));
          }
          variable.name = this.nameMap.get(variable.name)!;
        }
      });
    }

    // Recursively process children
    ASTWalker.walk(node, (child) => {
      if (child !== node) {
        this.mangleIdentifiers(child);
      }
    });
  }

  /**
   * Encode string literals into encrypted byte arrays
   */
  private encodeStringLiterals(node: any): void {
    if (!node) return;

    if (node.type === 'StringLiteral' && node.value && typeof node.value === 'string') {
      // Skip empty strings and very short strings
      if (node.value.length < 3) return;

      const key = Math.floor(Math.random() * 255) + 1;
      const encoded: number[] = [];
      
      for (let i = 0; i < node.value.length; i++) {
        encoded.push(node.value.charCodeAt(i) ^ ((key + i) & 0xff));
      }

      // Transform into encrypted representation
      const decoderName = '_' + randomHex(4);
      node.type = 'CallExpression';
      node.base = {
        type: 'FunctionDeclaration',
        identifier: { type: 'Identifier', name: decoderName },
        parameters: [{ type: 'Identifier', name: 'd' }],
        body: [
          {
            type: 'LocalStatement',
            variables: [{ type: 'Identifier', name: 's' }],
            init: [{ type: 'StringLiteral', value: '' }]
          },
          {
            type: 'ForStatement',
            variable: { type: 'Identifier', name: 'i' },
            start: { type: 'NumericLiteral', value: 1 },
            end: { type: 'MemberExpression', base: { type: 'Identifier', name: 'd' }, identifier: { type: 'Identifier', name: 'n' } },
            body: [
              {
                type: 'AssignmentStatement',
                variables: [{ type: 'Identifier', name: 's' }],
                init: [{
                  type: 'BinaryExpression',
                  operator: '..',
                  left: { type: 'Identifier', name: 's' },
                  right: {
                    type: 'CallExpression',
                    base: { type: 'MemberExpression', base: { type: 'Identifier', name: 'string' }, identifier: { type: 'Identifier', name: 'char' } },
                    arguments: [{
                      type: 'BinaryExpression',
                      operator: '~',
                      left: {
                        type: 'IndexExpression',
                        base: { type: 'Identifier', name: 'd' },
                        index: { type: 'Identifier', name: 'i' }
                      },
                      right: {
                        type: 'BinaryExpression',
                        operator: '&',
                        left: {
                          type: 'BinaryExpression',
                          operator: '+',
                          left: { type: 'NumericLiteral', value: key },
                          right: {
                            type: 'BinaryExpression',
                            operator: '-',
                            left: { type: 'Identifier', name: 'i' },
                            right: { type: 'NumericLiteral', value: 1 }
                          }
                        },
                        right: { type: 'NumericLiteral', value: 0xff }
                      }
                    }]
                  }
                }]
              }
            ]
          },
          {
            type: 'ReturnStatement',
            arguments: [{ type: 'Identifier', name: 's' }]
          }
        ]
      };
      node.arguments = [{
        type: 'TableConstructorExpression',
        fields: encoded.map(num => ({
          type: 'TableValue',
          value: { type: 'NumericLiteral', value: num }
        }))
      }];
    }

    // Recursively process children
    ASTWalker.walk(node, (child) => {
      if (child !== node) {
        this.encodeStringLiterals(child);
      }
    });
  }

  /**
   * Encode numbers into mathematical expressions
   */
  private encodeNumbers(node: any): void {
    if (!node) return;

    if (node.type === 'NumericLiteral' && node.value !== undefined) {
      const num = node.value;
      
      // Skip small numbers
      if (Math.abs(num) < 10) return;

      const transformations = [
        { type: 'BinaryExpression', operator: '+', left: num / 2, right: num / 2 },
        { type: 'BinaryExpression', operator: '*', left: num, right: 1 },
        { type: 'BinaryExpression', operator: '-', left: num + 5, right: 5 },
        { type: 'UnaryExpression', operator: '-', argument: -num }
      ];

      const selected = transformations[Math.floor(Math.random() * transformations.length)];
      
      if (selected.type === 'BinaryExpression') {
        node.type = 'BinaryExpression';
        node.operator = selected.operator;
        node.left = { type: 'NumericLiteral', value: selected.left };
        node.right = { type: 'NumericLiteral', value: selected.right };
      } else if (selected.type === 'UnaryExpression') {
        node.type = 'UnaryExpression';
        node.operator = selected.operator;
        node.argument = { type: 'NumericLiteral', value: selected.argument };
      }
    }

    // Recursively process children
    ASTWalker.walk(node, (child) => {
      if (child !== node) {
        this.encodeNumbers(child);
      }
    });
  }

  /**
   * Inject dead code blocks
   */
  private injectDeadCode(node: any): void {
    if (!node || !node.body || !Array.isArray(node.body)) return;

    const deadCodeTemplates = [
      {
        type: 'IfStatement',
        condition: { type: 'BooleanLiteral', value: false },
        then: [
          {
            type: 'CallStatement',
            expression: {
              type: 'CallExpression',
              base: { type: 'Identifier', name: 'print' },
              arguments: [{ type: 'StringLiteral', value: '' }]
            }
          }
        ]
      },
      {
        type: 'LocalStatement',
        variables: [{ type: 'Identifier', name: '_' + randomHex(4) }],
        init: [{ type: 'NumericLiteral', value: Math.floor(Math.random() * 1000) }]
      },
      {
        type: 'WhileStatement',
        condition: { type: 'BooleanLiteral', value: false },
        body: [
          {
            type: 'AssignmentStatement',
            variables: [{ type: 'Identifier', name: '_' + randomHex(3) }],
            init: [{ type: 'NumericLiteral', value: 0 }]
          }
        ]
      }
    ];

    // Insert 1-3 dead code blocks
    const numBlocks = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numBlocks; i++) {
      const pos = Math.floor(Math.random() * node.body.length);
      const template = deadCodeTemplates[Math.floor(Math.random() * deadCodeTemplates.length)];
      node.body.splice(pos, 0, JSON.parse(JSON.stringify(template)));
    }
  }

  /**
   * Flatten control flow (basic implementation)
   */
  private flattenControlFlow(node: any): void {
    if (!node || node.type !== 'Chunk' || !node.body) return;

    // Only flatten if there are enough statements
    if (node.body.length < 5) return;

    // Create a dispatcher variable
    const dispatcherName = '_' + randomHex(4);
    
    // Split into blocks
    const blocks: any[][] = [[]];
    
    for (const stmt of node.body) {
      blocks[blocks.length - 1].push(stmt);
      
      // Split at control flow statements
      if (stmt.type === 'IfStatement' || stmt.type === 'WhileStatement' || 
          stmt.type === 'RepeatStatement' || stmt.type === 'ForStatement') {
        blocks.push([]);
      }
    }

    // Filter out empty blocks
    const validBlocks = blocks.filter(b => b.length > 0);

    if (validBlocks.length < 3) return;

    // Create block functions
    const blockFuncs = validBlocks.map((block, index) => ({
      type: 'LocalFunction',
      identifier: { type: 'Identifier', name: dispatcherName + '_' + index },
      parameters: [],
      body: block
    }));

    // Create dispatch table
    const dispatchTable = {
      type: 'LocalStatement',
      variables: [{ type: 'Identifier', name: dispatcherName }],
      init: [{
        type: 'TableConstructorExpression',
        fields: validBlocks.map((_, index) => ({
          type: 'TableKey',
          key: { type: 'NumericLiteral', value: index + 1 },
          value: { type: 'Identifier', name: dispatcherName + '_' + index }
        }))
      }]
    };

    // Create dispatcher loop
    const dispatcherLoop = {
      type: 'WhileStatement',
      condition: { type: 'BooleanLiteral', value: true },
      body: [
        {
          type: 'IfStatement',
          condition: {
            type: 'BinaryExpression',
            operator: '>',
            left: { type: 'Identifier', name: 'pc' },
            right: { type: 'NumericLiteral', value: validBlocks.length }
          },
          then: [{ type: 'BreakStatement' }]
        },
        {
          type: 'CallStatement',
          expression: {
            type: 'CallExpression',
            base: {
              type: 'IndexExpression',
              base: { type: 'Identifier', name: dispatcherName },
              index: { type: 'Identifier', name: 'pc' }
            },
            arguments: []
          }
        },
        {
          type: 'AssignmentStatement',
          variables: [{ type: 'Identifier', name: 'pc' }],
          init: [{
            type: 'BinaryExpression',
            operator: '+',
            left: { type: 'Identifier', name: 'pc' },
            right: { type: 'NumericLiteral', value: 1 }
          }]
        }
      ]
    };

    // Replace original body with flattened version
    node.body = [
      ...blockFuncs,
      dispatchTable,
      {
        type: 'LocalStatement',
        variables: [{ type: 'Identifier', name: 'pc' }],
        init: [{ type: 'NumericLiteral', value: 1 }]
      },
      dispatcherLoop
    ];
  }
}

// ---------- Code Generator ----------

/**
 * Generate Lua code from AST
 */
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
          return this.escapeString(node.value);

        case 'NumericLiteral':
          return node.value.toString();

        case 'BooleanLiteral':
          return node.value ? 'true' : 'false';

        case 'NilLiteral':
          return 'nil';

        case 'Identifier':
          return node.name || '';

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
          return (node.key && node.key.name || '') + ' = ' + this.visitNode(node.value);

        case 'TableValue':
          return this.visitNode(node.value);

        case 'IndexExpression':
          return this.visitNode(node.base) + '[' + this.visitNode(node.index) + ']';

        case 'MemberExpression':
          return this.visitNode(node.base) + '.' + (node.identifier ? node.identifier.name : '');

        default:
          return '';
      }
    } catch (e) {
      console.warn('Error generating code for node:', node.type, e);
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

  private escapeString(str: string): string {
    if (!str) return '""';
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') + '"';
  }

  private indent(code: string): string {
    if (!code) return '';
    return code.split('\n').map(line => '  ' + line).join('\n');
  }
}

// ---------- Minifier ----------

/**
 * Minify Lua code by removing whitespace and comments
 */
function minifyLua(code: string): string {
  return code
    // Remove block comments
    .replace(/--\[\[.*?\]\]--/gs, '')
    // Remove line comments
    .replace(/--.*$/gm, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove spaces around operators and punctuation
    .replace(/\s*([=+\-*/%<>.,;{}()\[\]])\s*/g, '$1')
    // Remove spaces at beginning/end
    .trim();
}

// ---------- Main Obfuscator ----------

/**
 * Obfuscate Lua code with various protection layers
 */
export async function obfuscateLua(source: string, options: ObfuscationOptions = {}): Promise<ObfuscationResult> {
  const startTime = Date.now();
  
  try {
    // Validate input
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    // Parse Lua code to AST
    let ast;
    try {
      ast = luaparse.parse(source, { 
        comments: false, 
        luaVersion: (options.targetVersion as any) || '5.1',
        locations: false,
        ranges: false,
        scope: false,
        wait: false
      });
    } catch (parseError) {
      throw new Error(`Invalid Lua syntax: ${parseError.message}`);
    }

    if (!ast) {
      throw new Error('Failed to parse AST');
    }

    // Apply AST transformations
    const transformer = new LuaTransformer();
    const transformedAst = transformer.transform(ast, options);

    // Generate code from transformed AST
    const generator = new CodeGenerator();
    let obfuscatedCode = generator.generate(transformedAst);

    // Apply formatting
    if (options.formattingStyle !== 'pretty') {
      obfuscatedCode = minifyLua(obfuscatedCode);
    }

    // Generate build ID
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);

    // Calculate metrics
    const duration = (Date.now() - startTime) / 1000;
    
    // Determine which layers were applied
    const level = options.protectionLevel || 50;
    const layersApplied: string[] = [];
    
    if (options.mangleNames !== false && level >= 20) layersApplied.push('mangleNames');
    if (options.encodeStrings !== false && level >= 30) layersApplied.push('encodeStrings');
    if (options.encodeNumbers !== false && level >= 40) layersApplied.push('encodeNumbers');
    if (options.deadCodeInjection !== false && level >= 65) layersApplied.push('deadCodeInjection');
    if (options.controlFlowFlattening !== false && level >= 70) layersApplied.push('controlFlowFlattening');
    if (options.formattingStyle !== 'pretty') layersApplied.push('minify');

    return {
      success: true,
      code: obfuscatedCode,
      metrics: {
        inputSize: source.length,
        outputSize: obfuscatedCode.length,
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

// ---------- Simple Obfuscation (Fallback) ----------

/**
 * Simple string-based obfuscation (fallback if AST parsing fails)
 */
export function simpleObfuscate(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
  const startTime = Date.now();
  
  try {
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    let obfuscated = source;
    const layersApplied: string[] = [];
    const level = options.protectionLevel || 50;

    // Apply simple obfuscation techniques
    if (options.mangleNames !== false && level >= 20) {
      // Simple regex-based name mangling
      const nameMap = new Map<string, string>();
      obfuscated = obfuscated.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
        if (RESERVED_WORDS.has(match) || match.startsWith('_')) return match;
        if (!nameMap.has(match)) {
          nameMap.set(match, '_' + randomHex(6));
        }
        return nameMap.get(match)!;
      });
      layersApplied.push('mangleNames');
    }

    if (options.encodeStrings !== false && level >= 30) {
      // Simple string encoding
      const key = Math.floor(Math.random() * 255) + 1;
      obfuscated = obfuscated.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
        const encoded: number[] = [];
        for (let i = 0; i < content.length; i++) {
          encoded.push(content.charCodeAt(i) ^ ((key + i) & 0xff));
        }
        const decoder = '_' + randomHex(4);
        return `((function(${decoder}) local s='';for i=1,#${decoder} do s=s..string.char(${decoder}[i]~(${key}+i-1));end;return s;end)(${JSON.stringify(encoded)}))`;
      });
      layersApplied.push('encodeStrings');
    }

    if (options.formattingStyle !== 'pretty') {
      obfuscated = minifyLua(obfuscated);
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

// ---------- Batch Obfuscation ----------

/**
 * Obfuscate multiple Lua files at once
 */
export async function obfuscateBatch(files: { name: string; content: string }[], options: ObfuscationOptions = {}): Promise<{
  results: { name: string; result: ObfuscationResult }[];
  totalTime: number;
}> {
  const startTime = Date.now();
  const results: { name: string; result: ObfuscationResult }[] = [];

  for (const file of files) {
    try {
      const result = await obfuscateLua(file.content, options);
      results.push({ name: file.name, result });
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

// ---------- Validate Obfuscated Code ----------

/**
 * Validate that obfuscated code is still syntactically valid
 */
export function validateObfuscated(code: string): { valid: boolean; error?: string } {
  try {
    luaparse.parse(code, { luaVersion: '5.1' });
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid syntax'
    };
  }
}

// ---------- Get Obfuscation Statistics ----------

/**
 * Get statistics about the obfuscation process
 */
export function getObfuscationStats(original: string, obfuscated: string): {
  sizeIncrease: number;
  sizeIncreasePercent: number;
  lineCount: { original: number; obfuscated: number };
  complexity: number;
} {
  const originalSize = original.length;
  const obfuscatedSize = obfuscated.length;
  const sizeIncrease = obfuscatedSize - originalSize;
  const sizeIncreasePercent = (sizeIncrease / originalSize) * 100;

  const originalLines = original.split('\n').length;
  const obfuscatedLines = obfuscated.split('\n').length;

  // Simple complexity metric (number of operators and keywords)
  const operators = obfuscated.match(/[=+\-*/%<>~^#.,;{}()[\]]/g)?.length || 0;
  const keywords = obfuscated.match(/\b(and|or|not|if|then|else|end|for|while|do|repeat|until|function|local|return|break)\b/g)?.length || 0;
  const complexity = operators + keywords;

  return {
    sizeIncrease,
    sizeIncreasePercent,
    lineCount: { original: originalLines, obfuscated: obfuscatedLines },
    complexity
  };
}

// Default export
export default obfuscateLua;
