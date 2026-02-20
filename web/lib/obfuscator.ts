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
    const confusables = ['а','е','о','р','с','у','х','Н','В','М','Т'];
    return this.choice(confusables);
  }
  invisible(): string {
    return String.fromCharCode(0x200b);
  }
}

const BASE_OPCODES = [
  'NOP','PUSH','POP','ADD','SUB','MUL','DIV','MOD','POW','CONCAT',
  'JMP','JIF','CALL','RET','LOADK','GETGLOBAL','SETGLOBAL','GETTABLE',
  'SETTABLE','NEWTABLE','LEN','NOT','EQ','LT','LE','GT','GE','AND','OR',
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
  static encryptBoolean(value: boolean, rng: SeededRandom): any {
    const key = rng.range(1, 255);
    const masked = (value ? 1 : 0) ^ key;
    return { t: 'b', v: masked, k: key };
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
    if (this.useUnicode && this.rng.range(0, 1) == 1) {
      obfuscated = this.rng.unicodeConfusable() + obfuscated;
    }
    if (this.useInvisible && this.rng.range(0, 2) == 1) {
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
    bytecode.splice(pos, 0, ...push, ...pop);
  }
  static insertFakeCall(bytecode: number[], opMap: OpcodeMap, rng: SeededRandom): void {
    const pos = rng.range(0, bytecode.length);
    const fakeFunc = rng.range(0, 10);
    const pushFunc = [opMap.get('LOADK'), fakeFunc & 0xff, (fakeFunc >> 8) & 0xff];
    const call = [opMap.get('CALL'), 0, 0];
    bytecode.splice(pos, 0, ...pushFunc, ...call);
  }
}

class ExpressionObfuscator {
  static obfuscateBinary(left: string, right: string, op: string, rng: SeededRandom): string {
    const mode = rng.range(0, 2);
    if (op == '+') {
      if (mode == 0) {
        return '((' + left + ' << 1) + (' + right + ' >> 1) + ((' + left + ' & ' + right + ') % 3))';
      } else if (mode == 1) {
        return '((' + left + ' ^ ' + right + ') + ((' + left + ' & ' + right + ') << 1))';
      } else {
        return '(' + left + ' + ' + right + ')';
      }
    } else if (op == '-') {
      if (mode == 0) {
        return '((' + left + ' << 2) - (' + right + ' << 1) - (' + left + ' & ' + right + '))';
      } else {
        return '(' + left + ' - ' + right + ')';
      }
    } else if (op == '*') {
      if (mode == 0) {
        return '(((' + left + ' << 3) - ' + left + ') * (' + right + ' >> 1))';
      } else {
        return '(' + left + ' * ' + right + ')';
      }
    } else if (op == '/') {
      return '(' + left + ' / ' + right + ')';
    } else if (op == '%') {
      return '(' + left + ' % ' + right + ')';
    } else if (op == '^') {
      return '(' + left + ' ^ ' + right + ')';
    } else if (op == '..') {
      return '(' + left + ' .. ' + right + ')';
    } else if (op == '==') {
      return '(' + left + ' == ' + right + ')';
    } else if (op == '<') {
      return '(' + left + ' < ' + right + ')';
    } else if (op == '<=') {
      return '(' + left + ' <= ' + right + ')';
    } else if (op == '>') {
      return '(' + left + ' > ' + right + ')';
    } else if (op == '>=') {
      return '(' + left + ' >= ' + right + ')';
    } else if (op == 'and') {
      return '(' + left + ' and ' + right + ')';
    } else if (op == 'or') {
      return '(' + left + ' or ' + right + ')';
    } else {
      return '(' + left + ' ' + op + ' ' + right + ')';
    }
  }
  static obfuscateUnary(expr: string, op: string, rng: SeededRandom): string {
    if (op == 'not') {
      if (rng.range(0, 1) == 0) {
        return '(not ' + expr + ')';
      } else {
        return '(' + expr + ' == false)';
      }
    } else if (op == '-') {
      return '(-' + expr + ')';
    } else if (op == '#') {
      return '(#' + expr + ')';
    } else {
      return op + expr;
    }
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
    if (node.type == 'Chunk') {
      const chunk = new IRNode('CHUNK');
      chunk.children = [];
      for (let i = 0; i < (node.body || []).length; i++) {
        const stmt = node.body[i];
        chunk.children.push(IRBuilder.fromAST(stmt));
      }
      return chunk;
    } else if (node.type == 'AssignmentStatement') {
      const assign = new IRNode('ASSIGN');
      assign.children = [];
      for (let i = 0; i < node.variables.length; i++) {
        assign.children.push(IRBuilder.fromAST(node.variables[i]));
      }
      for (let i = 0; i < node.init.length; i++) {
        assign.children.push(IRBuilder.fromAST(node.init[i]));
      }
      return assign;
    } else if (node.type == 'LocalStatement') {
      const local = new IRNode('LOCAL');
      local.children = [];
      for (let i = 0; i < node.variables.length; i++) {
        local.children.push(IRBuilder.fromAST(node.variables[i]));
      }
      for (let i = 0; i < (node.init || []).length; i++) {
        local.children.push(IRBuilder.fromAST(node.init[i]));
      }
      return local;
    } else if (node.type == 'CallExpression') {
      const call = new IRNode('CALL');
      call.children = [IRBuilder.fromAST(node.base)];
      for (let i = 0; i < (node.arguments || []).length; i++) {
        call.children.push(IRBuilder.fromAST(node.arguments[i]));
      }
      return call;
    } else if (node.type == 'StringLiteral') {
      return new IRNode('STRING', node.value);
    } else if (node.type == 'NumericLiteral') {
      return new IRNode('NUMBER', node.value);
    } else if (node.type == 'BooleanLiteral') {
      return new IRNode('BOOLEAN', node.value);
    } else if (node.type == 'Identifier') {
      return new IRNode('IDENT', node.name);
    } else if (node.type == 'BinaryExpression') {
      const bin = new IRNode('BINARY', node.operator);
      bin.left = IRBuilder.fromAST(node.left);
      bin.right = IRBuilder.fromAST(node.right);
      return bin;
    } else if (node.type == 'UnaryExpression') {
      const un = new IRNode('UNARY', node.operator);
      un.left = IRBuilder.fromAST(node.argument);
      return un;
    } else if (node.type == 'IfStatement') {
      const ifNode = new IRNode('IF');
      ifNode.children = [IRBuilder.fromAST(node.condition)];
      const thenNode = new IRNode('THEN');
      thenNode.value = [];
      for (let i = 0; i < node.then.length; i++) {
        thenNode.value.push(IRBuilder.fromAST(node.then[i]));
      }
      ifNode.children.push(thenNode);
      if (node.else) {
        const elseNode = new IRNode('ELSE');
        if (typeof node.else == 'object' && !Array.isArray(node.else)) {
          elseNode.value = [IRBuilder.fromAST(node.else)];
        } else {
          elseNode.value = [];
          for (let i = 0; i < node.else.length; i++) {
            elseNode.value.push(IRBuilder.fromAST(node.else[i]));
          }
        }
        ifNode.children.push(elseNode);
      }
      return ifNode;
    } else if (node.type == 'WhileStatement') {
      const whileNode = new IRNode('WHILE');
      whileNode.left = IRBuilder.fromAST(node.condition);
      const bodyNode = new IRNode('BODY');
      bodyNode.value = [];
      for (let i = 0; i < node.body.length; i++) {
        bodyNode.value.push(IRBuilder.fromAST(node.body[i]));
      }
      whileNode.right = bodyNode;
      return whileNode;
    } else if (node.type == 'ReturnStatement') {
      const ret = new IRNode('RETURN');
      ret.children = [];
      for (let i = 0; i < (node.arguments || []).length; i++) {
        ret.children.push(IRBuilder.fromAST(node.arguments[i]));
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
      if (node.type == 'IF' || node.type == 'WHILE' || node.type == 'CHUNK') {
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            collect(node.children[i]);
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
  private fixups: Array<{label: string, positions: number[]}> = [];
  private nextLabel: number = 0;
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
    const key = typeof value == 'string' ? value : String(value);
    if (this.constMap.has(key)) return this.constMap.get(key)!;
    let encrypted = value;
    if (this.layers.constants) {
      if (typeof value == 'number') {
        encrypted = MultiLayerEncryption.encryptNumber(value, this.rng);
      } else if (typeof value == 'string') {
        encrypted = MultiLayerEncryption.encryptString(value, this.rng);
      } else if (typeof value == 'boolean') {
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
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
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
    let fix: {label: string, positions: number[]} | undefined;
    for (let i = 0; i < this.fixups.length; i++) {
      if (this.fixups[i].label == label) {
        fix = this.fixups[i];
        break;
      }
    }
    if (!fix) {
      fix = {label: label, positions: []};
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
    for (let i = 0; i < this.fixups.length; i++) {
      const fix = this.fixups[i];
      const target = this.labels.get(fix.label);
      if (target !== undefined) {
        for (let j = 0; j < fix.positions.length; j++) {
          const pos = fix.positions[j];
          this.bytecode[pos] = target & 0xff;
          this.bytecode[pos + 1] = (target >> 8) & 0xff;
        }
      }
    }
  }
  compile(ir: IRNode): { bytecode: number[]; constants: any[] } {
    if (this.layers.controlFlow && ir.type != 'STATE_MACHINE') {
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
    return {bytecode: this.bytecode, constants: this.constants};
  }
  private visitIR(node: IRNode): void {
    if (!node) return;
    if (this.layers.identifiers && node.type == 'IDENT') {
      node.value = this.idObf.obfuscate(node.value);
    }
    if (node.type == 'CHUNK') {
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          this.visitIR(node.children[i]);
        }
      }
    } else if (node.type == 'STATE_MACHINE') {
      this.compileStateMachine(node);
    } else if (node.type == 'ASSIGN') {
      const half = node.children!.length / 2;
      for (let i = half; i < node.children!.length; i++) {
        this.visitIR(node.children![i]);
      }
      for (let i = 0; i < half; i++) {
        this.visitIR(node.children![i]);
      }
      for (let i = 0; i < half; i++) {
        const varNode = node.children![i];
        if (varNode.type == 'IDENT') {
          this.emit('SETGLOBAL', this.addConstant(varNode.value));
        }
      }
    } else if (node.type == 'LOCAL') {
      const half = node.children!.length / 2;
      for (let i = half; i < node.children!.length; i++) {
        this.visitIR(node.children![i]);
      }
      for (let i = 0; i < half; i++) {
        this.visitIR(node.children![i]);
      }
      for (let i = 0; i < half; i++) {
        const varNode = node.children![i];
        if (varNode.type == 'IDENT') {
          this.emit('SETGLOBAL', this.addConstant('_local_' + varNode.value));
        }
      }
    } else if (node.type == 'CALL') {
      for (let i = 0; i < node.children!.length; i++) {
        this.visitIR(node.children![i]);
      }
      this.emit('CALL', node.children!.length - 1);
    } else if (node.type == 'STRING' || node.type == 'NUMBER' || node.type == 'BOOLEAN') {
      this.emit('LOADK', this.addConstant(node.value));
    } else if (node.type == 'IDENT') {
      this.emit('GETGLOBAL', this.addConstant(node.value));
    } else if (node.type == 'BINARY') {
      this.visitIR(node.left!);
      this.visitIR(node.right!);
      if (node.value == '+') this.emit('ADD');
      else if (node.value == '-') this.emit('SUB');
      else if (node.value == '*') this.emit('MUL');
      else if (node.value == '/') this.emit('DIV');
      else if (node.value == '%') this.emit('MOD');
      else if (node.value == '^') this.emit('POW');
      else if (node.value == '..') this.emit('CONCAT');
      else if (node.value == '==') this.emit('EQ');
      else if (node.value == '<') this.emit('LT');
      else if (node.value == '<=') this.emit('LE');
      else if (node.value == '>') this.emit('GT');
      else if (node.value == '>=') this.emit('GE');
      else if (node.value == 'and') this.emit('AND');
      else if (node.value == 'or') this.emit('OR');
    } else if (node.type == 'UNARY') {
      this.visitIR(node.left!);
      if (node.value == 'not') this.emit('NOT');
      else if (node.value == '-') this.emit('NEG');
      else if (node.value == '#') this.emit('LEN');
    } else if (node.type == 'STATE_BLOCK') {
      this.labels.set('STATE_' + node.value, this.bytecode.length);
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          this.visitIR(node.children[i]);
        }
      }
    } else {
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          this.visitIR(node.children[i]);
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
    for (let i = 0; i < (node.children || []).length; i++) {
      jumpTable[i] = 'STATE_' + (i + 1);
    }
    for (let i = 0; i < jumpTable.length; i++) {
      const caseLabel = this.label();
      const stateNode = node.children![i];
      this.visitIR(stateNode);
      this.emit('JMP');
      const pos = this.bytecode.length;
      this.bytecode.push(0);
      this.bytecode.push(0);
      const fix = {label: startLabel, positions: [pos]};
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
    const buildId = 'XZX-' + Date.now() + '-' + rng.range(1000, 9999);
    const key = rng.bytes(32);
    const encrypted: number[] = [];
    for (let i = 0; i < bytecode.length; i++) {
      encrypted[i] = bytecode[i] ^ key[(i) % key.length];
    }
    let hash = 0;
    for (let i = 0; i < bytecode.length; i++) {
      hash = ((hash << 5) - hash + bytecode[i]) & 0xffffffff;
    }
    const opList = opMap.getAll();
    const dynamicKey = opMap.getDynamicKey();
    
    const constStr = this.convertToLuaTable(constants);
    
    const mode = options.mode || 'standard';
    let envSetup = '';
    if (mode == 'isolated') {
      envSetup = 'local env = {}\n  setmetatable(env, {__index = getfenv and getfenv() or _ENV})';
    } else if (mode == 'sandbox') {
      envSetup = 'local env = {print=print, string=string, table=table}';
    } else {
      envSetup = 'local env = getfenv and getfenv() or _ENV';
    }
    if (layers.stack) {
      envSetup = envSetup + '\nlocal stackA = {}\nlocal stackB = {}\nlocal stackIdx = 1';
    }
    const debugMode = options.debug ? '\n  local function debugLog(...)\n    print("[XZX VM]", ...)\n  end' : '';
    
    const bitOps = layers.antiTamper || layers.strings ? 
    '\nlocal function bxor(a, b)\n  local result = 0\n  local bitval = 1\n  while a > 0 or b > 0 do\n    if (a % 2) ~= (b % 2) then\n      result = result + bitval\n    end\n    a = math.floor(a / 2)\n    b = math.floor(b / 2)\n    bitval = bitval * 2\n  end\n  return result\nend\n\nlocal function band(a, b)\n  local result = 0\n  local bitval = 1\n  while a > 0 and b > 0 do\n    if (a % 2) == 1 and (b % 2) == 1 then\n      result = result + bitval\n    end\n    a = math.floor(a / 2)\n    b = math.floor(b / 2)\n    bitval = bitval * 2\n  end\n  return result\nend\n\nlocal function lshift(a, b)\n  return a * (2 ^ b)\nend\n\nlocal function rshift(a, b)\n  return math.floor(a / (2 ^ b))\nend\n\nlocal function bit_and_7(x)\n  return x % 128\nend' : '';
    
    const antiTamper = layers.antiTamper ? 
    '\nlocal function validate()\n  local h = 0\n  for i = 1, #bytecode do\n    h = ((h * 32) - h + bytecode[i]) % 4294967296\n  end\n  if h ~= expectedHash then\n    error("Integrity violation: " .. tostring(h) .. " vs " .. expectedHash)\n  end\nend' : '';
    
    const stringDecrypt = layers.strings ? 
    '\nlocal function getConst(idx)\n  local c = consts[idx]\n  if type(c) == "table" then\n    if c.t == "s-multi" then\n      local result = ""\n      for i = 1, #c.c do\n        local chunk = c.c[i]\n        local key = c.k[i]\n        for j = 1, #chunk do\n          result = result .. string.char(bxor(chunk[j], key))\n        end\n      end\n      return result\n    elseif c.t == "n3" then\n      local a = (c.d + c.k[3]) % 4294967296\n      local b = bxor(a, c.k[2])\n      local c2 = rshift(b, 3) + band(lshift(band(b, 7), 29), 4294967295)\n      return (c2 - c.k[1]) % 4294967296\n    elseif c.t == "b" then\n      return bxor(c.v, c.k) == 1\n    end\n  end\n  return c\nend' : 
    '\nlocal function getConst(idx)\n  return consts[idx]\nend';
    
    const stackOps = layers.stack ? 
    '\nlocal function push(v)\n  if stackIdx == 1 then\n    table.insert(stackA, v)\n  else\n    table.insert(stackB, v)\n  end\n  stackIdx = 3 - stackIdx\nend\nlocal function pop()\n  stackIdx = 3 - stackIdx\n  if stackIdx == 1 then\n    return table.remove(stackA)\n  else\n    return table.remove(stackB)\n  end\nend' : 
    '\nlocal function push(v) table.insert(stack, v) end\nlocal function pop() return table.remove(stack) end';
    
    const handlerBodies: {[key: string]: string} = {
      NOP: '',
      PUSH: 'local idx = bytecode[pc] + (bytecode[pc+1] * 256); pc = pc + 2; push(getConst(idx))',
      POP: 'pop()',
      ADD: 'local b = pop(); local a = pop(); push(a + b)',
      SUB: 'local b = pop(); local a = pop(); push(a - b)',
      MUL: 'local b = pop(); local a = pop(); push(a * b)',
      DIV: 'local b = pop(); local a = pop(); push(a / b)',
      MOD: 'local b = pop(); local a = pop(); push(a % b)',
      POW: 'local b = pop(); local a = pop(); push(a ^ b)',
      CONCAT: 'local b = pop(); local a = pop(); push(a .. b)',
      JMP: 'local target = bytecode[pc] + (bytecode[pc+1] * 256); pc = target + 2',
      JIF: 'local target = bytecode[pc] + (bytecode[pc+1] * 256); pc = pc + 2; local cond = pop(); if not cond then pc = target end',
      CALL: 'local nargs = bytecode[pc]; pc = pc + 2; local func = pop(); local args = {}; for i = 1, nargs do args[nargs - i + 1] = pop() end; local results = {func(unpack(args))}; for _, v in ipairs(results) do push(v) end',
      RET: 'pc = #bytecode + 1',
      LOADK: 'local idx = bytecode[pc] + (bytecode[pc+1] * 256); pc = pc + 2; push(getConst(idx))',
      GETGLOBAL: 'local idx = bytecode[pc] + (bytecode[pc+1] * 256); pc = pc + 2; local name = getConst(idx); push(env[name])',
      SETGLOBAL: 'local idx = bytecode[pc] + (bytecode[pc+1] * 256); pc = pc + 2; local val = pop(); env[getConst(idx)] = val',
      GETTABLE: 'local key = pop(); local tbl = pop(); push(tbl[key])',
      SETTABLE: 'local val = pop(); local key = pop(); local tbl = pop(); tbl[key] = val',
      NEWTABLE: 'push({})',
      LEN: 'local a = pop(); push(#a)',
      NOT: 'local a = pop(); push(not a)',
      EQ: 'local b = pop(); local a = pop(); push(a == b)',
      LT: 'local b = pop(); local a = pop(); push(a < b)',
      LE: 'local b = pop(); local a = pop(); push(a <= b)',
      GT: 'local b = pop(); local a = pop(); push(a > b)',
      GE: 'local b = pop(); local a = pop(); push(a >= b)',
      AND: 'local b = pop(); local a = pop(); push(a and b)',
      OR: 'local b = pop(); local a = pop(); push(a or b)',
      TAILCALL: 'local nargs = bytecode[pc]; pc = pc + 2; local func = pop(); local args = {}; for i = 1, nargs do args[nargs - i + 1] = pop() end; return func(unpack(args))',
    };
    
    const handlers: string[] = [];
    for (const name in handlerBodies) {
      const body = handlerBodies[name];
      const nums: number[] = [];
      for (let i = 0; i < opList.length; i++) {
        if (opList[i][0] == name) {
          nums.push(opList[i][1]);
        }
      }
      for (let i = 0; i < nums.length; i++) {
        handlers.push('  [' + nums[i] + '] = function() ' + body + ' end');
      }
    }
    
    const handlerStr = handlers.join(',\n');
    const antiTamperCheck = layers.antiTamper ? 'validate()' : '';
    
    const opMapEntries: string[] = [];
    for (let i = 0; i < opList.length; i++) {
      opMapEntries.push('  ["' + opList[i][0] + '"] = ' + opList[i][1]);
    }
    
    const xorDecrypt = layers.antiTamper || layers.strings ? 'bxor' : '~';
    
    return '-- PROTECTED USING XZX OBFUSCATOR V2 [https://discord.gg/5q5bEKmYqF]\n\n' +
           '--[[ XZX Build: ' + buildId + ']]\n' +
           'local env\n' + 
           envSetup + '\n' + 
           debugMode + '\n' + 
           bitOps + '\n' +
           'local bytecode = {' + encrypted.join(',') + '}\n' +
           'local consts = ' + constStr + '\n' +
           'local key = {' + key.join(',') + '}\n' +
           'local expectedHash = ' + hash + '\n' +
           'local pc = 1\n' +
           'local stack = {}\n' + 
           stackOps + '\n' +
           'local opMap = {\n' + opMapEntries.join(',\n') + '\n}\n' +
           'for i = 1, #bytecode do\n' +
           '  bytecode[i] = ' + xorDecrypt + '(bytecode[i], key[((i-1) % #key) + 1])\n' +
           'end\n' + 
           stringDecrypt + '\n' + 
           antiTamper + '\n' +
           'local handlers = {\n' + handlerStr + '\n}\n' +
           'if ' + String(layers.antiTamper) + ' then\n' +
           '  ' + antiTamperCheck + '\n' +
           'end\n' +
           'while pc <= #bytecode do\n' +
           '  local op = bytecode[pc]\n' +
           '  pc = pc + 1\n' +
           '  local handler = handlers[op]\n' +
           '  if handler then\n' +
           '    handler()\n' +
           '  else\n' +
           '    error("Invalid opcode: " .. op)\n' +
           '  end\n' +
           'end\n' +
           'return stack[1] or (stackA and stackA[1]) or nil\n';
  }

  private static convertToLuaTable(obj: any, indent: number = 0): string {
    if (obj === null || obj === undefined) {
      return 'nil';
    }
    
    if (typeof obj === 'number') {
      return obj.toString();
    }
    
    if (typeof obj === 'string') {
      return '"' + obj.replace(/"/g, '\\"') + '"';
    }
    
    if (typeof obj === 'boolean') {
      return obj ? 'true' : 'false';
    }
    
    if (Array.isArray(obj)) {
      const items: string[] = [];
      let isSequential = true;
      for (let i = 0; i < obj.length; i++) {
        if (obj[i] !== undefined) {
          items.push(this.convertToLuaTable(obj[i], indent + 1));
        } else {
          isSequential = false;
        }
      }
      
      if (isSequential && obj.length > 0) {
        return '{' + items.join(', ') + '}';
      } else {
        const pairs: string[] = [];
        for (let i = 0; i < obj.length; i++) {
          if (obj[i] !== undefined) {
            pairs.push('[' + (i + 1) + '] = ' + this.convertToLuaTable(obj[i], indent + 1));
          }
        }
        return '{' + pairs.join(', ') + '}';
      }
    }
    
    if (typeof obj === 'object') {
      const pairs: string[] = [];
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            pairs.push(key + ' = ' + this.convertToLuaTable(obj[key], indent + 1));
          } else {
            pairs.push('["' + key + '"] = ' + this.convertToLuaTable(obj[key], indent + 1));
          }
        }
      }
      return '{' + pairs.join(', ') + '}';
    }
    
    return 'nil';
  }
}

export class XZXUltimateObfuscator {
  obfuscate(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
    const start = Date.now() / 1000;
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
    const layers = {...defaultLayers};
    if (options.layers) {
      for (const k in options.layers) {
        (layers as any)[k] = (options.layers as any)[k];
      }
    }
    const rng = new SeededRandom(options.seed);
    
    try {
      const ast = luaparse.parse(source, {comments: false, luaVersion: '5.1'});
      const ir = IRBuilder.fromAST(ast);
      const opMap = new OpcodeMap(rng, layers.polymorphism);
      const compiler = new BytecodeCompiler(opMap, rng, layers);
      const {bytecode, constants} = compiler.compile(ir);
      const output = VMGenerator.generate(bytecode, constants, opMap, rng, options, layers);
      const buildId = 'XZX-' + Date.now() + '-' + rng.range(1000, 9999);
      const layersApplied: string[] = [];
      for (const k in layers) {
        if ((layers as any)[k]) layersApplied.push(k);
      }
      return {
        success: true,
        code: output,
        metrics: {
          inputSize: source.length,
          outputSize: output.length,
          duration: (Date.now() / 1000) - start,
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
