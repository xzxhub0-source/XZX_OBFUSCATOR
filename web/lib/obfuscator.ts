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
      for (const b of chunk) result += String.fromCharCode(b ^ key);
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
    const prefix = this.rng.choice(['_0x', '_', '__', 'l_', 'v_', 'f_']);
    const suffix = this.rng.range(0x1000, 0xffff).toString(16);
    obfuscated = `${prefix}${suffix}`;
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
    switch (op) {
      case '+':
        if (mode === 0) return `((${left} << 1) + (${right} >> 1) + ((${left} & ${right}) % 3))`;
        if (mode === 1) return `((${left} ^ ${right}) + ((${left} & ${right}) << 1))`;
        return `(${left} + ${right})`;
      case '-':
        if (mode === 0) return `((${left} << 2) - (${right} << 1) - (${left} & ${right}))`;
        return `(${left} - ${right})`;
      case '*':
        if (mode === 0) return `(((${left} << 3) - ${left}) * (${right} >> 1))`;
        return `(${left} * ${right})`;
      case '/':
        return `(${left} / ${right})`;
      case '%':
        return `(${left} % ${right})`;
      case '^':
        return `(${left} ^ ${right})`;
      case '..':
        return `(${left} .. ${right})`;
      case '==':
        return `(${left} == ${right})`;
      case '<':
        return `(${left} < ${right})`;
      case '<=':
        return `(${left} <= ${right})`;
      case '>':
        return `(${left} > ${right})`;
      case '>=':
        return `(${left} >= ${right})`;
      case 'and':
        return `(${left} and ${right})`;
      case 'or':
        return `(${left} or ${right})`;
      default:
        return `(${left} ${op} ${right})`;
    }
  }
  static obfuscateUnary(expr: string, op: string, rng: SeededRandom): string {
    if (op === 'not') {
      if (rng.range(0, 1) === 0) return `(not ${expr})`;
      return `(${expr} == false)`;
    }
    if (op === '-') return `(-${expr})`;
    if (op === '#') return `(#${expr})`;
    return `${op}${expr}`;
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
    switch (node.type) {
      case 'Chunk':
        const chunk = new IRNode('CHUNK');
        chunk.children = (node.body || []).map((s: any) => IRBuilder.fromAST(s));
        return chunk;
      case 'AssignmentStatement':
        const assign = new IRNode('ASSIGN');
        assign.children = [
          ...node.variables.map((v: any) => IRBuilder.fromAST(v)),
          ...node.init.map((i: any) => IRBuilder.fromAST(i))
        ];
        return assign;
      case 'LocalStatement':
        const local = new IRNode('LOCAL');
        local.children = [
          ...node.variables.map((v: any) => IRBuilder.fromAST(v)),
          ...(node.init || []).map((i: any) => IRBuilder.fromAST(i))
        ];
        return local;
      case 'CallExpression':
        const call = new IRNode('CALL');
        call.children = [
          IRBuilder.fromAST(node.base),
          ...(node.arguments || []).map((a: any) => IRBuilder.fromAST(a))
        ];
        return call;
      case 'StringLiteral':
        return new IRNode('STRING', node.value);
      case 'NumericLiteral':
        return new IRNode('NUMBER', node.value);
      case 'BooleanLiteral':
        return new IRNode('BOOLEAN', node.value);
      case 'Identifier':
        return new IRNode('IDENT', node.name);
      case 'BinaryExpression':
        const bin = new IRNode('BINARY', node.operator);
        bin.left = IRBuilder.fromAST(node.left);
        bin.right = IRBuilder.fromAST(node.right);
        return bin;
      case 'UnaryExpression':
        const un = new IRNode('UNARY', node.operator);
        un.left = IRBuilder.fromAST(node.argument);
        return un;
      case 'IfStatement':
        const ifNode = new IRNode('IF');
        ifNode.children = [
          IRBuilder.fromAST(node.condition),
          new IRNode('THEN', node.then.map((s: any) => IRBuilder.fromAST(s))),
          ...(node.else ? [new IRNode('ELSE', Array.isArray(node.else) ?
            node.else.map((s: any) => IRBuilder.fromAST(s)) :
            [IRBuilder.fromAST(node.else)])] : [])
        ];
        return ifNode;
      case 'WhileStatement':
        const whileNode = new IRNode('WHILE');
        whileNode.left = IRBuilder.fromAST(node.condition);
        whileNode.right = new IRNode('BODY', node.body.map((s: any) => IRBuilder.fromAST(s)));
        return whileNode;
      case 'ReturnStatement':
        const ret = new IRNode('RETURN');
        ret.children = (node.arguments || []).map((a: any) => IRBuilder.fromAST(a));
        return ret;
      default:
        return new IRNode('UNKNOWN');
    }
  }
}
class ControlFlowFlattener {
  static flatten(ir: IRNode, rng: SeededRandom): IRNode {
    const blocks: IRNode[] = [];
    const collect = (node: IRNode) => {
      if (node.type === 'IF' || node.type === 'WHILE' || node.type === 'CHUNK') {
        if (node.children) node.children.forEach(collect);
      } else {
        blocks.push(node);
      }
    };
    collect(ir);
    if (blocks.length <= 1) return ir;
    const stateVar = `__state_${rng.range(1000, 9999)}`;
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
  private fixups: Array<{ label: string; positions: number[] }> = [];
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
    if (this.layers.garbage && this.rng.range(1, 20) > 18) {
      GarbageInjector.insertNOP(this.bytecode, this.opMap, this.rng);
    }
  }
  emitJump(op: string, label: string): void {
    this.emit(op);
    const pos = this.bytecode.length;
    this.bytecode.push(0, 0);
    let fix = this.fixups.find(f => f.label === label);
    if (!fix) {
      fix = { label, positions: [] };
      this.fixups.push(fix);
    }
    fix.positions.push(pos);
  }
  label(): string {
    const name = `L${this.nextLabel++}`;
    this.labels.set(name, this.bytecode.length);
    return name;
  }
  resolveFixups(): void {
    for (const fix of this.fixups) {
      const target = this.labels.get(fix.label);
      if (target === undefined) continue;
      for (const pos of fix.positions) {
        this.bytecode[pos] = target & 0xff;
        this.bytecode[pos + 1] = (target >> 8) & 0xff;
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
    switch (node.type) {
      case 'CHUNK':
        node.children?.forEach(c => this.visitIR(c));
        break;
      case 'STATE_MACHINE':
        this.compileStateMachine(node);
        break;
      case 'ASSIGN':
        node.children?.slice(node.children.length / 2).forEach(c => this.visitIR(c));
        node.children?.slice(0, node.children.length / 2).forEach(c => this.visitIR(c));
        for (let i = 0; i < (node.children?.length || 0) / 2; i++) {
          const varNode = node.children?.[i];
          if (varNode?.type === 'IDENT') {
            this.emit('SETGLOBAL', this.addConstant(varNode.value));
          }
        }
        break;
      case 'LOCAL':
        node.children?.slice(node.children.length / 2).forEach(c => this.visitIR(c));
        for (let i = 0; i < (node.children?.length || 0) / 2; i++) {
          const varNode = node.children?.[i];
          if (varNode?.type === 'IDENT') {
            this.emit('SETGLOBAL', this.addConstant('_local_' + varNode.value));
          }
        }
        break;
      case 'CALL':
        node.children?.forEach(c => this.visitIR(c));
        this.emit('CALL', (node.children?.length || 1) - 1);
        break;
      case 'STRING':
      case 'NUMBER':
      case 'BOOLEAN':
        this.emit('LOADK', this.addConstant(node.value));
        break;
      case 'IDENT':
        this.emit('GETGLOBAL', this.addConstant(node.value));
        break;
      case 'BINARY':
        this.visitIR(node.left!);
        this.visitIR(node.right!);
        if (this.layers.expressions) {
          const leftStr = `pop()`;
          const rightStr = `pop()`;
          const obf = ExpressionObfuscator.obfuscateBinary(leftStr, rightStr, node.value, this.rng);
          this.emit('LOADK', this.addConstant(obf));
          this.emit('CALL', 1);
        } else {
          switch (node.value) {
            case '+': this.emit('ADD'); break;
            case '-': this.emit('SUB'); break;
            case '*': this.emit('MUL'); break;
            case '/': this.emit('DIV'); break;
            case '%': this.emit('MOD'); break;
            case '^': this.emit('POW'); break;
            case '..': this.emit('CONCAT'); break;
            case '==': this.emit('EQ'); break;
            case '<': this.emit('LT'); break;
            case '<=': this.emit('LE'); break;
            case '>': this.emit('GT'); break;
            case '>=': this.emit('GE'); break;
            case 'and': this.emit('AND'); break;
            case 'or': this.emit('OR'); break;
          }
        }
        break;
      case 'UNARY':
        this.visitIR(node.left!);
        if (this.layers.expressions) {
          const exprStr = `pop()`;
          const obf = ExpressionObfuscator.obfuscateUnary(exprStr, node.value, this.rng);
          this.emit('LOADK', this.addConstant(obf));
          this.emit('CALL', 1);
        } else {
          switch (node.value) {
            case 'not': this.emit('NOT'); break;
            case '-': this.emit('NEG'); break;
            case '#': this.emit('LEN'); break;
          }
        }
        break;
      case 'STATE_BLOCK':
        this.labels.set(`STATE_${node.value}`, this.bytecode.length);
        node.children?.forEach(c => this.visitIR(c));
        break;
      default:
        if (node.children) node.children.forEach(c => this.visitIR(c));
        if (node.left) this.visitIR(node.left);
        if (node.right) this.visitIR(node.right);
        break;
    }
  }
  private compileStateMachine(node: IRNode): void {
    const stateVar = node.value;
    this.emit('LOADK', this.addConstant(1));
    this.emit('SETGLOBAL', this.addConstant('__' + stateVar));
    const startLabel = this.label();
    this.emit('GETGLOBAL', this.addConstant('__' + stateVar));
    const jumpTable: string[] = [];
    for (let i = 0; i < (node.children?.length || 0); i++) {
      jumpTable.push(`STATE_${i + 1}`);
    }
    for (let i = 0; i < jumpTable.length; i++) {
      const caseLabel = this.label();
      const stateNode = node.children![i];
      this.visitIR(stateNode);
      this.emit('JMP', startLabel);
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
    const buildId = `XZX-${Date.now().toString(36)}-${rng.range(1000, 9999)}`;
    const key = rng.bytes(32);
    const encrypted = bytecode.map((b, i) => b ^ key[i % key.length]);
    const hash = bytecode.reduce((h, b) => ((h << 5) - h + b) & 0xffffffff, 0);
    const opList = opMap.getAll();
    const dynamicKey = opMap.getDynamicKey();
    const constStr = JSON.stringify(constants).replace(/"([^"]+)":/g, '$1:');
    const mode = options.mode || 'standard';
    let envSetup = mode === 'isolated'
      ? 'local env = {}\n  setmetatable(env, {__index = getfenv and getfenv() or _ENV})'
      : mode === 'sandbox'
        ? 'local env = {print=print, string=string, table=table}'
        : 'local env = getfenv and getfenv() or _ENV';
    if (layers.stack) {
      envSetup += '\nlocal stackA = {}\nlocal stackB = {}\nlocal stackIdx = 1';
    }
    const debugMode = options.debug ? `
  local function debugLog(...)
    print("[XZX VM]", ...)
  end` : '';
    const antiTamper = layers.antiTamper ? `
local function validate()
  local h = 0
  for i = 1, #bytecode do
    h = ((h << 5) - h + bytecode[i]) & 0xffffffff
  end
  if h ~= expectedHash then
    error("Integrity violation: " .. tostring(h) .. " vs " .. expectedHash)
  end
  if opMap then
    local check = ${dynamicKey}
    if check ~= 0 and (bytecode[1] ^ bytecode[#bytecode]) ~= check then
      error("Dynamic key mismatch")
    end
  end
end` : '';
    const stringDecrypt = layers.strings ? `
local function getConst(idx)
  local c = consts[idx]
  if type(c) == 'table' then
    if c.t == 's-multi' then
      local result = ''
      for i = 1, #c.c do
        local chunk = c.c[i]
        local key = c.k[i]
        for j = 1, #chunk do
          result = result .. string.char(chunk[j] ~ key)
        end
      end
      return result
    elseif c.t == 'n3' then
      local a = (c.d + c.k[3]) & 0xffffffff
      local b = (a ^ c.k[2]) & 0xffffffff
      local c2 = (b >>> 3) | ((b & 7) << 29)
      return (c2 - c.k[1]) & 0xffffffff
    elseif c.t == 'b' then
      return (c.v ^ c.k) == 1
    end
  end
  return c
end` : `
local function getConst(idx)
  return consts[idx]
end`;
    const stackOps = layers.stack ? `
local function push(v)
  if stackIdx == 1 then
    table.insert(stackA, v)
  else
    table.insert(stackB, v)
  end
  stackIdx = 3 - stackIdx
end
local function pop()
  stackIdx = 3 - stackIdx
  if stackIdx == 1 then
    return table.remove(stackA)
  else
    return table.remove(stackB)
  end
end` : `
local function push(v) table.insert(stack, v) end
local function pop() return table.remove(stack) end`;
    const handlerBodies: Record<string, string> = {
      NOP: '',
      PUSH: 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; push(getConst(idx))',
      POP: 'pop()',
      ADD: 'local b = pop(); local a = pop(); push(a + b)',
      SUB: 'local b = pop(); local a = pop(); push(a - b)',
      MUL: 'local b = pop(); local a = pop(); push(a * b)',
      DIV: 'local b = pop(); local a = pop(); push(a / b)',
      MOD: 'local b = pop(); local a = pop(); push(a % b)',
      POW: 'local b = pop(); local a = pop(); push(a ^ b)',
      CONCAT: 'local b = pop(); local a = pop(); push(a .. b)',
      JMP: 'local target = bytecode[pc] + (bytecode[pc+1] << 8); pc = target + 2',
      JIF: 'local target = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; local cond = pop(); if not cond then pc = target end',
      CALL: 'local nargs = bytecode[pc]; pc = pc + 2; local func = pop(); local args = {}; for i = 1, nargs do args[nargs - i + 1] = pop() end; local results = {func(table.unpack(args))}; for _, v in ipairs(results) do push(v) end',
      RET: 'pc = #bytecode + 1',
      LOADK: 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; push(getConst(idx))',
      GETGLOBAL: 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; local name = getConst(idx); push(env[name])',
      SETGLOBAL: 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; local val = pop(); env[getConst(idx)] = val',
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
      TAILCALL: 'local nargs = bytecode[pc]; pc = pc + 2; local func = pop(); local args = {}; for i = 1, nargs do args[nargs - i + 1] = pop() end; return func(table.unpack(args))',
    };
    const handlers: string[] = [];
    for (const [name, body] of Object.entries(handlerBodies)) {
      const nums = opMap.getAll().filter(([n]) => n === name).map(([_, num]) => num);
      for (const num of nums) {
        handlers.push(`  [${num}] = function() ${body} end`);
      }
    }
    const handlerStr = handlers.join(',\n');
    return `--[[ XZX Build: ${buildId} ]]
local env
${envSetup}
${debugMode}
local bytecode = {${encrypted.join(',')}}
local consts = ${constStr}
local key = {${key.join(',')}}
local expectedHash = ${hash}
local pc = 1
local stack = {}
${stackOps}
local opMap = {
${opList.map(([name, num]) => `  [${num}] = '${name}',`).join('\n')}
}
for i = 1, #bytecode do
  bytecode[i] = bytecode[i] ~ key[(i-1) % #key + 1]
end
${stringDecrypt}
${antiTamper}
local handlers = {
${handlerStr}
}
if ${layers.antiTamper ? 'true' : 'false'} then
  validate()
end
while pc <= #bytecode do
  local op = bytecode[pc]
  pc = pc + 1
  local handler = handlers[op]
  if handler then
    handler()
  else
    error("Invalid opcode: " .. op)
  end
end
return stack[1] or stackA[1]
`;
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
    const layers = { ...defaultLayers, ...options.layers };
    const rng = new SeededRandom(options.seed);
    const ast = luaparse.parse(source, { comments: false, luaVersion: '5.1' });
    const ir = IRBuilder.fromAST(ast);
    const opMap = new OpcodeMap(rng, layers.polymorphism);
    const compiler = new BytecodeCompiler(opMap, rng, layers);
    const { bytecode, constants } = compiler.compile(ir);
    const output = VMGenerator.generate(bytecode, constants, opMap, rng, options, layers);
    const buildId = `XZX-${Date.now().toString(36)}-${rng.range(1000, 9999)}`;
    const layersApplied = Object.entries(layers).filter(([_, v]) => v).map(([k]) => k);
    return {
      success: true,
      code: output,
      metrics: {
        inputSize: source.length,
        outputSize: output.length,
        duration: Date.now() - start,
        instructionCount: bytecode.length,
        buildId,
        layersApplied
      }
    };
  }
}
export function obfuscateLua(source: string, options: any): ObfuscationResult {
  const opts: ObfuscationOptions = {
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
