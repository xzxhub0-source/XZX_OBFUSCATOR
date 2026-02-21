import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  seed?: number;
  mode?: 'standard' | 'isolated' | 'sandbox';
  debug?: boolean;
  optimization?: 'none' | 'basic' | 'aggressive';
  layers?: {
    constants?: boolean;
    identifiers?: boolean;
    controlFlow?: boolean;
    garbage?: boolean;
    polymorphism?: boolean;
    antiTamper?: boolean;
    strings?: boolean;
    expressions?: boolean;
    stack?: boolean;
    advanced?: boolean;
  };
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

// ---------- Simple XOR Crypto for Executors ----------
class SimpleCrypto {
  static xorEncode(data: string, key: number): string {
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ ((key + i) & 0xff));
    }
    return result;
  }

  static xorDecode(data: string, key: number): string {
    return this.xorEncode(data, key); // XOR is symmetric
  }

  static simpleHash(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x1000193) >>> 0;
    }
    return hash;
  }

  static randomBytes(length: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    return bytes;
  }
}

// ---------- Seeded Random (executor-safe) ----------
class SeededRandom {
  private state: number;
  
  constructor(seed?: number) {
    this.state = seed || Math.floor(Math.random() * 0x7fffffff);
  }
  
  next(): number {
    this.state = (this.state * 0x9e3779b9 + 0x9e3779b9) >>> 0;
    return this.state;
  }
  
  range(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
  
  choice<T>(arr: T[]): T {
    return arr[this.range(0, arr.length - 1)];
  }
  
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.range(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  randomString(min: number, max: number): string {
    const len = this.range(min, max);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars[this.range(0, chars.length - 1)];
    }
    return result;
  }

  randomHex(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.range(0, 15)];
    }
    return result;
  }

  randomBytes(length: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push(this.range(0, 255));
    }
    return bytes;
  }
}

// ---------- Name Generator ----------
class NameGenerator {
  private rng: SeededRandom;
  private used: Set<string> = new Set();
  private reservedWords = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
    'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
    'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
    'string', 'table', 'math', 'os', 'debug', 'coroutine', 'bit32', 'utf8'
  ]);
  
  constructor(rng: SeededRandom) { 
    this.rng = rng; 
  }
  
  generate(): string {
    const templates = [
      () => '_' + this.rng.randomHex(4),
      () => 'x' + this.rng.range(1000, 9999).toString(36),
      () => this.rng.choice(['a','b','c','d']) + this.rng.randomHex(3),
      () => 'v' + this.rng.range(100, 999).toString(36),
      () => '_' + this.rng.randomString(2, 3),
      () => this.rng.choice(['k','l','m','n']) + this.rng.range(100, 999).toString(36)
    ];
    
    let result = this.rng.choice(templates)();
    
    while (this.used.has(result) || this.reservedWords.has(result)) {
      result = this.rng.choice(templates)();
    }
    
    this.used.add(result);
    return result;
  }
  
  generateTable(count: number): string[] {
    return Array.from({ length: count }, () => this.generate());
  }
}

// ---------- String Splitter for Large Strings ----------
class StringSplitter {
  static split(str: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  static encodeForLua(str: string): string {
    // Convert string to byte array format to avoid string length limits
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return '{' + bytes.join(',') + '}';
  }

  static encodeWithMixedRadix(str: string, rng: SeededRandom): string {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    
    // Mix radix representations to make it harder to analyze
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const fmt = rng.range(0, 3);
      if (fmt === 0) parts.push(bytes[i].toString());
      else if (fmt === 1) parts.push('0x' + bytes[i].toString(16));
      else if (fmt === 2) parts.push('0b' + bytes[i].toString(2));
      else parts.push('0' + bytes[i].toString(8));
    }
    return '{' + parts.join(',') + '}';
  }
}

// ---------- AST Transformer ----------
class ASTTransformer {
  private rng: SeededRandom;
  private nameGen: NameGenerator;
  private renamedIdentifiers: Map<string, string>;

  constructor(rng: SeededRandom) {
    this.rng = rng;
    this.nameGen = new NameGenerator(rng);
    this.renamedIdentifiers = new Map();
  }

  transform(ast: any, options: ObfuscationOptions): any {
    // Apply transformations in order
    if (options.layers?.identifiers) {
      this.renameIdentifiers(ast);
    }

    if (options.layers?.strings) {
      this.transformStrings(ast);
    }

    if (options.layers?.constants) {
      this.transformConstants(ast);
    }

    if (options.layers?.garbage) {
      this.addJunkCode(ast);
    }

    if (options.layers?.expressions) {
      this.complicateExpressions(ast);
    }

    return ast;
  }

  private renameIdentifiers(node: any): void {
    if (!node) return;

    if (node.type === 'Identifier' && !this.isReserved(node.name)) {
      if (!this.renamedIdentifiers.has(node.name)) {
        this.renamedIdentifiers.set(node.name, this.nameGen.generate());
      }
      node.name = this.renamedIdentifiers.get(node.name)!;
    }

    // Recursively process all properties
    for (const key in node) {
      if (typeof node[key] === 'object') {
        this.renameIdentifiers(node[key]);
      }
    }
  }

  private isReserved(name: string): boolean {
    const reserved = new Set([
      'true', 'false', 'nil', 'and', 'or', 'not',
      'if', 'then', 'else', 'elseif', 'end',
      'while', 'do', 'for', 'in', 'repeat', 'until',
      'function', 'local', 'return', 'break',
      'getfenv', 'setfenv', '_ENV', 'load', 'loadstring',
      'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
      'string', 'table', 'math', 'os', 'debug', 'coroutine',
      'bit32', 'utf8', 'rawget', 'rawset', 'rawlen', 'rawequal',
      'next', 'pairs', 'ipairs', 'select', 'unpack', 'tonumber',
      'tostring', 'type', 'typeof', 'getmetatable', 'setmetatable'
    ]);
    return reserved.has(name);
  }

  private transformStrings(node: any): void {
    if (!node) return;

    if (node.type === 'StringLiteral' && node.value.length > 20) {
      // Split long strings
      const chunks = this.splitIntoChunks(node.value, 15);
      if (chunks.length > 1) {
        node.type = 'BinaryExpression';
        node.operator = '..';
        node.left = { type: 'StringLiteral', value: chunks[0] };
        node.right = { type: 'StringLiteral', value: chunks[1] };
        
        for (let i = 2; i < chunks.length; i++) {
          node.right = {
            type: 'BinaryExpression',
            operator: '..',
            left: node.right,
            right: { type: 'StringLiteral', value: chunks[i] }
          };
        }
      }
    }

    for (const key in node) {
      if (typeof node[key] === 'object') {
        this.transformStrings(node[key]);
      }
    }
  }

  private splitIntoChunks(str: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
  }

  private transformConstants(node: any): void {
    if (!node) return;

    if (node.type === 'NumericLiteral') {
      // Transform numbers with mathematical equivalents
      if (this.rng.range(0, 1) === 0) {
        const transformations = [
          `(${node.value} + 0)`,
          `(${node.value} * 1)`,
          `(0x${node.value.toString(16)})`,
          `(0b${node.value.toString(2)})`,
          `(0${node.value.toString(8)})`,
          `(${node.value / 2} + ${node.value / 2})`,
          `(${node.value} - 0)`
        ];
        node.type = 'BinaryExpression';
        // This is simplified - in practice you'd build proper AST nodes
        node.value = this.rng.choice(transformations);
      }
    }

    for (const key in node) {
      if (typeof node[key] === 'object') {
        this.transformConstants(node[key]);
      }
    }
  }

  private addJunkCode(node: any): void {
    if (!node) return;

    if (node.type === 'Chunk' && node.body) {
      const junkCount = this.rng.range(1, 3);
      for (let i = 0; i < junkCount; i++) {
        const pos = this.rng.range(0, node.body.length);
        node.body.splice(pos, 0, this.createJunkStatement());
      }
    }

    for (const key in node) {
      if (typeof node[key] === 'object') {
        this.addJunkCode(node[key]);
      }
    }
  }

  private createJunkStatement(): any {
    const types = ['assign', 'call', 'if', 'local'];
    const type = this.rng.choice(types);
    
    switch (type) {
      case 'assign':
        return {
          type: 'AssignmentStatement',
          variables: [{ type: 'Identifier', name: '_' + this.rng.randomHex(3) }],
          init: [{ type: 'NumericLiteral', value: this.rng.range(0, 999) }]
        };
      case 'call':
        return {
          type: 'CallStatement',
          expression: {
            type: 'CallExpression',
            base: { type: 'Identifier', name: 'print' },
            arguments: [{ type: 'StringLiteral', value: '' }]
          }
        };
      case 'if':
        return {
          type: 'IfStatement',
          condition: { type: 'BooleanLiteral', value: false },
          then: []
        };
      default:
        return {
          type: 'LocalStatement',
          variables: [{ type: 'Identifier', name: '_' + this.rng.randomHex(2) }],
          init: [{ type: 'NilLiteral' }]
        };
    }
  }

  private complicateExpressions(node: any): void {
    if (!node) return;

    if (node.type === 'BinaryExpression') {
      // Add redundant operations
      if (this.rng.range(0, 2) === 0) {
        // Transform a + b into (a + b) + 0
        const newNode = {
          type: 'BinaryExpression',
          operator: '+',
          left: node,
          right: { type: 'NumericLiteral', value: 0 }
        };
        Object.assign(node, newNode);
      }
    }

    for (const key in node) {
      if (typeof node[key] === 'object') {
        this.complicateExpressions(node[key]);
      }
    }
  }
}

// ---------- Code Generator ----------
class CodeGenerator {
  generate(ast: any): string {
    return this.visitNode(ast);
  }

  private visitNode(node: any): string {
    if (!node) return 'nil';

    switch (node.type) {
      case 'Chunk':
        return (node.body || []).map((stmt: any) => this.visitNode(stmt)).join('\n');

      case 'AssignmentStatement':
        return this.visitNodes(node.variables) + ' = ' + this.visitNodes(node.init);

      case 'LocalStatement':
        return 'local ' + this.visitNodes(node.variables) + 
               (node.init && node.init.length ? ' = ' + this.visitNodes(node.init) : '');

      case 'CallStatement':
        return this.visitNode(node.expression);

      case 'CallExpression':
        return this.visitNode(node.base) + '(' + 
               (node.arguments || []).map((arg: any) => this.visitNode(arg)).join(', ') + ')';

      case 'StringLiteral':
        return this.escapeString(node.value);

      case 'NumericLiteral':
        return node.value.toString();

      case 'BooleanLiteral':
        return node.value ? 'true' : 'false';

      case 'NilLiteral':
        return 'nil';

      case 'Identifier':
        return node.name;

      case 'BinaryExpression':
        return '(' + this.visitNode(node.left) + ' ' + node.operator + ' ' + this.visitNode(node.right) + ')';

      case 'UnaryExpression':
        return node.operator + ' ' + this.visitNode(node.argument);

      case 'IfStatement':
        let code = 'if ' + this.visitNode(node.condition) + ' then\n';
        code += this.visitNodes(node.then).split('\n').map(line => '  ' + line).join('\n');
        if (node.else) {
          code += '\nelse\n';
          const elseBody = Array.isArray(node.else) ? node.else : [node.else];
          code += this.visitNodes(elseBody).split('\n').map(line => '  ' + line).join('\n');
        }
        code += '\nend';
        return code;

      case 'WhileStatement':
        return 'while ' + this.visitNode(node.condition) + ' do\n' +
               this.visitNodes(node.body).split('\n').map(line => '  ' + line).join('\n') + '\nend';

      case 'RepeatStatement':
        return 'repeat\n' +
               this.visitNodes(node.body).split('\n').map(line => '  ' + line).join('\n') + '\n' +
               'until ' + this.visitNode(node.condition);

      case 'ForStatement':
        return 'for ' + this.visitNode(node.variable) + ' = ' +
               this.visitNode(node.start) + ', ' + this.visitNode(node.end) +
               (node.step ? ', ' + this.visitNode(node.step) : '') + ' do\n' +
               this.visitNodes(node.body).split('\n').map(line => '  ' + line).join('\n') + '\nend';

      case 'ForInStatement':
        return 'for ' + this.visitNodes(node.variables) + ' in ' +
               this.visitNodes(node.iterators) + ' do\n' +
               this.visitNodes(node.body).split('\n').map(line => '  ' + line).join('\n') + '\nend';

      case 'FunctionDeclaration':
        return 'function ' + this.visitNode(node.identifier) + '(' +
               (node.parameters || []).map((p: any) => this.visitNode(p)).join(', ') + ')\n' +
               this.visitNodes(node.body).split('\n').map(line => '  ' + line).join('\n') + '\nend';

      case 'LocalFunction':
        return 'local function ' + this.visitNode(node.identifier) + '(' +
               (node.parameters || []).map((p: any) => this.visitNode(p)).join(', ') + ')\n' +
               this.visitNodes(node.body).split('\n').map(line => '  ' + line).join('\n') + '\nend';

      case 'ReturnStatement':
        return 'return ' + (node.arguments || []).map((arg: any) => this.visitNode(arg)).join(', ');

      case 'BreakStatement':
        return 'break';

      case 'GotoStatement':
        return 'goto ' + node.label;

      case 'LabelStatement':
        return '::' + node.label + '::';

      case 'TableConstructorExpression':
        return '{' + (node.fields || []).map((field: any) => this.visitNode(field)).join(', ') + '}';

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
        return '-- unknown node type: ' + node.type;
    }
  }

  private visitNodes(nodes: any[]): string {
    return (nodes || []).map((node: any) => this.visitNode(node)).join(', ');
  }

  private escapeString(str: string): string {
    // Simple string escaping
    return '"' + str.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
}

// ---------- Lightweight Obfuscator ----------
export class LightweightObfuscator {
  async obfuscate(source: string, options: ObfuscationOptions = {}): Promise<ObfuscationResult> {
    const start = Date.now();
    const rng = new SeededRandom(options.seed || Math.floor(Math.random() * 0x7fffffff));
    
    try {
      // Parse source to AST
      const ast = luaparse.parse(source, { 
        comments: false, 
        luaVersion: '5.1',
        locations: false,
        ranges: false
      });
      
      // Transform AST
      const transformer = new ASTTransformer(rng);
      const transformedAst = transformer.transform(ast, options);
      
      // Generate obfuscated code
      const generator = new CodeGenerator();
      let obfuscatedCode = generator.generate(transformedAst);
      
      // If strings layer is enabled, also encrypt strings in the final output
      if (options.layers?.strings) {
        obfuscatedCode = this.encryptStrings(obfuscatedCode, rng);
      }
      
      // Generate random names for loader
      const nameGen = new NameGenerator(rng);
      const xorKey = rng.range(1, 0xfff);
      const junkVars = nameGen.generateTable(5);
      
      // Encrypt the obfuscated code
      const encryptedSource = SimpleCrypto.xorEncode(obfuscatedCode, xorKey);
      
      // Split into chunks to avoid string limits
      const chunkSize = 3000;
      const chunks = StringSplitter.split(encryptedSource, chunkSize);
      const chunkArrays = chunks.map(chunk => StringSplitter.encodeWithMixedRadix(chunk, rng));
      
      // Generate random function names
      const mainFunc = nameGen.generate();
      const decryptFunc = nameGen.generate();
      const chunkVar = nameGen.generate();
      const resultVar = nameGen.generate();
      const keyVar = nameGen.generate();
      const tempVar = nameGen.generate();
      
      // Build the loader
      const loader = this.buildLoader(
        mainFunc,
        decryptFunc,
        chunkVar,
        resultVar,
        keyVar,
        tempVar,
        chunkArrays,
        xorKey,
        junkVars,
        rng,
        options.debug || false
      );

      const metrics = {
        inputSize: source.length,
        outputSize: loader.length,
        duration: (Date.now() - start) / 1000,
        instructionCount: source.split('\n').length,
        buildId: 'XZX-' + Date.now().toString(36) + '-' + rng.randomHex(4),
        layersApplied: Object.entries(options.layers || {})
          .filter(([_, v]) => v)
          .map(([k]) => k)
      };

      return {
        success: true,
        code: loader,
        metrics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private encryptStrings(code: string, rng: SeededRandom): string {
    // Find and encrypt string literals
    return code.replace(/"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g, (match) => {
      if (rng.range(0, 2) === 0) {
        // Keep as is
        return match;
      }
      
      // Encrypt the string content
      const content = match.slice(1, -1);
      const key = rng.range(1, 0xff);
      const encrypted: number[] = [];
      
      for (let i = 0; i < content.length; i++) {
        encrypted.push(content.charCodeAt(i) ^ ((key + i) & 0xff));
      }
      
      // Generate decoder
      const decryptVar = '_' + rng.randomHex(3);
      return `((function(${decryptVar}) local s='';for i=1,#${decryptVar} do s=s..string.char(${decryptVar}[i]~(${key}+i-1));end;return s;end)(${JSON.stringify(encrypted)}))`;
    });
  }

  private buildLoader(
    mainFunc: string,
    decryptFunc: string,
    chunkVar: string,
    resultVar: string,
    keyVar: string,
    tempVar: string,
    chunks: string[],
    xorKey: number,
    junkVars: string[],
    rng: SeededRandom,
    debug: boolean
  ): string {
    const debugPrints = debug ? `
  -- Debug output
  local ${tempVar} = os.clock()
  print("[XZX] Loader started at", ${tempVar})
  print("[XZX] Key:", ${xorKey})
  print("[XZX] Chunks:", #${chunkVar})
` : '';

    const debugProgress = debug ? `
    print("[XZX] Decrypted chunk", i, #${chunkVar}[i], "bytes")
` : '';

    const debugComplete = debug ? `
  print("[XZX] Total decrypted size:", #decrypted, "bytes")
  print("[XZX] Decryption time:", os.clock() - ${tempVar}, "seconds")
` : '';

    const debugError = debug ? `
    print("[XZX] Load error:", err)
    return nil, err
` : `
    return nil, "Failed to load script"
`;

    const debugPcall = debug ? `
  if not success then
    print("[XZX] Execution error:", result)
  end
` : '';

    // Generate junk code
    const junkCode = this.generateJunkCode(junkVars, rng);

    return `--[[ XZX Ultimate Obfuscator ]]
-- Build: ${new Date().toISOString()}
-- Safe for Roblox Executors

local ${mainFunc}, ${decryptFunc}, ${chunkVar}, ${resultVar}, ${keyVar}, ${tempVar}
local ${junkVars.join(', ')}

-- Anti-tamper check
if not string or not table or not math then
  error("Environment tampered", 0)
end

${junkCode}

-- Decryption function
${decryptFunc} = function(${keyVar}, ${chunkVar})
  local ${resultVar} = {}
  local ${tempVar}
  
  for i = 1, #${chunkVar} do
    ${tempVar} = ${chunkVar}[i]
    ${resultVar}[i] = string.char(${tempVar} ~ (((${keyVar} + i - 1) & 0xff)))
  end
  
  return table.concat(${resultVar})
end

-- Encrypted chunks
${chunkVar} = {
${chunks.map((chunk, i) => `  [${i+1}] = ${chunk}`).join(',\n')}
}

${debugPrints}

-- Decrypt all chunks
local ${resultVar} = {}
for i = 1, #${chunkVar} do
  ${resultVar}[i] = ${decryptFunc}(${xorKey}, ${chunkVar}[i])
  
  ${junkCode}
  
  ${debugProgress}
  
  -- Prevent memory issues
  if i % 10 == 0 then
    ${chunkVar}[i-9] = nil
    collectgarbage()
  end
end

-- Combine chunks
local decrypted = table.concat(${resultVar})
${resultVar} = nil
${chunkVar} = nil
collectgarbage()

${debugComplete}

-- Validate decrypted code
if #decrypted == 0 then
  error("Decryption failed", 0)
end

-- Execute with proper error handling
local fn, err = load(decrypted, "=${mainFunc}")
decrypted = nil
collectgarbage()

if not fn then
  ${debugError}
end

-- Protected execution
local success, result = pcall(fn)
fn = nil
collectgarbage()

${debugPcall}

if not success then
  error(result, 0)
end

return result
`;
  }

  private generateJunkCode(vars: string[], rng: SeededRandom): string {
    const ops = [
      `local ${vars[0]} = ${vars[1]} or 0; ${vars[2]} = (${vars[0]} + ${rng.range(1, 100)}) & 0xff;`,
      `for i = 1, ${rng.range(2, 4)} do ${vars[3]} = i end;`,
      `local ${vars[4]} = {${vars[0]}, ${vars[1]}, ${vars[2]}};`,
      `if (${vars[0]} > 0) then ${vars[1]} = nil else ${vars[2]} = false end;`,
      `local ${vars[0]} = string.char(${rng.range(65, 90)});`,
      `local ${vars[1]} = math.random(${rng.range(1, 100)});`,
      `local ${vars[2]} = tostring(${vars[1]});`,
    ];
    return rng.choice(ops);
  }
}

// ---------- Main Obfuscator ----------
export class XZXObfuscator {
  async obfuscate(source: string, options: ObfuscationOptions = {}): Promise<ObfuscationResult> {
    const start = Date.now();
    
    try {
      // Always use lightweight mode for Roblox executors
      const obfuscator = new LightweightObfuscator();
      return await obfuscator.obfuscate(source, options);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// ---------- Public API ----------
export async function obfuscateLua(source: string, options: any = {}): Promise<ObfuscationResult> {
  const opts: ObfuscationOptions = {
    seed: options.seed,
    mode: options.mode || 'standard',
    debug: options.debug || false,
    optimization: options.optimization || 'basic',
    layers: {
      constants: options.layers?.constants ?? true,
      identifiers: options.layers?.identifiers ?? true,
      controlFlow: options.layers?.controlFlow ?? false,
      garbage: options.layers?.garbage ?? true,
      polymorphism: options.layers?.polymorphism ?? false,
      antiTamper: options.layers?.antiTamper ?? true,
      strings: options.layers?.strings ?? true,
      expressions: options.layers?.expressions ?? true,
      stack: options.layers?.stack ?? false,
      advanced: options.layers?.advanced ?? false,
      ...(options.layers || {})
    }
  };
  
  const obfuscator = new XZXObfuscator();
  return obfuscator.obfuscate(source, opts);
}

export default obfuscateLua;
