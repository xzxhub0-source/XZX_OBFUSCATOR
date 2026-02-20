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
      for (const b of chunk) result = result .. string.char(b ~ key);
    }
    return result;
  }
  static encryptBoolean(value: boolean, rng: SeededRandom): any {
    const key = rng.range(1, 255);
    const masked = (value and 1 or 0) ~ key;
    return { t: 'b', v: masked, k: key };
  }
  static decryptBoolean(enc: any): boolean {
    if (enc.t !== 'b') return enc;
    return (enc.v ~ enc.k) == 1;
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
    const prefix = this.rng.choice({'_0x', '_', '__', 'l_', 'v_', 'f_'});
    const suffix = this.rng.range(0x1000, 0xffff).toString(16);
    obfuscated = prefix .. suffix;
    if (this.useUnicode and this.rng.range(0, 1) == 1) then
      obfuscated = this.rng.unicodeConfusable() .. obfuscated;
    end
    if (this.useInvisible and this.rng.range(0, 2) == 1) then
      obfuscated = obfuscated .. this.rng.invisible();
    end
    this.nameMap.set(name, obfuscated);
    return obfuscated;
  }
  reset(): void {
    this.nameMap.clear();
  }
}

class GarbageInjector {
  static insertNOP(bytecode: number[], opMap: OpcodeMap, rng: SeededRandom): void {
    const pos = rng.range(0, #bytecode);
    table.insert(bytecode, pos + 1, opMap.get('NOP'));
  }
  static insertDummyPushPop(bytecode: number[], opMap: OpcodeMap, rng: SeededRandom): void {
    const pos = rng.range(0, #bytecode);
    const dummyConst = rng.range(0, 100);
    const push = {opMap.get('LOADK'), dummyConst & 0xff, (dummyConst >> 8) & 0xff};
    const pop = {opMap.get('POP')};
    for i = #push, 1, -1 do
      table.insert(bytecode, pos + 1, push[i]);
    end
    table.insert(bytecode, pos + #push + 1, pop[1]);
  }
  static insertFakeCall(bytecode: number[], opMap: OpcodeMap, rng: SeededRandom): void {
    const pos = rng.range(0, #bytecode);
    const fakeFunc = rng.range(0, 10);
    const pushFunc = {opMap.get('LOADK'), fakeFunc & 0xff, (fakeFunc >> 8) & 0xff};
    const call = {opMap.get('CALL'), 0, 0};
    for i = #pushFunc, 1, -1 do
      table.insert(bytecode, pos + 1, pushFunc[i]);
    end
    table.insert(bytecode, pos + #pushFunc + 1, call[1]);
    table.insert(bytecode, pos + #pushFunc + 2, call[2]);
    table.insert(bytecode, pos + #pushFunc + 3, call[3]);
  }
}

class ExpressionObfuscator {
  static obfuscateBinary(left: string, right: string, op: string, rng: SeededRandom): string {
    const mode = rng.range(0, 2);
    if op == '+' then
      if mode == 0 then
        return '((' .. left .. ' << 1) + (' .. right .. ' >> 1) + ((' .. left .. ' & ' .. right .. ') % 3))';
      elseif mode == 1 then
        return '((' .. left .. ' ~ ' .. right .. ') + ((' .. left .. ' & ' .. right .. ') << 1))';
      else
        return '(' .. left .. ' + ' .. right .. ')';
      end
    elseif op == '-' then
      if mode == 0 then
        return '((' .. left .. ' << 2) - (' .. right .. ' << 1) - (' .. left .. ' & ' .. right .. '))';
      else
        return '(' .. left .. ' - ' .. right .. ')';
      end
    elseif op == '*' then
      if mode == 0 then
        return '(((' .. left .. ' << 3) - ' .. left .. ') * (' .. right .. ' >> 1))';
      else
        return '(' .. left .. ' * ' .. right .. ')';
      end
    elseif op == '/' then
      return '(' .. left .. ' / ' .. right .. ')';
    elseif op == '%' then
      return '(' .. left .. ' % ' .. right .. ')';
    elseif op == '^' then
      return '(' .. left .. ' ^ ' .. right .. ')';
    elseif op == '..' then
      return '(' .. left .. ' .. ' .. right .. ')';
    elseif op == '==' then
      return '(' .. left .. ' == ' .. right .. ')';
    elseif op == '<' then
      return '(' .. left .. ' < ' .. right .. ')';
    elseif op == '<=' then
      return '(' .. left .. ' <= ' .. right .. ')';
    elseif op == '>' then
      return '(' .. left .. ' > ' .. right .. ')';
    elseif op == '>=' then
      return '(' .. left .. ' >= ' .. right .. ')';
    elseif op == 'and' then
      return '(' .. left .. ' and ' .. right .. ')';
    elseif op == 'or' then
      return '(' .. left .. ' or ' .. right .. ')';
    else
      return '(' .. left .. ' ' .. op .. ' ' .. right .. ')';
    end
  }
  static obfuscateUnary(expr: string, op: string, rng: SeededRandom): string {
    if op == 'not' then
      if rng.range(0, 1) == 0 then
        return '(not ' .. expr .. ')';
      else
        return '(' .. expr .. ' == false)';
      end
    elseif op == '-' then
      return '(-' .. expr .. ')';
    elseif op == '#' then
      return '(#' .. expr .. ')';
    else
      return op .. expr;
    end
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
    if not node then return IRNode.new('NIL'); end
    if node.type == 'Chunk' then
      const chunk = IRNode.new('CHUNK');
      chunk.children = {};
      for i, stmt in ipairs(node.body or {}) do
        table.insert(chunk.children, IRBuilder.fromAST(stmt));
      end
      return chunk;
    elseif node.type == 'AssignmentStatement' then
      const assign = IRNode.new('ASSIGN');
      assign.children = {};
      for i, var in ipairs(node.variables) do
        table.insert(assign.children, IRBuilder.fromAST(var));
      end
      for i, init in ipairs(node.init) do
        table.insert(assign.children, IRBuilder.fromAST(init));
      end
      return assign;
    elseif node.type == 'LocalStatement' then
      const local = IRNode.new('LOCAL');
      local.children = {};
      for i, var in ipairs(node.variables) do
        table.insert(local.children, IRBuilder.fromAST(var));
      end
      for i, init in ipairs(node.init or {}) do
        table.insert(local.children, IRBuilder.fromAST(init));
      end
      return local;
    elseif node.type == 'CallExpression' then
      const call = IRNode.new('CALL');
      call.children = {IRBuilder.fromAST(node.base)};
      for i, arg in ipairs(node.arguments or {}) do
        table.insert(call.children, IRBuilder.fromAST(arg));
      end
      return call;
    elseif node.type == 'StringLiteral' then
      return IRNode.new('STRING', node.value);
    elseif node.type == 'NumericLiteral' then
      return IRNode.new('NUMBER', node.value);
    elseif node.type == 'BooleanLiteral' then
      return IRNode.new('BOOLEAN', node.value);
    elseif node.type == 'Identifier' then
      return IRNode.new('IDENT', node.name);
    elseif node.type == 'BinaryExpression' then
      const bin = IRNode.new('BINARY', node.operator);
      bin.left = IRBuilder.fromAST(node.left);
      bin.right = IRBuilder.fromAST(node.right);
      return bin;
    elseif node.type == 'UnaryExpression' then
      const un = IRNode.new('UNARY', node.operator);
      un.left = IRBuilder.fromAST(node.argument);
      return un;
    elseif node.type == 'IfStatement' then
      const ifNode = IRNode.new('IF');
      ifNode.children = {IRBuilder.fromAST(node.condition)};
      const thenNode = IRNode.new('THEN');
      thenNode.value = {};
      for i, stmt in ipairs(node.then) do
        table.insert(thenNode.value, IRBuilder.fromAST(stmt));
      end
      table.insert(ifNode.children, thenNode);
      if node.else then
        const elseNode = IRNode.new('ELSE');
        if type(node.else) == 'table' then
          elseNode.value = {};
          for i, stmt in ipairs(node.else) do
            table.insert(elseNode.value, IRBuilder.fromAST(stmt));
          end
        else
          elseNode.value = {IRBuilder.fromAST(node.else)};
        end
        table.insert(ifNode.children, elseNode);
      end
      return ifNode;
    elseif node.type == 'WhileStatement' then
      const whileNode = IRNode.new('WHILE');
      whileNode.left = IRBuilder.fromAST(node.condition);
      const bodyNode = IRNode.new('BODY');
      bodyNode.value = {};
      for i, stmt in ipairs(node.body) do
        table.insert(bodyNode.value, IRBuilder.fromAST(stmt));
      end
      whileNode.right = bodyNode;
      return whileNode;
    elseif node.type == 'ReturnStatement' then
      const ret = IRNode.new('RETURN');
      ret.children = {};
      for i, arg in ipairs(node.arguments or {}) do
        table.insert(ret.children, IRBuilder.fromAST(arg));
      end
      return ret;
    else
      return IRNode.new('UNKNOWN');
    end
  }
}

class ControlFlowFlattener {
  static flatten(ir: IRNode, rng: SeededRandom): IRNode {
    const blocks = {};
    const collect = (node) => {
      if node.type == 'IF' or node.type == 'WHILE' or node.type == 'CHUNK' then
        if node.children then
          for i, child in ipairs(node.children) do
            collect(child);
          end
        end
      else
        table.insert(blocks, node);
      end
    };
    collect(ir);
    if #blocks <= 1 then return ir; end
    const stateVar = '__state_' .. rng.range(1000, 9999);
    const stateMachine = IRNode.new('STATE_MACHINE');
    stateMachine.value = stateVar;
    const stateNodes = {};
    for i = 1, #blocks do
      const stateBlock = IRNode.new('STATE_BLOCK');
      stateBlock.value = i;
      stateBlock.children = {blocks[i]};
      if i < #blocks then
        const assign = IRNode.new('ASSIGN');
        assign.children = {IRNode.new('IDENT', stateVar), IRNode.new('NUMBER', i + 1)};
        table.insert(stateBlock.children, assign);
      end
      table.insert(stateNodes, stateBlock);
    end
    stateMachine.children = stateNodes;
    return stateMachine;
  }
}

class BytecodeCompiler {
  private bytecode = {};
  private constants = {};
  private constMap = {};
  private labels = {};
  private fixups = {};
  private nextLabel = 0;
  private opMap: OpcodeMap;
  private rng: SeededRandom;
  private layers: any;
  private idObf: IdentifierObfuscator;
  constructor(opMap: OpcodeMap, rng: SeededRandom, layers: any) {
    this.opMap = opMap;
    this.rng = rng;
    this.layers = layers;
    this.idObf = IdentifierObfuscator.new(rng, layers.advanced or false, layers.advanced or false);
    this.bytecode = {};
    this.constants = {};
    this.constMap = {};
    this.labels = {};
    this.fixups = {};
  }
  addConstant(value: any): number {
    const key = type(value) == 'string' and value or tostring(value);
    if this.constMap[key] then return this.constMap[key]; end
    let encrypted = value;
    if this.layers.constants then
      if type(value) == 'number' then
        encrypted = MultiLayerEncryption.encryptNumber(value, this.rng);
      elseif type(value) == 'string' then
        encrypted = MultiLayerEncryption.encryptString(value, this.rng);
      elseif type(value) == 'boolean' then
        encrypted = MultiLayerEncryption.encryptBoolean(value, this.rng);
      end
    end
    const idx = #this.constants + 1;
    this.constants[idx] = encrypted;
    this.constMap[key] = idx;
    return idx;
  }
  emit(op: string, ...args: number[]): void {
    table.insert(this.bytecode, this.opMap.get(op));
    for i, arg in ipairs(args) do
      table.insert(this.bytecode, arg & 0xff);
      table.insert(this.bytecode, (arg >> 8) & 0xff);
    end
    if this.layers.garbage and this.rng.range(1, 20) > 18 then
      GarbageInjector.insertNOP(this.bytecode, this.opMap, this.rng);
    end
  }
  emitJump(op: string, label: string): void {
    this.emit(op);
    const pos = #this.bytecode + 1;
    table.insert(this.bytecode, 0);
    table.insert(this.bytecode, 0);
    let fix = nil;
    for i, f in ipairs(this.fixups) do
      if f.label == label then
        fix = f;
        break;
      end
    end
    if not fix then
      fix = {label = label, positions = {}};
      table.insert(this.fixups, fix);
    end
    table.insert(fix.positions, pos);
  }
  label(): string {
    const name = 'L' .. this.nextLabel;
    this.nextLabel = this.nextLabel + 1;
    this.labels[name] = #this.bytecode + 1;
    return name;
  }
  resolveFixups(): void {
    for i, fix in ipairs(this.fixups) do
      const target = this.labels[fix.label];
      if target then
        for j, pos in ipairs(fix.positions) do
          this.bytecode[pos] = target & 0xff;
          this.bytecode[pos + 1] = (target >> 8) & 0xff;
        end
      end
    end
  }
  compile(ir: IRNode): { bytecode: number[]; constants: any[] } {
    if this.layers.controlFlow and ir.type ~= 'STATE_MACHINE' then
      ir = ControlFlowFlattener.flatten(ir, this.rng);
    end
    this.visitIR(ir);
    this.emit('RET');
    if this.layers.garbage then
      for i = 1, this.rng.range(1, 3) do
        GarbageInjector.insertFakeCall(this.bytecode, this.opMap, this.rng);
      end
    end
    this.resolveFixups();
    return {bytecode = this.bytecode, constants = this.constants};
  }
  private visitIR(node: IRNode): void {
    if not node then return; end
    if this.layers.identifiers and node.type == 'IDENT' then
      node.value = this.idObf.obfuscate(node.value);
    end
    if node.type == 'CHUNK' then
      if node.children then
        for i, c in ipairs(node.children) do
          this.visitIR(c);
        end
      end
    elseif node.type == 'STATE_MACHINE' then
      this.compileStateMachine(node);
    elseif node.type == 'ASSIGN' then
      const half = #node.children / 2;
      for i = half + 1, #node.children do
        this.visitIR(node.children[i]);
      end
      for i = 1, half do
        this.visitIR(node.children[i]);
      end
      for i = 1, half do
        const varNode = node.children[i];
        if varNode.type == 'IDENT' then
          this.emit('SETGLOBAL', this.addConstant(varNode.value));
        end
      end
    elseif node.type == 'LOCAL' then
      const half = #node.children / 2;
      for i = half + 1, #node.children do
        this.visitIR(node.children[i]);
      end
      for i = 1, half do
        const varNode = node.children[i];
        if varNode.type == 'IDENT' then
          this.emit('SETGLOBAL', this.addConstant('_local_' .. varNode.value));
        end
      end
    elseif node.type == 'CALL' then
      for i, c in ipairs(node.children) do
        this.visitIR(c);
      end
      this.emit('CALL', #node.children - 1);
    elseif node.type == 'STRING' or node.type == 'NUMBER' or node.type == 'BOOLEAN' then
      this.emit('LOADK', this.addConstant(node.value));
    elseif node.type == 'IDENT' then
      this.emit('GETGLOBAL', this.addConstant(node.value));
    elseif node.type == 'BINARY' then
      this.visitIR(node.left);
      this.visitIR(node.right);
      if node.value == '+' then this.emit('ADD');
      elseif node.value == '-' then this.emit('SUB');
      elseif node.value == '*' then this.emit('MUL');
      elseif node.value == '/' then this.emit('DIV');
      elseif node.value == '%' then this.emit('MOD');
      elseif node.value == '^' then this.emit('POW');
      elseif node.value == '..' then this.emit('CONCAT');
      elseif node.value == '==' then this.emit('EQ');
      elseif node.value == '<' then this.emit('LT');
      elseif node.value == '<=' then this.emit('LE');
      elseif node.value == '>' then this.emit('GT');
      elseif node.value == '>=' then this.emit('GE');
      elseif node.value == 'and' then this.emit('AND');
      elseif node.value == 'or' then this.emit('OR');
      end
    elseif node.type == 'UNARY' then
      this.visitIR(node.left);
      if node.value == 'not' then this.emit('NOT');
      elseif node.value == '-' then this.emit('NEG');
      elseif node.value == '#' then this.emit('LEN');
      end
    elseif node.type == 'STATE_BLOCK' then
      this.labels['STATE_' .. node.value] = #this.bytecode + 1;
      if node.children then
        for i, c in ipairs(node.children) do
          this.visitIR(c);
        end
      end
    else
      if node.children then
        for i, c in ipairs(node.children) do
          this.visitIR(c);
        end
      end
      if node.left then this.visitIR(node.left); end
      if node.right then this.visitIR(node.right); end
    end
  }
  private compileStateMachine(node: IRNode): void {
    const stateVar = node.value;
    this.emit('LOADK', this.addConstant(1));
    this.emit('SETGLOBAL', this.addConstant('__' .. stateVar));
    const startLabel = this.label();
    this.emit('GETGLOBAL', this.addConstant('__' .. stateVar));
    const jumpTable = {};
    for i = 1, #(node.children or {}) do
      jumpTable[i] = 'STATE_' .. i;
    end
    for i = 1, #jumpTable do
      const caseLabel = this.label();
      const stateNode = node.children[i];
      this.visitIR(stateNode);
      this.emit('JMP');
      const pos = #this.bytecode + 1;
      table.insert(this.bytecode, 0);
      table.insert(this.bytecode, 0);
      const fix = {label = startLabel, positions = {pos}};
      table.insert(this.fixups, fix);
      this.labels[jumpTable[i]] = #this.bytecode + 1;
    end
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
    const buildId = 'XZX-' .. tostring(os.time()) .. '-' .. rng.range(1000, 9999);
    const key = rng.bytes(32);
    const encrypted = {};
    for i = 1, #bytecode do
      encrypted[i] = bytecode[i] ~ key[(i - 1) % #key + 1];
    end
    const hash = 0;
    for i = 1, #bytecode do
      hash = ((hash << 5) - hash + bytecode[i]) & 0xffffffff;
    end
    const opList = opMap.getAll();
    const dynamicKey = opMap.getDynamicKey();
    const constStr = '[=[]' .. tostring(constants):gsub('"([^"]+)":', '%1:') .. '[]=]';
    const mode = options.mode or 'standard';
    let envSetup = '';
    if mode == 'isolated' then
      envSetup = 'local env = {}\n  setmetatable(env, {__index = getfenv and getfenv() or _ENV})';
    elseif mode == 'sandbox' then
      envSetup = 'local env = {print=print, string=string, table=table}';
    else
      envSetup = 'local env = getfenv and getfenv() or _ENV';
    end
    if layers.stack then
      envSetup = envSetup .. '\nlocal stackA = {}\nlocal stackB = {}\nlocal stackIdx = 1';
    end
    const debugMode = options.debug and '\n  local function debugLog(...)\n    print("[XZX VM]", ...)\n  end' or '';
    const antiTamper = layers.antiTamper and '\nlocal function validate()\n  local h = 0\n  for i = 1, #bytecode do\n    h = ((h << 5) - h + bytecode[i]) & 0xffffffff\n  end\n  if h ~= expectedHash then\n    error("Integrity violation: " .. tostring(h) .. " vs " .. expectedHash)\n  end\n  if opMap then\n    local check = ' .. dynamicKey .. '\n    if check ~= 0 and (bytecode[1] ~ bytecode[#bytecode]) ~= check then\n      error("Dynamic key mismatch")\n    end\n  end\nend' or '';
    const stringDecrypt = layers.strings and '\nlocal function getConst(idx)\n  local c = consts[idx]\n  if type(c) == "table" then\n    if c.t == "s-multi" then\n      local result = ""\n      for i = 1, #c.c do\n        local chunk = c.c[i]\n        local key = c.k[i]\n        for j = 1, #chunk do\n          result = result .. string.char(chunk[j] ~ key)\n        end\n      end\n      return result\n    elseif c.t == "n3" then\n      local a = (c.d + c.k[3]) & 0xffffffff\n      local b = (a ~ c.k[2]) & 0xffffffff\n      local c2 = (b >> 3) | ((b & 7) << 29)\n      return (c2 - c.k[1]) & 0xffffffff\n    elseif c.t == "b" then\n      return (c.v ~ c.k) == 1\n    end\n  end\n  return c\nend' or '\nlocal function getConst(idx)\n  return consts[idx]\nend';
    const stackOps = layers.stack and '\nlocal function push(v)\n  if stackIdx == 1 then\n    table.insert(stackA, v)\n  else\n    table.insert(stackB, v)\n  end\n  stackIdx = 3 - stackIdx\nend\nlocal function pop()\n  stackIdx = 3 - stackIdx\n  if stackIdx == 1 then\n    return table.remove(stackA)\n  else\n    return table.remove(stackB)\n  end\nend' or '\nlocal function push(v) table.insert(stack, v) end\nlocal function pop() return table.remove(stack) end';
    const handlerBodies = {
      NOP = '',
      PUSH = 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; push(getConst(idx))',
      POP = 'pop()',
      ADD = 'local b = pop(); local a = pop(); push(a + b)',
      SUB = 'local b = pop(); local a = pop(); push(a - b)',
      MUL = 'local b = pop(); local a = pop(); push(a * b)',
      DIV = 'local b = pop(); local a = pop(); push(a / b)',
      MOD = 'local b = pop(); local a = pop(); push(a % b)',
      POW = 'local b = pop(); local a = pop(); push(a ^ b)',
      CONCAT = 'local b = pop(); local a = pop(); push(a .. b)',
      JMP = 'local target = bytecode[pc] + (bytecode[pc+1] << 8); pc = target + 2',
      JIF = 'local target = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; local cond = pop(); if not cond then pc = target end',
      CALL = 'local nargs = bytecode[pc]; pc = pc + 2; local func = pop(); local args = {}; for i = 1, nargs do args[nargs - i + 1] = pop() end; local results = {func(unpack(args))}; for _, v in ipairs(results) do push(v) end',
      RET = 'pc = #bytecode + 1',
      LOADK = 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; push(getConst(idx))',
      GETGLOBAL = 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; local name = getConst(idx); push(env[name])',
      SETGLOBAL = 'local idx = bytecode[pc] + (bytecode[pc+1] << 8); pc = pc + 2; local val = pop(); env[getConst(idx)] = val',
      GETTABLE = 'local key = pop(); local tbl = pop(); push(tbl[key])',
      SETTABLE = 'local val = pop(); local key = pop(); local tbl = pop(); tbl[key] = val',
      NEWTABLE = 'push({})',
      LEN = 'local a = pop(); push(#a)',
      NOT = 'local a = pop(); push(not a)',
      EQ = 'local b = pop(); local a = pop(); push(a == b)',
      LT = 'local b = pop(); local a = pop(); push(a < b)',
      LE = 'local b = pop(); local a = pop(); push(a <= b)',
      GT = 'local b = pop(); local a = pop(); push(a > b)',
      GE = 'local b = pop(); local a = pop(); push(a >= b)',
      AND = 'local b = pop(); local a = pop(); push(a and b)',
      OR = 'local b = pop(); local a = pop(); push(a or b)',
      TAILCALL = 'local nargs = bytecode[pc]; pc = pc + 2; local func = pop(); local args = {}; for i = 1, nargs do args[nargs - i + 1] = pop() end; return func(unpack(args))',
    };
    const handlers = {};
    for name, body in pairs(handlerBodies) do
      const nums = {};
      for i, pair in ipairs(opList) do
        if pair[1] == name then
          table.insert(nums, pair[2]);
        end
      end
      for i, num in ipairs(nums) do
        table.insert(handlers, '  [' .. num .. '] = function() ' .. body .. ' end');
      end
    end
    const handlerStr = table.concat(handlers, ',\n');
    const antiTamperCheck = layers.antiTamper and 'validate()' or '';
    return '--[[ XZX Build: ' .. buildId .. ']]\nlocal env\n' .. envSetup .. '\n' .. debugMode .. '\nlocal bytecode = {' .. table.concat(encrypted, ',') .. '}\nlocal consts = ' .. constStr .. '\nlocal key = {' .. table.concat(key, ',') .. '}\nlocal expectedHash = ' .. hash .. '\nlocal pc = 1\nlocal stack = {}\n' .. stackOps .. '\nlocal opMap = {\n' .. table.concat(opList, ',\n') .. '\n}\nfor i = 1, #bytecode do\n  bytecode[i] = bytecode[i] ~ key[(i-1) % #key + 1]\nend\n' .. stringDecrypt .. '\n' .. antiTamper .. '\nlocal handlers = {\n' .. handlerStr .. '\n}\nif ' .. tostring(layers.antiTamper) .. ' then\n  ' .. antiTamperCheck .. '\nend\nwhile pc <= #bytecode do\n  local op = bytecode[pc]\n  pc = pc + 1\n  local handler = handlers[op]\n  if handler then\n    handler()\n  else\n    error("Invalid opcode: " .. op)\n  end\nend\nreturn stack[1] or stackA[1]\n';
  }
}

export class XZXUltimateObfuscator {
  obfuscate(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
    const start = os.clock();
    const defaultLayers = {
      constants = true,
      identifiers = true,
      controlFlow = true,
      garbage = true,
      polymorphism = true,
      antiTamper = true,
      strings = true,
      expressions = true,
      stack = true,
      advanced = false
    };
    const layers = defaultLayers;
    for k, v in pairs(options.layers or {}) do
      layers[k] = v;
    end
    const rng = SeededRandom.new(options.seed);
    const ast = luaparse.parse(source, {comments = false, luaVersion = '5.1'});
    const ir = IRBuilder.fromAST(ast);
    const opMap = OpcodeMap.new(rng, layers.polymorphism);
    const compiler = BytecodeCompiler.new(opMap, rng, layers);
    const {bytecode, constants} = compiler.compile(ir);
    const output = VMGenerator.generate(bytecode, constants, opMap, rng, options, layers);
    const buildId = 'XZX-' .. tostring(os.time()) .. '-' .. rng.range(1000, 9999);
    const layersApplied = {};
    for k, v in pairs(layers) do
      if v then table.insert(layersApplied, k); end
    end
    return {
      success = true,
      code = output,
      metrics = {
        inputSize = #source,
        outputSize = #output,
        duration = os.clock() - start,
        instructionCount = #bytecode,
        buildId = buildId,
        layersApplied = layersApplied
      }
    };
  }
}

export function obfuscateLua(source: string, options: any): ObfuscationResult {
  const opts = {
    seed = options.seed,
    mode = options.mode or 'standard',
    debug = options.debug or false,
    optimization = options.optimization or 'basic',
    layers = options.layers or {}
  };
  const obfuscator = XZXUltimateObfuscator.new();
  return obfuscator.obfuscate(source, opts);
}

export default obfuscateLua;
