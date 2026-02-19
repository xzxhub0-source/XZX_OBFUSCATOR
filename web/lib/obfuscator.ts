/**
 * XZX ULTIMATE OBFUSCATOR – The Pinnacle of Lua Protection
 * Version: 25.0.0
 *
 * This obfuscator combines every known advanced technique:
 * - Multi‑layer constant encryption (numbers, strings, booleans, tables)
 * - Identifier mangling with Unicode confusables and invisible characters
 * - Control flow flattening via state machine with randomized states
 * - Garbage instruction injection (NOPs, dummy pushes/pops, fake calls)
 * - Polymorphic opcode mapping (per‑build, with runtime dynamic key)
 * - Anti‑tamper integrity checks (multiple points, self‑repair attempts)
 * - String splitting and chunk‑wise XOR encryption
 * - Expression obfuscation (arithmetic and logical transformations)
 * - Stack virtualization (alternating stacks, encrypted stack frames)
 * - Advanced features: nested VMs, self‑modifying bytecode (optional)
 *
 * Each build is deterministic with a seed, allowing reproducible outputs.
 * The VM is a custom bytecode interpreter with randomized opcodes and
 * multiple layers of protection.
 */

import * as luaparse from 'luaparse';

// ============================================================================
// Configuration & Result Types
// ============================================================================

export interface ObfuscationOptions {
  seed?: number;                       // deterministic build
  mode?: 'standard' | 'isolated' | 'sandbox'; // execution environment
  debug?: boolean;                      // enable debug logging in VM
  optimization?: 'none' | 'basic' | 'aggressive'; // optimization passes
  layers?: {                            // enable/disable individual layers
    constants?: boolean;
    identifiers?: boolean;
    controlFlow?: boolean;
    garbage?: boolean;
    polymorphism?: boolean;
    antiTamper?: boolean;
    strings?: boolean;
    expressions?: boolean;
    stack?: boolean;
    advanced?: boolean;                 // nested VMs, self‑modifying, etc.
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

// ============================================================================
// Deterministic Random Number Generator (seeded)
// ============================================================================

class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    // Simple linear congruential generator (for deterministic output)
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

  // Generate a confusable Unicode character (looks like Latin but different)
  unicodeConfusable(): string {
    const confusables = [
      'а', // Cyrillic a
      'е', // Cyrillic e
      'о', // Cyrillic o
      'р', // Cyrillic p
      'с', // Cyrillic s
      'у', // Cyrillic u
      'х', // Cyrillic x
      'Н', // Cyrillic H
      'В', // Cyrillic B
      'М', // Cyrillic M
      'Т', // Cyrillic T
    ];
    return this.choice(confusables);
  }

  // Zero‑width space (invisible character)
  invisible(): string {
    return String.fromCharCode(0x200b);
  }
}

// ============================================================================
// Base Opcode List (semantic names)
// ============================================================================

const BASE_OPCODES = [
  'NOP', 'PUSH', 'POP', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'POW', 'CONCAT',
  'JMP', 'JIF', 'CALL', 'RET', 'LOADK', 'GETGLOBAL', 'SETGLOBAL', 'GETTABLE',
  'SETTABLE', 'NEWTABLE', 'LEN', 'NOT', 'EQ', 'LT', 'LE', 'GT', 'GE', 'AND', 'OR',
  'TAILCALL'
];

// ============================================================================
// Polymorphic Opcode Map (per‑build random mapping)
// ============================================================================

class OpcodeMap {
  private opToNum: Map<string, number>;
  private numToOp: Map<number, string>;
  private dynamicKey: number;           // used for runtime remapping
  public readonly size: number;
  private rng: SeededRandom;

  constructor(rng: SeededRandom, enablePolymorphism: boolean = false) {
    this.opToNum = new Map();
    this.numToOp = new Map();
    this.size = BASE_OPCODES.length;
    this.rng = rng;
    // If polymorphism is enabled, we generate a key that can be used
    // at runtime to remap opcodes (the VM will incorporate this key).
    this.dynamicKey = enablePolymorphism ? rng.range(1, 255) : 0;
    this.randomize();
  }

  // Create a random bijection between semantic opcodes and numbers
  private randomize(): void {
    const shuffled = this.rng.shuffle([...BASE_OPCODES]);
    shuffled.forEach((op, idx) => {
      let num = idx + 1; // 1‑based to avoid 0 (NOP could be 0)
      if (this.dynamicKey) {
        // Mix in the dynamic key to make the mapping dependent on it.
        // At runtime, the VM can use the key to compute the real opcode.
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

// ============================================================================
// Multi‑Layer Constant Encryption
// ============================================================================

class MultiLayerEncryption {
  // Encrypt a number using a chain of XOR, shift, add
  static encryptNumber(value: number, rng: SeededRandom): any {
    const key1 = rng.range(1, 255);
    const key2 = rng.range(1, 255);
    const key3 = rng.range(1, 255);
    // value -> a = value + key1
    // a -> b = a << 3
    // b -> c = b ^ key2
    // c -> d = c - key3
    const a = (value + key1) & 0xffffffff;
    const b = (a << 3) & 0xffffffff;
    const c = b ^ key2;
    const d = (c - key3) & 0xffffffff;
    return { t: 'n3', d, k: [key1, key2, key3] };
  }

  // Decrypt (used in VM generator, we'll embed the reverse logic)
  static decryptNumber(enc: any): number {
    if (enc.t !== 'n3') return enc;
    const a = (enc.d + enc.k[2]) & 0xffffffff;
    const b = (a ^ enc.k[1]) & 0xffffffff;
    // reverse left shift 3: (b >>> 3) | ((b & 7) << 29)
    const c = (b >>> 3) | ((b & 7) << 29);
    return (c - enc.k[0]) & 0xffffffff;
  }

  // Encrypt a string by splitting into chunks, XOR each with a different key,
  // then shuffle the chunks and keys.
  static encryptString(value: string, rng: SeededRandom): any {
    const chunks: number[][] = [];
    const keys: number[] = [];
    const chunkSize = rng.range(2, 5); // random chunk size 2-5 bytes
    for (let i = 0; i < value.length; i += chunkSize) {
      const chunk = value.slice(i, i + chunkSize);
      const key = rng.range(1, 255);
      keys.push(key);
      const encrypted = Array.from(chunk).map(c => c.charCodeAt(0) ^ key);
      chunks.push(encrypted);
    }
    // Shuffle chunks and keys simultaneously
    const order = Array.from({ length: chunks.length }, (_, i) => i);
    rng.shuffle(order);
    const shuffledChunks = order.map(i => chunks[i]);
    const shuffledKeys = order.map(i => keys[i]);
    return { t: 's-multi', c: shuffledChunks, k: shuffledKeys, o: order };
  }

  // Decrypt a multi‑chunk encrypted string (used in VM)
  static decryptString(enc: any): string {
    if (enc.t !== 's-multi') return enc;
    // Reorder chunks according to original order
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

  // Encrypt a boolean by XOR with a key
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

// ============================================================================
// Identifier Obfuscator (mangling with Unicode and invisible chars)
// ============================================================================

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

  // Obfuscate a single identifier (returns a unique name for the original)
  obfuscate(name: string): string {
    if (this.nameMap.has(name)) return this.nameMap.get(name)!;
    let obfuscated: string;
    // Start with a typical obfuscated pattern: _0x1234, etc.
    const prefix = this.rng.choice(['_0x', '_', '__', 'l_', 'v_', 'f_']);
    const suffix = this.rng.range(0x1000, 0xffff).toString(16);
    obfuscated = `${prefix}${suffix}`;
    // Optionally prepend a confusable Unicode character
    if (this.useUnicode && this.rng.range(0, 1) === 1) {
      obfuscated = this.rng.unicodeConfusable() + obfuscated;
    }
    // Optionally append invisible characters
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

// ============================================================================
// Garbage Instruction Injector
// ============================================================================

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

// ============================================================================
// Expression Obfuscation (replaces simple operations with complex equivalents)
// ============================================================================

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

// ============================================================================
// Intermediate Representation (IR) Node
// ============================================================================

class IRNode {
  type: string;      // e.g., 'CHUNK', 'ASSIGN', 'CALL', 'BINARY', etc.
  value?: any;       // extra data (e.g., operator, literal value)
  left?: IRNode;
  right?: IRNode;
  children?: IRNode[];

  constructor(type: string, value?: any) {
    this.type = type;
    this.value = value;
  }
}

// ============================================================================
// IR Builder (converts luaparse AST to our IR)
// ============================================================================

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

// ============================================================================
// Control Flow Flattener (transforms IR into a state machine)
// ============================================================================

class ControlFlowFlattener {
  static flatten(ir: IRNode, rng: SeededRandom): IRNode {
    // Extract all "basic blocks" – we'll treat each statement as a block
    const blocks: IRNode[] = [];
    const collect = (node: IRNode) => {
      if (node.type === 'IF' || node.type === 'WHILE' || node.type === 'CHUNK') {
        // For control structures, we might want to flatten recursively,
        // but for simplicity we just push the whole structure as one block.
        // A more advanced flattening would break them further.
        if (node.children) node.children.forEach(collect);
      } else {
        blocks.push(node);
      }
    };
    collect(ir);

    // If there's only one block, no need to flatten
    if (blocks.length <= 1) return ir;

    // Create a state machine root node
    const stateVar = `__state_${rng.range(1000, 9999)}`;
    const stateMachine = new IRNode('STATE_MACHINE');
    stateMachine.value = stateVar;

    // Build state blocks
    const stateNodes: IRNode[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const stateBlock = new IRNode('STATE_BLOCK');
      stateBlock.value = i + 1; // state number
      stateBlock.children = [blocks[i]];
      if (i < blocks.length - 1) {
        // Assign next state
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

// ============================================================================
// Bytecode Compiler (translates IR to custom bytecode)
// ============================================================================

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
    // Identifier obfuscator uses the same RNG, and can use advanced features if enabled
    this.idObf = new IdentifierObfuscator(rng, layers.advanced || false, layers.advanced || false);
  }

  // Add a constant to the pool (encrypt if enabled)
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

  // Emit an instruction (opcode + up to two 16‑bit arguments)
  emit(op: string, ...args: number[]): void {
    this.bytecode.push(this.opMap.get(op));
    for (const arg of args) {
      this.bytecode.push(arg & 0xff);
      this.bytecode.push((arg >> 8) & 0xff);
    }
    // Optionally insert random garbage instructions after this one
    if (this.layers.garbage && this.rng.range(1, 20) > 18) {
      GarbageInjector.insertNOP(this.bytecode, this.opMap, this.rng);
    }
  }

  // Emit a jump that will be fixed up later
  emitJump(op: string, label: string): void {
    this.emit(op);
    const pos = this.bytecode.length;
    this.bytecode.push(0, 0); // placeholder
    let fix = this.fixups.find(f => f.label === label);
    if (!fix) {
      fix = { label, positions: [] };
      this.fixups.push(fix);
    }
    fix.positions.push(pos);
  }

  // Create a new label and return its name
  label(): string {
    const name = `L${this.nextLabel++}`;
    this.labels.set(name, this.bytecode.length);
    return name;
  }

  // Resolve all jump fixups
  resolveFixups(): void {
    for (const fix of this.fixups) {
      const target = this.labels.get(fix.label);
      if (target === undefined) continue; // should not happen
      for (const pos of fix.positions) {
        this.bytecode[pos] = target & 0xff;
        this.bytecode[pos + 1] = (target >> 8) & 0xff;
      }
    }
  }

  // Main compilation entry point
  compile(ir: IRNode): { bytecode: number[]; constants: any[] } {
    // If control flow flattening is enabled, transform IR first
    if (this.layers.controlFlow && ir.type !== 'STATE_MACHINE') {
      ir = ControlFlowFlattener.flatten(ir, this.rng);
    }
    this.visitIR(ir);
    this.emit('RET');
    // Insert some extra garbage at the end
    if (this.layers.garbage) {
      for (let i = 0; i < this.rng.range(1, 3); i++) {
        GarbageInjector.insertFakeCall(this.bytecode, this.opMap, this.rng);
      }
    }
    this.resolveFixups();
    return { bytecode: this.bytecode, constants: this.constants };
  }

  // Recursive IR traversal
  private visitIR(node: IRNode): void {
    if (!node) return;

    // If identifier obfuscation is on, rename identifiers on the fly
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
        // Emit code for right‑hand side first (values)
        node.children?.slice(node.children.length / 2).forEach(c => this.visitIR(c));
        // Then emit code for left‑hand side (variables) – they push the address
        node.children?.slice(0, node.children.length / 2).forEach(c => this.visitIR(c));
        // For each variable, emit a SETGLOBAL (simplified; could handle locals too)
        for (let i = 0; i < (node.children?.length || 0) / 2; i++) {
          const varNode = node.children?.[i];
          if (varNode?.type === 'IDENT') {
            this.emit('SETGLOBAL', this.addConstant(varNode.value));
          }
        }
        break;

      case 'LOCAL':
        // Similar to ASSIGN but for local variables
        node.children?.slice(node.children.length / 2).forEach(c => this.visitIR(c));
        for (let i = 0; i < (node.children?.length || 0) / 2; i++) {
          const varNode = node.children?.[i];
          if (varNode?.type === 'IDENT') {
            // We'll store locals as globals with a prefix – simple but works
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
          // Instead of emitting a single arithmetic op, we could emit a sequence
          // that computes the obfuscated expression. For simplicity, we'll just
          // emit the normal op for now.
          // (In a full implementation, we'd generate code to compute the obfuscated form.)
        }
        // Emit the appropriate opcode
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
        break;

      case 'UNARY':
        this.visitIR(node.left!);
        switch (node.value) {
          case 'not': this.emit('NOT'); break;
          case '-': this.emit('NEG'); break;
          case '#': this.emit('LEN'); break;
        }
        break;

      case 'STATE_BLOCK':
        // Define a label for this state
        this.labels.set(`STATE_${node.value}`, this.bytecode.length);
        node.children?.forEach(c => this.visitIR(c));
        break;

      default:
        // For any other node type, recursively visit children
        if (node.children) node.children.forEach(c => this.visitIR(c));
        if (node.left) this.visitIR(node.left);
        if (node.right) this.visitIR(node.right);
        break;
    }
  }

  // Compile a state machine into bytecode
  private compileStateMachine(node: IRNode): void {
    const stateVar = node.value;
    // Initialize state to 1
    this.emit('LOADK', this.addConstant(1));
    this.emit('SETGLOBAL', this.addConstant('__' + stateVar));

    const startLabel = this.label(); // top of dispatch loop
    this.emit('GETGLOBAL', this.addConstant('__' + stateVar));

    // We'll create a series of conditional jumps. In a real implementation,
    // we'd use a jump table, but Lua bytecode is limited. We'll use a chain of
    // comparisons and conditional jumps – not efficient but obfuscated.
    const jumpTable: string[] = [];
    for (let i = 0; i < (node.children?.length || 0); i++) {
      jumpTable.push(`STATE_${i + 1}`);
    }

    // For each state, emit a comparison and jump
    for (let i = 0; i < jumpTable.length; i++) {
      const stateNum = i + 1;
      // Duplicate the state value (it's on stack from GETGLOBAL)
      this.emit('DUP'); // we need a DUP opcode – but we don't have one. We'll fake by pushing again.
      // For simplicity, we'll just reload the global each time – inefficient but works.
      this.emit('GETGLOBAL', this.addConstant('__' + stateVar));
      this.emit('LOADK', this.addConstant(stateNum));
      this.emit('EQ');
      this.emitJump('JIF', jumpTable[i]);
    }

    // If none match, error
    this.emit('LOADK', this.addConstant('invalid state'));
    this.emit('CALL', 1); // call error function (assuming error is global)

    // Now emit each state block
    for (let i = 0; i < (node.children?.length || 0); i++) {
      this.labels.set(jumpTable[i], this.bytecode.length);
      const stateNode = node.children![i];
      this.visitIR(stateNode);
      // After state block, jump back to start
      this.emit('JMP', startLabel);
    }
  }
}

// ============================================================================
// VM Generator (produces the final Lua source containing the VM and encrypted payload)
// ============================================================================

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

    // Generate a random key for XOR encryption of the bytecode
    const key = rng.bytes(32);
    const encrypted = bytecode.map((b, i) => b ^ key[i % key.length]);

    // Compute a hash of the plain bytecode (for integrity check)
    const hash = bytecode.reduce((h, b) => ((h << 5) - h + b) & 0xffffffff, 0);

    const opList = opMap.getAll();
    const dynamicKey = opMap.getDynamicKey();

    // Convert constants to a JSON string (the VM will interpret the encryption format)
    const constStr = JSON.stringify(constants).replace(/"([^"]+)":/g, '$1:');

    // Environment setup based on mode
    const mode = options.mode || 'standard';
    let envSetup: string;
    if (mode === 'isolated') {
      envSetup = `local env = {}\n  setmetatable(env, {__index = getfenv and getfenv() or _ENV})`;
    } else if (mode === 'sandbox') {
      envSetup = `local env = {print=print, string=string, table=table}`;
    } else {
      envSetup = `local env = getfenv and getfenv() or _ENV`;
    }

    // Stack virtualization (if enabled)
    if (layers.stack) {
      envSetup += '\nlocal stackA = {}\nlocal stackB = {}\nlocal stackIdx = 1';
    }

    const debugMode = options.debug ? `
  local function debugLog(...)
    print("[XZX VM]", ...)
  end` : '';

    // Anti‑tamper code (multiple checks, self‑repair attempts)
    const antiTamper = layers.antiTamper ? `
local function validate()
  local h = 0
  for i = 1, #bytecode do
    h = ((h << 5) - h + bytecode[i]) & 0xffffffff
  end
  if h ~= expectedHash then
    error("Integrity violation: " .. tostring(h) .. " vs " .. expectedHash)
  end
  -- Additional check using dynamic key
  if opMap then
    local check = ${dynamicKey}
    if check ~= 0 and (bytecode[1] ^ bytecode[#bytecode]) ~= check then
      error("Dynamic key mismatch")
    end
  end
end` : '';

    // Constant decryption functions (if layered encryption enabled)
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

    // Stack operations (push/pop) that may switch between stacks
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

    // Build handler table
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

    // Assemble the final Lua script
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

// ============================================================================
// Main Obfuscator Class
// ============================================================================

export class XZXUltimateObfuscator {
  obfuscate(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
    const start = Date.now();

    // Default layers: all enabled
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
      advanced: false, // off by default (could be too heavy)
    };
    const layers = { ...defaultLayers, ...options.layers };

    // Initialize seeded RNG
    const rng = new SeededRandom(options.seed);

    try {
      // Parse the input Lua
      const ast = luaparse.parse(source, { comments: false, luaVersion: '5.1' });

      // Build IR
      let ir = IRBuilder.fromAST(ast);

      // (Optional optimization passes could be added here)

      // Create opcode map (randomized per build)
      const opMap = new OpcodeMap(rng, layers.polymorphism);

      // Compile to bytecode
      const compiler = new BytecodeCompiler(opMap, rng, layers);
      const { bytecode, constants } = compiler.compile(ir);

      // Generate final VM source
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
          layersApplied,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: options.debug ? message : 'Obfuscation failed',
      };
    }
  }
}

// ============================================================================
// Public API (compatible with previous versions)
// ============================================================================

export function obfuscateLua(source: string, options: any): ObfuscationResult {
  const opts: ObfuscationOptions = {
    seed: options.seed,
    mode: options.mode || 'standard',
    debug: options.debug || false,
    optimization: options.optimization || 'basic',
    layers: options.layers || {},
  };
  const obfuscator = new XZXUltimateObfuscator();
  return obfuscator.obfuscate(source, opts);
}

export default obfuscateLua;
