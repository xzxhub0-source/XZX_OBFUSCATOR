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
  static decryptNumber(enc: any): number {
    if (enc.t !== 'n3') return enc;
    const a = (enc.d + enc.k[2]) & 0xffffffff;
    const b = (a ^ enc.k[1]) & 0xffffffff;
    const c = (b >>> 3) | ((b & 7) << 29);
    return (c - enc.k[0]) & 0xffffffff;
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
  static decryptString(enc: any): string {
    if (enc.t !== 's-multi') return enc;
    const reordered: number[][] = [];
    for (let i = 0; i < enc.c.length; i++) {
      const originalIdx = enc.o.indexOf(i);
      reordered[i] = enc.c[originalIdx];
    }
    let result = '';
    for (let i = 0; i < reordered.length; i++) {
      const chunk = reordered[i];
      const key = enc.k[i];
      for (const b of chunk) {
        result += String.fromCharCode(b ^ key);
      }
    }
    return result;
  }
  static encryptBoolean(value: boolean, rng: SeededRandom): any {
    const key = rng.range(1, 255);
    const masked = (value ? 1 : 0) ^ key;
    return { t: 'b', v: masked, k: key };
  }
  static decryptBoolean(enc: any): boolean {
    if (enc.t !== 'b') return enc;
    return (enc.v ^ enc.k) === 1;
  }
}

class IdentifierObfuscator {
  private nameMap: Map<string, string>;
  private rng: SeededRandom;
  private useUnicode: boolean;
  private useInvisible: boolean;
  constructor(rng: SeededRandom, useUnicode: boolean = false, useInvisible: boolean = false) {
    this.nameMap = new Map();
    this.rng = rng;
    this.useUnicode = useUnicode;
    this.useInvisible = useInvisible;
  }
  obfuscate(name: string): string {
    if (this.nameMap.has(name)) return this.nameMap.get(name)!;
    let obfuscated: string;
    const prefixes = ['_0x', '_', '__', 'l_', 'v_', 'f_'];
    const prefix = this.rng.choice(prefixes);
    const suffix = this.rng.range(0x1000, 0xffff).toString(16);
    obfuscated = prefix + suffix;
    if (this.useUnicode && this.rng.range(0, 1) === 1) {
      obfuscated = this.rng.unicodeConfusable() + obfuscated;
    }
    if (this.useInvisible && this.rng.range(0, 2) === 1) {
      obfuscated = obfuscated + this.rng.invisible();
    }
    this.nameMap.set(name, obfuscated);
    return obfuscated;
  }
  reset(): void {
    this.nameMap.clear();
  }
}

class GarbageInjector {
  static insertNOP(bytecode: number[], opMap: OpcodeMap, rng: SeededRandom): void {
    const pos = rng.range(0, bytecode.length);
    bytecode.splice(pos, 0, opMap.get('NOP'));
  }
  static insertDummyPushPop(bytecode: number[], opMap: OpcodeMap, rng: SeededRandom): void {
    const pos = rng.range(0, bytecode.length);
    const dummyConst = rng.range(0, 100);
    const push = [opMap.get('LOADK'), dummyConst & 0xff, (dummyConst >> 8) & 0xff];
    const pop = [opMap.get('POP')];
    for (let i = push.length - 1; i >= 0; i--) {
      bytecode.splice(pos, 0, push[i]);
    }
    bytecode.splice(pos + push.length, 0, pop[0]);
  }
  static insertFakeCall(bytecode: number[], opMap: OpcodeMap, rng: SeededRandom): void {
    const pos = rng.range(0, bytecode.length);
    const fakeFunc = rng.range(0, 10);
    const pushFunc = [opMap.get('LOADK'), fakeFunc & 0xff, (fakeFunc >> 8) & 0xff];
    const call = [opMap.get('CALL'), 0, 0];
    for (let i = pushFunc.length - 1; i >= 0; i--) {
      bytecode.splice(pos, 0, pushFunc[i]);
    }
    bytecode.splice(pos + pushFunc.length, 0, call[0]);
    bytecode.splice(pos + pushFunc.length + 1, 0, call[1]);
    bytecode.splice(pos + pushFunc.length + 2, 0, call[2]);
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

class ControlFlowFlattener {
  static flatten(ir: IRNode, rng: SeededRandom): IRNode {
    const blocks: IRNode[] = [];
    const collect = (node: IRNode) => {
      if (node.type === 'IF' || node.type === 'WHILE' || node.type === 'CHUNK') {
        if (node.children) {
          for (const child of node.children) {
            collect(child);
          }
        }
      } else {
        blocks.push(node);
      }
    };
    collect(ir);
    if (blocks.length <= 1) return ir;
    const stateVar = '__state_' + rng.range(1000, 9999);
    const stateMachine = new IRNode('STATE_MACHINE');
    stateMachine.value = stateVar;
    const stateNodes: IRNode[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const stateBlock = new IRNode('STATE_BLOCK');
      stateBlock.value = i + 1;
      stateBlock.children = [blocks[i]];
      if (i < blocks.length - 1) {
        const assign = new IRNode('ASSIGN');
        assign.children = [new IRNode('IDENT', stateVar), new IRNode('NUMBER', i + 2)];
        stateBlock.children.push(assign);
      }
      stateNodes.push(stateBlock);
    }
    stateMachine.children = stateNodes;
    return stateMachine;
  }
}

class BytecodeCompiler {
  private bytecode: number[] = [];
  private constants: any[] = [];
  private constMap: Map<string, number> = new Map();
  private labels: Map<string, number> = new Map();
  private fixups: Array<{ label: string, positions: number[] }> = [];
  private nextLabel = 0;
  private opMap: OpcodeMap;
  private rng: SeededRandom;
  private layers: any;
  private idObf: IdentifierObfuscator;
  constructor(opMap: OpcodeMap, rng: SeededRandom, layers: any) {
    this.opMap = opMap;
    this.rng = rng;
    this.layers = layers;
    this.idObf = new IdentifierObfuscator(rng, layers.advanced || false, layers.advanced || false);
    this.bytecode = [];
    this.constants = [];
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
    const idx = this.constants.length + 1;
    this.constants[idx] = encrypted;
    this.constMap.set(key, idx);
    return idx;
  }
  emit(op: string, ...args: number[]): void {
    this.bytecode.push(this.opMap.get(op));
    for (const arg of args) {
      this.bytecode.push(arg & 0xff);
      this.bytecode.push((arg >> 8) & 0xff);
    }
    if (this.layers.garbage && this.rng.range(1, 20) > 18) {
      GarbageInjector.insertNOP(this.bytecode, this.opMap, this.rng);
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
    this.nextLabel = this.nextLabel + 1;
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
    if (this.layers.controlFlow && ir.type !== 'STATE_MACHINE') {
      ir = ControlFlowFlattener.flatten(ir, this.rng);
    }
    this.visitIR(ir);
    this.emit('RET');
    if (this.layers.garbage) {
      for (let i = 0; i < this.rng.range(1, 3); i++) {
        GarbageInjector.insertFakeCall(this.bytecode, this.opMap, this.rng);
      }
    }
    this.resolveFixups();
    return { bytecode: this.bytecode, constants: this.constants };
  }
  private visitIR(node: IRNode): void {
    if (!node) return;
    if (this.layers.identifiers && node.type === 'IDENT') {
      node.value = this.idObf.obfuscate(node.value);
    }
    if (node.type === 'CHUNK') {
      if (node.children) {
        for (const c of node.children) {
          this.visitIR(c);
        }
      }
    } else if (node.type === 'STATE_MACHINE') {
      this.compileStateMachine(node);
    } else if (node.type === 'ASSIGN') {
      const half = (node.children?.length || 0) / 2;
      for (let i = half; i < (node.children?.length || 0); i++) {
        this.visitIR(node.children![i]);
      }
      for (let i = 0; i < half; i++) {
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
        for (const c of node.children) {
          this.visitIR(c);
        }
      }
      this.emit('CALL', (node.children?.length || 0) - 1);
    } else if (node.type === 'STRING' || node.type === 'NUMBER' || node.type === 'BOOLEAN') {
      this.emit('LOADK', this.addConstant(node.value));
    } else if (node.type === 'IDENT') {
      this.emit('GETGLOBAL', this.addConstant(node.value));
    } else if (node.type === 'BINARY') {
      this.visitIR(node.left!);
      this.visitIR(node.right!);
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
    } else if (node.type === 'STATE_BLOCK') {
      this.labels.set('STATE_' + node.value, this.bytecode.length);
      if (node.children) {
        for (const c of node.children) {
          this.visitIR(c);
        }
      }
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
  private compileStateMachine(node: IRNode): void {
    const stateVar = node.value;
    this.emit('LOADK', this.addConstant(1));
    this.emit('SETGLOBAL', this.addConstant('__' + stateVar));
    const startLabel = this.label();
    this.emit('GETGLOBAL', this.addConstant('__' + stateVar));
    const jumpTable: string[] = [];
    for (let i = 1; i <= (node.children?.length || 0); i++) {
      jumpTable[i] = 'STATE_' + i;
    }
    for (let i = 1; i <= jumpTable.length; i++) {
      const stateNode = node.children![i - 1];
      this.visitIR(stateNode);
      this.emit('JMP');
      const pos = this.bytecode.length;
      this.bytecode.push(0);
      this.bytecode.push(0);
      const fix = { label: startLabel, positions: [pos] };
      this.fixups.push(fix);
      this.labels.set(jumpTable[i], this.bytecode.length);
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

    // Encrypt bytecode with a key
    const key = rng.bytes(32);
    const encrypted: number[] = [];
    for (let i = 0; i < bytecode.length; i++) {
      encrypted[i] = bytecode[i] ^ key[i % key.length];
    }

    // Generate hash for anti-tamper
    let hash = 0;
    for (let i = 0; i < bytecode.length; i++) {
      hash = ((hash << 5) - hash + bytecode[i]) & 0xffffffff;
    }

    // Get opcode mappings
    const opList = opMap.getAll();
    const dynamicKey = opMap.getDynamicKey();

    // Convert constants to a compact representation
    const constStr = JSON.stringify(constants)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'");

    // Create a mapping of opcodes to their handler indices
    const opHandlerMap: { [key: number]: string } = {};
    for (const [name, num] of opList) {
      opHandlerMap[num] = name;
    }

    // Generate the compact VM
    const vmSource = `--[[ XZX Build: ${buildId} ]]
load=load or loadstring
return load("-- XZX VM\\n"..((function(...)local a={${encrypted.join(',')}}local b=${constStr}local c={${key.join(',')}}local d=${hash}local e=${dynamicKey}local f={${opList.map(([name, num]) => `${num}=${JSON.stringify(name)}`).join(',')}}return(function(...)local g=setmetatable or function(t)return t end local h=getfenv or function()return _ENV end local i=string local j=table local k=unpack or table.unpack local l=math local m=type local n=pcall local o=error local p=rawget local q=rawset local r=next local s=select local t=tonumber local u=tostring local v=0 local w={}local x=1 while x<=#a do local y=a[x]x=x+1 if y==${opMap.get('LOADK')}then local z=a[x]+(a[x+1]<<8)x=x+2 local A=b[z]if m(A)=='table'then if A.t=='s-multi'then local B=''for C=1,#A.c do local D=A.c[C]local E=A.k[C]for F=1,#D do B=B..i.char(D[F]~E)end end A=B elseif A.t=='n3'then local G=(A.d+A.k[3])&0xffffffff local H=(G~A.k[2])&0xffffffff local I=(H>>3)|((H&7)<<29)A=(I-A.k[1])&0xffffffff elseif A.t=='b'then A=(A.v~A.k)==1 end end w[x-1]=A elseif y==${opMap.get('PUSH')}then local z=a[x]+(a[x+1]<<8)x=x+2 w[x-1]=b[z]elseif y==${opMap.get('POP')}then x=x-1 elseif y==${opMap.get('ADD')}then local J=w[x-2]local K=w[x-1]x=x-2 w[x-1]=J+K elseif y==${opMap.get('SUB')}then local J=w[x-2]local K=w[x-1]x=x-2 w[x-1]=J-K elseif y==${opMap.get('MUL')}then local J=w[x-2]local K=w[x-1]x=x-2 w[x-1]=J*K elseif y==${opMap.get('DIV')}then local J=w[x-2]local K=w[x-1]x=x-2 w[x-1]=J/K elseif y==${opMap.get('JMP')}then local L=a[x]+(a[x+1]<<8)x=L+2 elseif y==${opMap.get('JIF')}then local L=a[x]+(a[x+1]<<8)x=x+2 local M=w[x-1]x=x-1 if not M then x=L end elseif y==${opMap.get('CALL')}then local N=a[x]x=x+2 local O=w[x-1]x=x-1 local P={}for Q=1,N do P[N-Q+1]=w[x-1]x=x-1 end local R={O(k(P))}for _,S in ipairs(R)do w[x]=S x=x+1 end elseif y==${opMap.get('RET')}then break end end return w[1]or(w[1]==nil and nil)or w[1]end)end)()".."",nil,"bt")()`;

    // Add final obfuscation layer with hex/binary numbers
    return this.addFinalObfuscationLayer(vmSource, rng);
  }

  private static addFinalObfuscationLayer(code: string, rng: SeededRandom): string {
    // Convert decimal numbers to hex/binary where appropriate
    code = code.replace(/\b(\d+)\b/g, (num) => {
      const n = parseInt(num);
      // Skip small numbers and common indices
      if (n < 10 || n > 10000) return num;
      
      // Randomly choose between hex, binary, or decimal
      const choice = rng.range(0, 2);
      if (choice === 0) {
        return '0x' + n.toString(16);
      } else if (choice === 1) {
        return '0b' + n.toString(2);
      }
      return num;
    });

    // Add junk code and wrap in loader
    const junkVars = ['Y', 'g', 'Z', 'P', 'R', 'x', 'v', 'X', 'V', 'B'];
    const junkValues = junkVars.map(v => rng.range(100, 999));
    const junkCode = junkVars.map((v, i) => `local ${v}=${junkValues[i]}`).join(';');

    // Create the final output with multiple layers of wrapping
    return `(function(...)${junkCode};local function ${String.fromCharCode(rng.range(65, 90))}()${code}end;return ${String.fromCharCode(rng.range(65, 90))}()end)(...)`;
  }
}

export class XZXUltimateObfuscator {
  obfuscate(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
    const start = Date.now();
    const defaultLayers = {
      constants: true,
      identifiers: true,
      controlFlow: true,
      garbage: true,
      polymorphism: true,
      antiTamper: true,
      strings: true,
      expressions: true,
      stack: true,
      advanced: false
    };
    const layers = { ...defaultLayers, ...(options.layers || {}) };
    const rng = new SeededRandom(options.seed);

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
