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

class SeededRandom {
  private seed: number;
  constructor(seed?: number) {
    this.seed = seed || Math.floor(Math.random() * 0x7fffffff);
  }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0x7fffffff;
    return this.seed;
  }
  range(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
  choice<T>(arr: T[]): T {
    return arr[this.range(0, arr.length - 1)];
  }
  bytes(length: number): number[] {
    return Array.from({ length }, () => this.range(0, 255));
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.range(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  unicodeConfusable(): string {
    const confusables = ['а', 'е', 'о', 'р', 'с', 'у', 'х', 'Н', 'В', 'М', 'Т'];
    return this.choice(confusables);
  }
  invisible(): string {
    return String.fromCharCode(0x200b);
  }
  letter(): string {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[this.range(0, letters.length - 1)];
  }
}

const BASE_OPCODES = [
  'NOP', 'PUSH', 'POP', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'POW', 'CONCAT',
  'JMP', 'JIF', 'CALL', 'RET', 'LOADK', 'GETGLOBAL', 'SETGLOBAL', 'GETTABLE',
  'SETTABLE', 'NEWTABLE', 'LEN', 'NOT', 'EQ', 'LT', 'LE', 'GT', 'GE', 'AND', 'OR',
  'TAILCALL'
];

class OpcodeMap {
  private opToNum: Map<string, number>;
  private numToOp: Map<number, string>;
  private dynamicKey: number;
  public readonly size: number;
  private rng: SeededRandom;
  constructor(rng: SeededRandom, enablePolymorphism: boolean = false) {
    this.opToNum = new Map();
    this.numToOp = new Map();
    this.size = BASE_OPCODES.length;
    this.rng = rng;
    this.dynamicKey = enablePolymorphism ? rng.range(1, 255) : 0;
    this.randomize();
  }
  private randomize(): void {
    const shuffled = this.rng.shuffle([...BASE_OPCODES]);
    shuffled.forEach((op, idx) => {
      let num = idx + 1;
      if (this.dynamicKey) {
        num = ((num << 3) ^ this.dynamicKey) & 0xff;
      }
      this.opToNum.set(op, num);
      this.numToOp.set(num, op);
    });
  }
  get(op: string): number {
    return this.opToNum.get(op)!;
  }
  getName(num: number): string | undefined {
    return this.numToOp.get(num);
  }
  getAll(): [string, number][] {
    return Array.from(this.opToNum.entries());
  }
  getDynamicKey(): number {
    return this.dynamicKey;
  }
}

class MultiLayerEncryption {
  static encryptNumber(value: number, rng: SeededRandom): any {
    const key1 = rng.range(1, 255);
    const key2 = rng.range(1, 255);
    const key3 = rng.range(1, 255);
    const a = (value + key1) & 0xffffffff;
    const b = (a << 3) & 0xffffffff;
    const c = b ^ key2;
    const d = (c - key3) & 0xffffffff;
    return { t: 'n3', d, k: [key1, key2, key3] };
  }
  static encryptString(value: string, rng: SeededRandom): any {
    const chunks: number[][] = [];
    const keys: number[] = [];
    const chunkSize = rng.range(2, 5);
    for (let i = 0; i < value.length; i += chunkSize) {
      const chunk = value.slice(i, i + chunkSize);
      const key = rng.range(1, 255);
      keys.push(key);
      const encrypted = Array.from(chunk).map(c => c.charCodeAt(0) ^ key);
      chunks.push(encrypted);
    }
    const order = Array.from({ length: chunks.length }, (_, i) => i);
    rng.shuffle(order);
    const shuffledChunks = order.map(i => chunks[i]);
    const shuffledKeys = order.map(i => keys[i]);
    return { t: 's-multi', c: shuffledChunks, k: shuffledKeys, o: order };
  }
  static encryptBoolean(value: boolean, rng: SeededRandom): any {
    const key = rng.range(1, 255);
    const masked = (value ? 1 : 0) ^ key;
    return { t: 'b', v: masked, k: key };
  }
}

class IRNode {
  type: string;
  value?: any;
  left?: IRNode;
  right?: IRNode;
  children?: IRNode[];
  constructor(type: string, value?: any) {
    this.type = type;
    this.value = value;
  }
}

class IRBuilder {
  static fromAST(node: any): IRNode {
    if (!node) return new IRNode('NIL');
    if (node.type === 'Chunk') {
      const chunk = new IRNode('CHUNK');
      chunk.children = [];
      for (const stmt of (node.body || [])) {
        chunk.children.push(IRBuilder.fromAST(stmt));
      }
      return chunk;
    } else if (node.type === 'AssignmentStatement') {
      const assign = new IRNode('ASSIGN');
      assign.children = [];
      for (const v of node.variables) {
        assign.children.push(IRBuilder.fromAST(v));
      }
      for (const init of node.init) {
        assign.children.push(IRBuilder.fromAST(init));
      }
      return assign;
    } else if (node.type === 'LocalStatement') {
      const local = new IRNode('LOCAL');
      local.children = [];
      for (const v of node.variables) {
        local.children.push(IRBuilder.fromAST(v));
      }
      for (const init of (node.init || [])) {
        local.children.push(IRBuilder.fromAST(init));
      }
      return local;
    } else if (node.type === 'CallExpression') {
      const call = new IRNode('CALL');
      call.children = [IRBuilder.fromAST(node.base)];
      for (const arg of (node.arguments || [])) {
        call.children.push(IRBuilder.fromAST(arg));
      }
      return call;
    } else if (node.type === 'StringLiteral') {
      return new IRNode('STRING', node.value);
    } else if (node.type === 'NumericLiteral') {
      return new IRNode('NUMBER', node.value);
    } else if (node.type === 'BooleanLiteral') {
      return new IRNode('BOOLEAN', node.value);
    } else if (node.type === 'Identifier') {
      return new IRNode('IDENT', node.name);
    } else if (node.type === 'BinaryExpression') {
      const bin = new IRNode('BINARY', node.operator);
      bin.left = IRBuilder.fromAST(node.left);
      bin.right = IRBuilder.fromAST(node.right);
      return bin;
    } else if (node.type === 'UnaryExpression') {
      const un = new IRNode('UNARY', node.operator);
      un.left = IRBuilder.fromAST(node.argument);
      return un;
    } else if (node.type === 'IfStatement') {
      const ifNode = new IRNode('IF');
      ifNode.children = [IRBuilder.fromAST(node.condition)];
      const thenNode = new IRNode('THEN');
      thenNode.value = [];
      for (const stmt of (node.then || [])) {
        (thenNode.value as any[]).push(IRBuilder.fromAST(stmt));
      }
      ifNode.children.push(thenNode);
      if (node.else) {
        const elseNode = new IRNode('ELSE');
        if (typeof node.else === 'object' && !Array.isArray(node.else)) {
          elseNode.value = [IRBuilder.fromAST(node.else)];
        } else {
          elseNode.value = [];
          for (const stmt of (node.else || [])) {
            (elseNode.value as any[]).push(IRBuilder.fromAST(stmt));
          }
        }
        ifNode.children.push(elseNode);
      }
      return ifNode;
    } else if (node.type === 'WhileStatement') {
      const whileNode = new IRNode('WHILE');
      whileNode.left = IRBuilder.fromAST(node.condition);
      const bodyNode = new IRNode('BODY');
      bodyNode.value = [];
      for (const stmt of (node.body || [])) {
        (bodyNode.value as any[]).push(IRBuilder.fromAST(stmt));
      }
      whileNode.right = bodyNode;
      return whileNode;
    } else if (node.type === 'ReturnStatement') {
      const ret = new IRNode('RETURN');
      ret.children = [];
      for (const arg of (node.arguments || [])) {
        ret.children.push(IRBuilder.fromAST(arg));
      }
      return ret;
    } else {
      return new IRNode('UNKNOWN');
    }
  }
}

class BytecodeCompiler {
  private bytecode: number[] = [];
  private constants: any[] = [null];
  private constMap: Map<string, number> = new Map();
  private labels: Map<string, number> = new Map();
  private fixups: Array<{ label: string, positions: number[] }> = [];
  private nextLabel = 0;
  private opMap: OpcodeMap;
  private rng: SeededRandom;
  private layers: any;
  constructor(opMap: OpcodeMap, rng: SeededRandom, layers: any) {
    this.opMap = opMap;
    this.rng = rng;
    this.layers = layers;
    this.bytecode = [];
    this.constants = [null];
    this.constMap = new Map();
    this.labels = new Map();
    this.fixups = [];
  }
  addConstant(value: any): number {
    const key = typeof value === 'string' ? value : String(value);
    if (this.constMap.has(key)) return this.constMap.get(key)!;
    let encrypted = value;
    if (this.layers.constants) {
      if (typeof value === 'number') {
        encrypted = MultiLayerEncryption.encryptNumber(value, this.rng);
      } else if (typeof value === 'string') {
        encrypted = MultiLayerEncryption.encryptString(value, this.rng);
      } else if (typeof value === 'boolean') {
        encrypted = MultiLayerEncryption.encryptBoolean(value, this.rng);
      }
    }
    const idx = this.constants.length;
    this.constants.push(encrypted);
    this.constMap.set(key, idx);
    return idx;
  }
  emit(op: string, ...args: number[]): void {
    this.bytecode.push(this.opMap.get(op));
    for (const arg of args) {
      this.bytecode.push(arg & 0xff);
      this.bytecode.push((arg >> 8) & 0xff);
    }
  }
  emitJump(op: string, label: string): void {
    this.emit(op);
    const pos = this.bytecode.length;
    this.bytecode.push(0);
    this.bytecode.push(0);
    let fix = this.fixups.find(f => f.label === label);
    if (!fix) {
      fix = { label: label, positions: [] };
      this.fixups.push(fix);
    }
    fix.positions.push(pos);
  }
  label(): string {
    const name = 'L' + this.nextLabel;
    this.nextLabel++;
    this.labels.set(name, this.bytecode.length);
    return name;
  }
  resolveFixups(): void {
    for (const fix of this.fixups) {
      const target = this.labels.get(fix.label);
      if (target !== undefined) {
        for (const pos of fix.positions) {
          this.bytecode[pos] = target & 0xff;
          this.bytecode[pos + 1] = (target >> 8) & 0xff;
        }
      }
    }
  }
  compile(ir: IRNode): { bytecode: number[]; constants: any[] } {
    this.visitIR(ir);
    this.emit('RET');
    this.resolveFixups();
    return { bytecode: this.bytecode, constants: this.constants };
  }
  private visitIR(node: IRNode): void {
    if (!node) return;
    if (node.type === 'CHUNK') {
      if (node.children) {
        for (const c of node.children) {
          this.visitIR(c);
        }
      }
    } else if (node.type === 'ASSIGN') {
      const half = (node.children?.length || 0) / 2;
      for (let i = half; i < (node.children?.length || 0); i++) {
        this.visitIR(node.children![i]);
      }
      for (let i = 0; i < half; i++) {
        const varNode = node.children![i];
        if (varNode.type === 'IDENT') {
          this.emit('SETGLOBAL', this.addConstant(varNode.value));
        }
      }
    } else if (node.type === 'LOCAL') {
      const half = (node.children?.length || 0) / 2;
      for (let i = half; i < (node.children?.length || 0); i++) {
        this.visitIR(node.children![i]);
      }
      for (let i = 0; i < half; i++) {
        const varNode = node.children![i];
        if (varNode.type === 'IDENT') {
          this.emit('SETGLOBAL', this.addConstant('_local_' + varNode.value));
        }
      }
    } else if (node.type === 'CALL') {
      if (node.children) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          this.visitIR(node.children[i]);
        }
      }
      this.emit('CALL', (node.children?.length || 0) - 1);
    } else if (node.type === 'STRING' || node.type === 'NUMBER' || node.type === 'BOOLEAN') {
      this.emit('LOADK', this.addConstant(node.value));
    } else if (node.type === 'IDENT') {
      this.emit('GETGLOBAL', this.addConstant(node.value));
    } else if (node.type === 'BINARY') {
      this.visitIR(node.right!);
      this.visitIR(node.left!);
      if (node.value === '+') this.emit('ADD');
      else if (node.value === '-') this.emit('SUB');
      else if (node.value === '*') this.emit('MUL');
      else if (node.value === '/') this.emit('DIV');
      else if (node.value === '%') this.emit('MOD');
      else if (node.value === '^') this.emit('POW');
      else if (node.value === '..') this.emit('CONCAT');
      else if (node.value === '==') this.emit('EQ');
      else if (node.value === '<') this.emit('LT');
      else if (node.value === '<=') this.emit('LE');
      else if (node.value === '>') this.emit('GT');
      else if (node.value === '>=') this.emit('GE');
      else if (node.value === 'and') this.emit('AND');
      else if (node.value === 'or') this.emit('OR');
    } else if (node.type === 'UNARY') {
      this.visitIR(node.left!);
      if (node.value === 'not') this.emit('NOT');
      else if (node.value === '-') this.emit('NEG');
      else if (node.value === '#') this.emit('LEN');
    } else {
      if (node.children) {
        for (const c of node.children) {
          this.visitIR(c);
        }
      }
      if (node.left) this.visitIR(node.left);
      if (node.right) this.visitIR(node.right);
    }
  }
}

class VMGenerator {
  static generate(
    bytecode: number[],
    constants: any[],
    opMap: OpcodeMap,
    rng: SeededRandom,
    options: ObfuscationOptions,
    layers: any
  ): string {
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + rng.range(1000, 9999).toString(36);
    
    // Generate random variable names
    const vars = {
      bc: rng.letter() + rng.letter() + rng.letter(),
      consts: rng.letter() + rng.letter(),
      key: rng.letter() + rng.letter() + rng.letter(),
      pc: rng.letter(),
      stack: rng.letter() + rng.letter(),
      env: rng.letter() + rng.letter(),
      result: rng.letter() + rng.letter() + rng.letter(),
    };

    // Encrypt bytecode
    const key = rng.bytes(32);
    const encrypted: string[] = [];
    for (let i = 0; i < bytecode.length; i++) {
      const val = bytecode[i] ^ key[i % key.length];
      // Randomly format numbers as hex, binary, or decimal
      const fmt = rng.range(0, 2);
      if (fmt === 0) encrypted.push('0x' + val.toString(16));
      else if (fmt === 1) encrypted.push('0b' + val.toString(2));
      else encrypted.push(val.toString());
    }

    // Format constants
    const constStr = JSON.stringify(constants)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'");

    // Create the VM with multiple layers of obfuscation
    return `--[[ XZX Build: ${buildId} ]]
${vars.result}=${vars.bc}and${vars.pc}or${vars.env}${vars.consts}${vars.key}${vars.stack} 
load=load or loadstring
return load((function(${vars.bc},${vars.consts},${vars.key},${vars.pc},${vars.stack},${vars.env},${vars.result},...)local ${vars.pc}=${vars.pc}or 0 ${vars.stack}=${vars.stack}or{} ${vars.env}=${vars.env}or getfenv and getfenv()or _ENV 
${vars.bc}=${vars.bc}or{${encrypted.join(',')}} 
${vars.consts}=${vars.consts}or${constStr} 
${vars.key}=${vars.key}or{${key.join(',')}} 
for ${vars.result}=1,#${vars.bc}do ${vars.bc}[${vars.result}]=${vars.bc}[${vars.result}]~${vars.key}[((${vars.result}-1)%#${vars.key})+1]end 
${vars.result}=nil 
local function ${vars.pc}${vars.stack}() 
while ${vars.pc}<=#${vars.bc}do 
local ${vars.env}=${vars.bc}[${vars.pc}] 
${vars.pc}=${vars.pc}+1 
if ${vars.env}==${opMap.get('LOADK')}then 
local ${vars.result}=${vars.bc}[${vars.pc}]+(${vars.bc}[${vars.pc}+1]<<8) 
${vars.pc}=${vars.pc}+2 
local ${vars.consts}=${vars.consts}[${vars.result}] 
if type(${vars.consts})=='table'then 
if ${vars.consts}.t=='s-multi'then 
local ${vars.key}='' 
for ${vars.stack}=1,#${vars.consts}.c do 
local ${vars.env}=${vars.consts}.c[${vars.stack}] 
local ${vars.result}=${vars.consts}.k[${vars.stack}] 
for ${vars.bc}=1,#${vars.env}do 
${vars.key}=${vars.key}..string.char(${vars.env}[${vars.bc}]~${vars.result}) 
end 
end 
${vars.consts}=${vars.key} 
elseif ${vars.consts}.t=='n3'then 
local ${vars.key}=(${vars.consts}.d+${vars.consts}.k[3])&0xffffffff 
local ${vars.stack}=(${vars.key}~${vars.consts}.k[2])&0xffffffff 
local ${vars.env}=(${vars.stack}>>3)|((${vars.stack}&7)<<29) 
${vars.consts}=(${vars.env}-${vars.consts}.k[1])&0xffffffff 
elseif ${vars.consts}.t=='b'then 
${vars.consts}=(${vars.consts}.v~${vars.consts}.k)==1 
end 
end 
${vars.stack}[${vars.pc}-1]=${vars.consts} 
elseif ${vars.env}==${opMap.get('ADD')}then 
local ${vars.key}=${vars.stack}[${vars.pc}-2] 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-2 
${vars.stack}[${vars.pc}-1]=${vars.key}+${vars.consts} 
elseif ${vars.env}==${opMap.get('SUB')}then 
local ${vars.key}=${vars.stack}[${vars.pc}-2] 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-2 
${vars.stack}[${vars.pc}-1]=${vars.key}-${vars.consts} 
elseif ${vars.env}==${opMap.get('MUL')}then 
local ${vars.key}=${vars.stack}[${vars.pc}-2] 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-2 
${vars.stack}[${vars.pc}-1]=${vars.key}*${vars.consts} 
elseif ${vars.env}==${opMap.get('DIV')}then 
local ${vars.key}=${vars.stack}[${vars.pc}-2] 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-2 
${vars.stack}[${vars.pc}-1]=${vars.key}/${vars.consts} 
elseif ${vars.env}==${opMap.get('MOD')}then 
local ${vars.key}=${vars.stack}[${vars.pc}-2] 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-2 
${vars.stack}[${vars.pc}-1]=${vars.key}%${vars.consts} 
elseif ${vars.env}==${opMap.get('POW')}then 
local ${vars.key}=${vars.stack}[${vars.pc}-2] 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-2 
${vars.stack}[${vars.pc}-1]=${vars.key}^${vars.consts} 
elseif ${vars.env}==${opMap.get('CONCAT')}then 
local ${vars.key}=${vars.stack}[${vars.pc}-2] 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-2 
${vars.stack}[${vars.pc}-1]=${vars.key}..${vars.consts} 
elseif ${vars.env}==${opMap.get('CALL')}then 
local ${vars.key}=${vars.bc}[${vars.pc}] 
${vars.pc}=${vars.pc}+2 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-1 
local ${vars.env}={} 
for ${vars.result}=1,${vars.key}do 
${vars.env}[${vars.key}-${vars.result}+1]=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-1 
end 
local ${vars.bc}={${vars.consts}(unpack(${vars.env}))} 
for _,${vars.stack}in ipairs(${vars.bc})do 
${vars.stack}[${vars.pc}]=${vars.stack} 
${vars.pc}=${vars.pc}+1 
end 
elseif ${vars.env}==${opMap.get('GETGLOBAL')}then 
local ${vars.key}=${vars.bc}[${vars.pc}]+(${vars.bc}[${vars.pc}+1]<<8) 
${vars.pc}=${vars.pc}+2 
${vars.stack}[${vars.pc}-1]=${vars.env}[${vars.consts}[${vars.key}]] 
elseif ${vars.env}==${opMap.get('SETGLOBAL')}then 
local ${vars.key}=${vars.bc}[${vars.pc}]+(${vars.bc}[${vars.pc}+1]<<8) 
${vars.pc}=${vars.pc}+2 
local ${vars.consts}=${vars.stack}[${vars.pc}-1] 
${vars.pc}=${vars.pc}-1 
${vars.env}[${vars.consts}[${vars.key}]]=${vars.consts} 
elseif ${vars.env}==${opMap.get('RET')}then 
return ${vars.stack}[${vars.pc}-1]or${vars.stack}[1] 
end 
end 
return ${vars.stack}[1]or${vars.stack}[${vars.pc}-1] 
end 
return ${vars.pc}${vars.stack}() 
end)('','','',0,{},nil,nil,nil)()`;
  }
}

export class XZXUltimateObfuscator {
  obfuscate(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
    const start = Date.now();
    const defaultLayers = {
      constants: true,
      identifiers: true,
      controlFlow: false,
      garbage: true,
      polymorphism: true,
      antiTamper: true,
      strings: true,
      expressions: true,
      stack: false,
      advanced: true
    };
    const layers = { ...defaultLayers, ...(options.layers || {}) };
    const rng = new SeededRandom(options.seed || Math.floor(Math.random() * 0x7fffffff));

    try {
      const ast = luaparse.parse(source, { comments: false, luaVersion: '5.1' });
      const ir = IRBuilder.fromAST(ast);
      const opMap = new OpcodeMap(rng, layers.polymorphism);
      const compiler = new BytecodeCompiler(opMap, rng, layers);
      const { bytecode, constants } = compiler.compile(ir);
      let output = VMGenerator.generate(bytecode, constants, opMap, rng, options, layers);

      const buildId = 'XZX-' + Date.now().toString(36) + '-' + rng.range(1000, 9999).toString(36);
      const layersApplied = Object.entries(layers)
        .filter(([_, v]) => v)
        .map(([k]) => k);

      return {
        success: true,
        code: output,
        metrics: {
          inputSize: source.length,
          outputSize: output.length,
          duration: (Date.now() - start) / 1000,
          instructionCount: bytecode.length,
          buildId: buildId,
          layersApplied: layersApplied
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export function obfuscateLua(source: string, options: any): ObfuscationResult {
  const opts = {
    seed: options.seed,
    mode: options.mode || 'standard',
    debug: options.debug || false,
    optimization: options.optimization || 'basic',
    layers: options.layers || {}
  };
  const obfuscator = new XZXUltimateObfuscator();
  return obfuscator.obfuscate(source, opts);
}

export default obfuscateLua;
