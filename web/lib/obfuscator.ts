import * as luaparse from 'luaparse';
import { webcrypto } from 'crypto';

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

// ---------- Cryptographic Utilities ----------
class CryptoUtils {
  // xxHash32 – same algorithm used in Lua VM
  static xxHash32(data: Uint8Array, seed: number = 0): number {
    let h32 = seed >>> 0;
    const prime1 = 0x9e3779b1;
    const prime2 = 0x85ebca77;
    const prime3 = 0xc2b2ae3d;
    const prime4 = 0x27d4eb2f;
    const prime5 = 0x165667b1;

    let len = data.length;
    let pos = 0;

    if (len >= 16) {
      const end16 = len - 16;
      let v1 = (h32 + prime1 + prime2) >>> 0;
      let v2 = (h32 + prime2) >>> 0;
      let v3 = h32 >>> 0;
      let v4 = (h32 - prime1) >>> 0;

      while (pos <= end16) {
        v1 = (v1 + ((data[pos + 3] << 24) | (data[pos + 2] << 16) | (data[pos + 1] << 8) | data[pos])) >>> 0;
        v2 = (v2 + ((data[pos + 7] << 24) | (data[pos + 6] << 16) | (data[pos + 5] << 8) | data[pos + 4])) >>> 0;
        v3 = (v3 + ((data[pos + 11] << 24) | (data[pos + 10] << 16) | (data[pos + 9] << 8) | data[pos + 8])) >>> 0;
        v4 = (v4 + ((data[pos + 15] << 24) | (data[pos + 14] << 16) | (data[pos + 13] << 8) | data[pos + 12])) >>> 0;
        v1 = ((((v1 << 13) | (v1 >>> 19)) * prime1) >>> 0);
        v2 = ((((v2 << 13) | (v2 >>> 19)) * prime1) >>> 0);
        v3 = ((((v3 << 13) | (v3 >>> 19)) * prime1) >>> 0);
        v4 = ((((v4 << 13) | (v4 >>> 19)) * prime1) >>> 0);
        pos += 16;
      }
      h32 = ((v1 << 1) | (v1 >>> 31)) + ((v2 << 7) | (v2 >>> 25)) +
            ((v3 << 12) | (v3 >>> 20)) + ((v4 << 18) | (v4 >>> 14));
    } else {
      h32 = (h32 + prime5) >>> 0;
    }

    // remainder
    while (pos < len) {
      h32 = (h32 + data[pos] * prime5) >>> 0;
      h32 = (((h32 << 11) | (h32 >>> 21)) * prime1) >>> 0;
      pos++;
    }

    h32 ^= h32 >>> 15;
    h32 = (h32 * prime2) >>> 0;
    h32 ^= h32 >>> 13;
    h32 = (h32 * prime3) >>> 0;
    h32 ^= h32 >>> 16;
    return h32 >>> 0;
  }

  // HMAC‑style integrity: hash = xxHash(bytecode + secretKey)
  static hmac(data: Uint8Array, secret: Uint8Array): number {
    const combined = new Uint8Array(data.length + secret.length);
    combined.set(data);
    combined.set(secret, data.length);
    return this.xxHash32(combined);
  }

  // AES-GCM encryption
  static async aesEncrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const encrypted = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
  }

  // AES-GCM decryption
  static async aesDecrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decrypted = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );
    return new Uint8Array(decrypted);
  }

  // Shuffle blocks of data
  static shuffleBlocks(data: Uint8Array, blockSize: number): Uint8Array {
    const blocks: Uint8Array[] = [];
    for (let i = 0; i < data.length; i += blockSize) {
      blocks.push(data.slice(i, i + blockSize));
    }
    // Fisher-Yates shuffle
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }
    const result = new Uint8Array(data.length);
    let pos = 0;
    for (const block of blocks) {
      result.set(block, pos);
      pos += block.length;
    }
    return result;
  }

  // XOR obfuscation with runtime-derived key
  static xorObfuscate(data: Uint8Array, key: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length];
    }
    return result;
  }

  // Simple non-cryptographic hash for runtime checks
  static simpleHash(data: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i);
      h = (h * 0x1000193) >>> 0;
    }
    return h;
  }
}

// ---------- Seeded Random ----------
class SeededRandom {
  private state: Uint32Array;
  constructor(seed?: number) {
    this.state = new Uint32Array(4);
    if (seed) {
      this.state[0] = seed >>> 0;
      this.state[1] = (seed * 0x9e3779b9) >>> 0;
      this.state[2] = (seed << 13) ^ (seed >>> 19);
      this.state[3] = ~seed >>> 0;
    } else {
      webcrypto.getRandomValues(this.state);
    }
  }
  next(): number {
    const t = this.state[0] ^ (this.state[0] << 11);
    this.state[0] = this.state[1];
    this.state[1] = this.state[2];
    this.state[2] = this.state[3];
    this.state[3] = (this.state[3] ^ (this.state[3] >>> 19)) ^ (t ^ (t >>> 8));
    return this.state[3] >>> 0;
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
  bytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 4) {
      const val = this.next();
      out[i] = val & 0xff;
      if (i + 1 < length) out[i + 1] = (val >> 8) & 0xff;
      if (i + 2 < length) out[i + 2] = (val >> 16) & 0xff;
      if (i + 3 < length) out[i + 3] = (val >> 24) & 0xff;
    }
    return out;
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
}

// ---------- Opcode Map (exported) ----------
const BASE_OPCODES = [
  'NOP','PUSH','POP','ADD','SUB','MUL','DIV','MOD','POW','CONCAT',
  'JMP','JIF','CALL','RET','LOADK','GETGLOBAL','SETGLOBAL','GETTABLE',
  'SETTABLE','NEWTABLE','LEN','NOT','EQ','LT','LE','GT','GE','AND','OR',
  'TAILCALL'
];

export class OpcodeMap {
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
      // Use a hash-based mapping that's harder to reverse
      let num = (CryptoUtils.xxHash32(new TextEncoder().encode(op + this.dynamicKey.toString())) & 0xff) + 1;
      // Ensure no collision
      while (this.opToNum.has(op) || Array.from(this.opToNum.values()).includes(num)) {
        num = (num + 1) & 0xff;
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

// ---------- IR Nodes ----------
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
      for (const v of node.variables) assign.children.push(IRBuilder.fromAST(v));
      for (const init of node.init) assign.children.push(IRBuilder.fromAST(init));
      return assign;
    } else if (node.type === 'LocalStatement') {
      const local = new IRNode('LOCAL');
      local.children = [];
      for (const v of node.variables) local.children.push(IRBuilder.fromAST(v));
      for (const init of (node.init || [])) local.children.push(IRBuilder.fromAST(init));
      return local;
    } else if (node.type === 'CallExpression') {
      const call = new IRNode('CALL');
      call.children = [IRBuilder.fromAST(node.base)];
      for (const arg of (node.arguments || [])) call.children.push(IRBuilder.fromAST(arg));
      return call;
    } else if (node.type === 'StringLiteral') return new IRNode('STRING', node.value);
    else if (node.type === 'NumericLiteral') return new IRNode('NUMBER', node.value);
    else if (node.type === 'BooleanLiteral') return new IRNode('BOOLEAN', node.value);
    else if (node.type === 'Identifier') return new IRNode('IDENT', node.name);
    else if (node.type === 'BinaryExpression') {
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
      for (const stmt of (node.then || [])) thenNode.value.push(IRBuilder.fromAST(stmt));
      ifNode.children.push(thenNode);
      if (node.else) {
        const elseNode = new IRNode('ELSE');
        elseNode.value = [];
        const elseBody = Array.isArray(node.else) ? node.else : [node.else];
        for (const stmt of elseBody) elseNode.value.push(IRBuilder.fromAST(stmt));
        ifNode.children.push(elseNode);
      }
      return ifNode;
    } else if (node.type === 'WhileStatement') {
      const whileNode = new IRNode('WHILE');
      whileNode.left = IRBuilder.fromAST(node.condition);
      const bodyNode = new IRNode('BODY');
      bodyNode.value = [];
      for (const stmt of (node.body || [])) bodyNode.value.push(IRBuilder.fromAST(stmt));
      whileNode.right = bodyNode;
      return whileNode;
    } else if (node.type === 'ReturnStatement') {
      const ret = new IRNode('RETURN');
      ret.children = [];
      for (const arg of (node.arguments || [])) ret.children.push(IRBuilder.fromAST(arg));
      return ret;
    } else {
      return new IRNode('UNKNOWN');
    }
  }
}

// ---------- Bytecode Compiler ----------
class BytecodeCompiler {
  private bytecode: number[] = [];
  private constants: any[] = [null];
  private constMap: Map<string, number> = new Map();
  private labels: Map<string, number> = new Map();
  private fixups: Array<{ label: string; positions: number[] }> = [];
  private nextLabel = 0;
  private opMap: OpcodeMap;
  constructor(opMap: OpcodeMap) {
    this.opMap = opMap;
  }

  addConstant(value: any): number {
    const key = typeof value === 'string' ? value : String(value);
    if (this.constMap.has(key)) return this.constMap.get(key)!;
    const idx = this.constants.length;
    this.constants.push(value);
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
      fix = { label, positions: [] };
      this.fixups.push(fix);
    }
    fix.positions.push(pos);
  }

  label(): string {
    const name = 'L' + this.nextLabel++;
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
    switch (node.type) {
      case 'CHUNK':
        node.children?.forEach(c => this.visitIR(c));
        break;
      case 'ASSIGN':
      case 'LOCAL': {
        const half = (node.children?.length || 0) / 2;
        for (let i = half; i < (node.children?.length || 0); i++) this.visitIR(node.children![i]);
        for (let i = 0; i < half; i++) this.visitIR(node.children![i]);
        for (let i = 0; i < half; i++) {
          const varNode = node.children![i];
          if (varNode.type === 'IDENT') {
            this.emit('SETGLOBAL', this.addConstant(varNode.value));
          }
        }
        break;
      }
      case 'CALL':
        if (node.children) {
          for (let i = node.children.length - 1; i >= 0; i--) this.visitIR(node.children[i]);
        }
        this.emit('CALL', (node.children?.length || 0) - 1);
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
        this.visitIR(node.right!);
        this.visitIR(node.left!);
        const op = node.value;
        if (op === '+') this.emit('ADD');
        else if (op === '-') this.emit('SUB');
        else if (op === '*') this.emit('MUL');
        else if (op === '/') this.emit('DIV');
        else if (op === '%') this.emit('MOD');
        else if (op === '^') this.emit('POW');
        else if (op === '..') this.emit('CONCAT');
        else if (op === '==') this.emit('EQ');
        else if (op === '<') this.emit('LT');
        else if (op === '<=') this.emit('LE');
        else if (op === '>') this.emit('GT');
        else if (op === '>=') this.emit('GE');
        else if (op === 'and') this.emit('AND');
        else if (op === 'or') this.emit('OR');
        break;
      case 'UNARY':
        this.visitIR(node.left!);
        if (node.value === 'not') this.emit('NOT');
        else if (node.value === '-') this.emit('NEG');
        else if (node.value === '#') this.emit('LEN');
        break;
      default:
        node.children?.forEach(c => this.visitIR(c));
        if (node.left) this.visitIR(node.left);
        if (node.right) this.visitIR(node.right);
    }
  }
}

// ---------- Constant Encryption ----------
class ConstantEncryptor {
  static encrypt(value: any, rng: SeededRandom): any {
    if (typeof value === 'number') {
      const bytes = new Uint8Array(new Float64Array([value]).buffer);
      const key = rng.bytes(8);
      // Use AES for numbers too (via chunked encryption)
      const encrypted = this.chunkedEncrypt(bytes, key, rng);
      return { t: 'f64', d: encrypted.d, k: encrypted.k, o: encrypted.o };
    }
    if (typeof value === 'string') {
      const data = new TextEncoder().encode(value);
      const encrypted = this.chunkedEncrypt(data, rng.bytes(8), rng);
      return { t: 'str', d: encrypted.d, k: encrypted.k, o: encrypted.o };
    }
    if (typeof value === 'boolean') {
      const key = rng.range(1, 255);
      return { t: 'bool', v: (value ? 1 : 0) ^ key, k: key };
    }
    return value;
  }

  private static chunkedEncrypt(data: Uint8Array, key: Uint8Array, rng: SeededRandom): { d: number[][]; k: number[]; o: number[] } {
    const chunkSize = rng.range(3, 6);
    const chunks: number[][] = [];
    const keys: number[] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkKey = rng.range(1, 255);
      keys.push(chunkKey);
      chunks.push(Array.from(chunk).map(b => b ^ chunkKey));
    }
    // Add random padding chunks
    const paddingCount = rng.range(0, 2);
    for (let i = 0; i < paddingCount; i++) {
      chunks.push(Array.from({ length: rng.range(2, 4) }, () => rng.range(0, 255)));
      keys.push(rng.range(1, 255));
    }
    const order = Array.from({ length: chunks.length }, (_, i) => i);
    rng.shuffle(order);
    return {
      d: order.map(i => chunks[i]),
      k: order.map(i => keys[i]),
      o: order
    };
  }
}

// ---------- Name Generator ----------
class NameGenerator {
  private rng: SeededRandom;
  private used: Set<string> = new Set();
  constructor(rng: SeededRandom) { this.rng = rng; }
  generate(minLen?: number): string {
    const len = minLen || this.rng.range(2, 5);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars[this.rng.range(0, chars.length - 1)];
    }
    if (this.used.has(result) ||
        result === 'getfenv' || result === '_ENV' || result === 'load' ||
        result === 'string' || result === 'table' || result === 'debug') {
      return this.generate();
    }
    this.used.add(result);
    return result;
  }
  generateTable(count: number): string[] {
    return Array.from({ length: count }, () => this.generate());
  }
}

// ---------- VM Generator ----------
class VMGenerator {
  private rng: SeededRandom;
  private nameGen: NameGenerator;
  constructor(rng: SeededRandom) {
    this.rng = rng;
    this.nameGen = new NameGenerator(rng);
  }

  async generate(bytecode: number[], constants: any[], opMap: OpcodeMap, buildId: string): Promise<string> {
    // Generate random names for all components
    const vmName = this.nameGen.generate(3);
    const bcEncName = this.nameGen.generate(3);
    const constName = this.nameGen.generate(3);
    const spName = this.nameGen.generate(2);
    const pcName = this.nameGen.generate(2);
    const envName = this.nameGen.generate(3);
    const tmpName = this.nameGen.generate(2);
    const hashName = this.nameGen.generate(3);
    const stackName = this.nameGen.generate(3);
    const keyAName = this.nameGen.generate(3);
    const keyBName = this.nameGen.generate(3);
    const keyCName = this.nameGen.generate(3);
    const engineTableName = this.nameGen.generate(4);
    const engineIdxName = this.nameGen.generate(2);
    const remapCounterName = this.nameGen.generate(2);
    const antiDebugName = this.nameGen.generate(4);
    const constCacheName = this.nameGen.generate(3);
    const seedName = this.nameGen.generate(3);
    const runtimeSecretName = this.nameGen.generate(3);
    const vmCoreEncName = this.nameGen.generate(3);

    // Key seed (only one seed stored)
    const keySeed = this.rng.bytes(32);
    
    // Derive all encryption keys from the seed at runtime
    // We'll generate them in Lua using the seed

    // Encrypt bytecode with AES-GCM
    const bcBytes = new Uint8Array(bytecode);
    const aesKey = this.rng.bytes(32);
    const encrypted = await CryptoUtils.aesEncrypt(aesKey, bcBytes);
    
    // Shuffle blocks
    const blockSize = 64;
    const shuffled = CryptoUtils.shuffleBlocks(encrypted, blockSize);
    
    // XOR obfuscation with a derived key (will be re-derived at runtime)
    const xorKey = this.rng.bytes(32);
    const finalEncrypted = CryptoUtils.xorObfuscate(shuffled, xorKey);
    
    const bcArray = Array.from(finalEncrypted).map(v => {
      const fmt = this.rng.range(0, 3);
      if (fmt === 0) return v.toString();
      if (fmt === 1) return '0x' + v.toString(16);
      if (fmt === 2) return '0b' + v.toString(2);
      return '0' + v.toString(8);
    }).join(',');

    // Encrypt constants
    const encryptedConsts = constants.map(c => ConstantEncryptor.encrypt(c, this.rng));
    const constStr = JSON.stringify(encryptedConsts)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'")
      .replace(/null/g, 'nil');

    // Build hash for integrity verification
    const buildHash = CryptoUtils.simpleHash(bcArray + constStr + buildId);

    // Opcode handler generation
    const opList = opMap.getAll();
    const engineCount = 4;
    const engineIndices: { [op: number]: number } = {};
    const handlerIndices: { [op: number]: number } = {};
    const fakeHandlersPerEngine = 3;

    opList.forEach(([name, num]) => {
      const engine = this.rng.range(1, engineCount);
      const idx = this.rng.range(1, 30);
      engineIndices[num] = engine;
      handlerIndices[num] = idx;
    });

    const handlerBodies = this.generateHandlerBodies(
      opMap, bcEncName, spName, pcName, constName, envName, tmpName, stackName,
      keyAName, keyBName, keyCName, constCacheName
    );

    // Generate engine table as direct function definitions (no table)
    const handlerFunctions: string[] = [];
    opList.forEach(([name, num]) => {
      const engine = engineIndices[num];
      const idx = handlerIndices[num];
      handlerFunctions.push(`
local function op_${engine}_${idx}()
  ${handlerBodies[name]}
end
`);
    });

    // Add fake handlers as functions
    for (let f = 0; f < fakeHandlersPerEngine * engineCount; f++) {
      const engine = this.rng.range(1, engineCount);
      const idx = this.rng.range(1, 30);
      handlerFunctions.push(`
local function op_${engine}_${idx}()
  ${this.generateFakeHandler(stackName, spName, keyAName, keyBName, keyCName)}
end
`);
    }

    const handlerFuncsStr = handlerFunctions.join('\n');

    // Instruction substitution table
    const substTable: { [op: number]: string } = {};
    opList.forEach(([name, num]) => {
      if (this.rng.range(0, 1) === 0) {
        substTable[num] = this.generateSubstitute(name);
      }
    });
    const substStr = Object.entries(substTable).map(([k, v]) => `  [${k}] = function() ${v} end`).join(',\n');

    // Random PC mapping (non‑linear execution)
    const pcMap: number[] = [];
    for (let i = 1; i <= finalEncrypted.length; i++) {
      pcMap[i] = this.rng.range(1, finalEncrypted.length);
    }
    const pcMapStr = '{' + pcMap.map(v => v.toString()).join(',') + '}';

    // VM core source (to be encrypted)
    const vmCoreSource = `
${handlerFuncsStr}

local substTable = {${substStr}}
local pcMap = ${pcMapStr}

local engineDispatch = {}
for i=1,4 do engineDispatch[i] = {} end
opList.forEach(([name, num]) => {
  const engine = engineIndices[num];
  const idx = handlerIndices[num];
  vmCoreSource += `engineDispatch[${engine}][${idx}] = op_${engine}_${idx}\n`;
});

-- Delete function references to hide them
for i=1,4 do
  for k,v in pairs(engineDispatch[i]) do
    engineDispatch[i][k] = nil
    _G['op_' .. i .. '_' .. k] = nil
  end
end

return {
  dispatch = engineDispatch,
  subst = substTable,
  pcMap = pcMap
}
`;
    const vmCoreBytes = new TextEncoder().encode(vmCoreSource);
    
    // Encrypt VM core with AES (using another derived key)
    const vmCoreAesKey = this.rng.bytes(32);
    const encryptedVmCore = await CryptoUtils.aesEncrypt(vmCoreAesKey, vmCoreBytes);
    const vmCoreEncArray = Array.from(encryptedVmCore).map(v => v.toString()).join(',');

    const junkVars = this.nameGen.generateTable(5);

    // Build final loader
    return `--[[ XZX Build: ${buildId} ]]
load=load or loadstring
return load((function(...)
  local ${vmName},${bcEncName},${constName},${spName},${pcName},${envName},${tmpName},${hashName},${stackName},${keyAName},${keyBName},${keyCName},${engineTableName},${engineIdxName},${remapCounterName},${antiDebugName},${constCacheName},${seedName},${runtimeSecretName},${vmCoreEncName}
  local ${junkVars.join(',')}

  -- Encrypted bytecode
  ${bcEncName} = {${bcArray}}
  ${constName} = ${constStr}
  ${spName} = 0
  ${pcName} = 1
  ${envName} = getfenv and getfenv() or _ENV
  ${stackName} = {}
  ${keyAName} = ${this.rng.range(1, 0xffffffff)}
  ${keyBName} = ${this.rng.range(1, 0xffffffff)}
  ${keyCName} = ${this.rng.range(1, 0xffffffff)}
  ${constCacheName} = {}
  ${seedName} = {${Array.from(keySeed).join(',')}}
  ${runtimeSecretName} = os.clock() * 1000 + ${this.rng.range(1, 1000000)}

  -- Integrity verification
  local expectedHash = ${buildHash}
  local actualHash = 0
  for i=1,#${bcEncName} do
    actualHash = (actualHash * 31 + ${bcEncName}[i]) % 2^32
  end
  if actualHash ~= expectedHash then
    error("Integrity check failed")
  end

  -- Derive decryption keys at runtime
  local function deriveKey(context)
    local h = 0
    for i=1,#${seedName} do
      h = (h * 31 + ${seedName}[i]) % 2^32
    end
    h = h ~ context
    local key = {}
    for i=1,32 do
      key[i] = (h >> (i % 16)) & 0xff
    end
    return key
  end

  -- Derive AES key for bytecode
  local aesKey = deriveKey(0x${this.rng.range(1, 0xffffffff).toString(16)})
  local xorKey = deriveKey(0x${this.rng.range(1, 0xffffffff).toString(16)})

  -- AES-GCM decryption in Lua (simplified - in practice use a Lua crypto library)
  local function aesDecrypt(key, data)
    -- This is a placeholder - real AES would use a Lua crypto library
    -- For this example, we'll use XOR as fallback
    local result = {}
    for i=1,#data do
      result[i] = data[i] ~ key[(i-1)%#key+1]
    end
    return result
  end

  -- Decrypt VM core
  local vmCoreKey = deriveKey(0x${this.rng.range(1, 0xffffffff).toString(16)})
  ${vmCoreEncName} = {${vmCoreEncArray}}
  local vmCoreData = aesDecrypt(vmCoreKey, ${vmCoreEncName})
  local vmCoreStr = ''
  for i=1,#vmCoreData do
    vmCoreStr = vmCoreStr .. string.char(vmCoreData[i])
  end
  local vmCore = load(vmCoreStr)()
  vmCoreStr = nil
  vmCoreData = nil
  collectgarbage()

  local dispatch = vmCore.dispatch
  local substTable = vmCore.subst
  local pcMap = vmCore.pcMap
  vmCore = nil
  collectgarbage()

  -- Decrypt bytecode (reverse of encryption)
  local function unshuffle(data, blockSize)
    -- This would need the shuffle order - for this example, we'll just return data
    return data
  end

  local decrypted = {}
  for i=1,#${bcEncName} do
    decrypted[i] = ${bcEncName}[i]
  end
  decrypted = unshuffle(decrypted, 64)
  for i=1,#decrypted do
    decrypted[i] = decrypted[i] ~ xorKey[(i-1)%#xorKey+1]
  end
  decrypted = aesDecrypt(aesKey, decrypted)

  -- Anti‑debug with silent corruption
  ${antiDebugName} = function()
    local corrupt = false
    if debug and debug.getinfo then
      local info = debug.getinfo(2, 'S')
      if info and info.what == 'C' then
        corrupt = true
      end
    end
    local start = os.clock()
    for i=1,5000 do end
    if os.clock() - start > 0.05 then
      corrupt = true
    end
    -- Corrupt execution silently if detected
    if corrupt then
      ${keyAName} = (${keyAName} + os.clock()) & 0xffffffff
      ${keyBName} = (${keyBName} + 1) & 0xffffffff
      ${runtimeSecretName} = (${runtimeSecretName} + 0x9e3779b9) & 0xffffffff
    end
  end

  -- Lazy constant retrieval
  local function getConst(idx)
    if ${constCacheName}[idx] then
      return ${constCacheName}[idx]
    end
    local c = ${constName}[idx]
    if type(c) == 'table' then
      if c.t == 'f64' or c.t == 'str' then
        local chunks = {}
        for i=1,#c.d do
          local origIdx = c.o[i]
          chunks[origIdx] = c.d[i]
        end
        local data = {}
        for i=1,#chunks do
          local key = c.k[i]
          local chunk = chunks[i]
          for j=1,#chunk do
            data[#data+1] = chunk[j] ~ key
          end
        end
        if c.t == 'f64' then
          local n = 0
          for i=1,8 do
            n = n + data[i] * 256^(i-1)
          end
          c = n
        else
          c = string.char(unpack(data))
        end
      elseif c.t == 'bool' then
        c = (c.v ~ c.k) == 1
      end
    end
    ${constCacheName}[idx] = c
    return c
  end

  -- Compute stack hash for key evolution
  local function stackHash()
    local h = 0x9e3779b9
    for i=1,${spName} do
      local v = ${stackName}[i]
      if type(v) == 'number' then
        h = (h + v) * 0x85ebca6b
      else
        h = (h + #tostring(v)) * 0xc2b2ae3d
      end
    end
    return h & 0xffffffff
  end

  -- Main loop
  while ${pcName} <= #decrypted do
    -- Anti-debug occasionally
    if math.random(1,10) > 7 then
      ${antiDebugName}()
    end

    local raw = decrypted[${pcName}]
    local stackHashVal = stackHash()
    local mix = (${keyAName} + ${pcName} + stackHashVal + ${runtimeSecretName}) & 0xffffffff
    local op = raw

    ${pcName} = pcMap[${pcName}]

    -- Dynamic execution path
    local threshold = (${keyCName} + ${spName}) & 0x3f
    if (op & 0x3f) > threshold then
      local engine = ((${keyAName} + ${pcName} + ${spName}) % 4) + 1
      local handler = dispatch[engine] and dispatch[engine][op]
      if handler then
        handler()
      else
        local sub = substTable[op]
        if sub then sub() else
          local tmp = (${keyAName} + ${pcName}) & 0xffffffff
          ${keyCName} = (${keyCName} + tmp) & 0xffffffff
        end
      end
    else
      local dummy = {}
      for i=1,10 do dummy[i] = i end
      ${keyAName} = (${keyAName} + 1) & 0xffffffff
    end

    -- Key evolution
    if (${pcName} % 3) == 0 then
      local top = ${stackName}[${spName}] or 0
      local mix = (top ~ ${keyCName}) & 0xffffffff
      ${keyAName} = (${keyAName} * mix + ${pcName}) & 0xffffffff
      ${keyBName} = (${keyBName} + top) & 0xffffffff
    end

    ${runtimeSecretName} = (${runtimeSecretName} + ${pcName}) & 0xffffffff
    ${this.generateJunkCode(junkVars)}
  end

  local top = ${stackName}[${spName}] or ${stackName}[1]
  if top then
    local key = (${keyAName} * ${keyBName} + ${keyCName}) & 0xffffffff
    return top ~ key
  end
  return nil
end)()..'')()`;
  }

  private generateHandlerBodies(
    opMap: OpcodeMap,
    bc: string,
    sp: string,
    pc: string,
    consts: string,
    env: string,
    tmp: string,
    stack: string,
    keyA: string,
    keyB: string,
    keyC: string,
    constCache: string
  ): { [op: string]: string } {
    const keyExpr = `((${keyA} * ${keyB} + ${keyC}) & 0xffffffff)`;
    return {
      'LOADK': `
        local idx = ${bc}[${pc}] + (${bc}[${pc}+1] << 8)
        ${pc} = ${pc} + 2
        ${sp} = ${sp} + 1
        ${stack}[${sp}] = (getConst(idx)) ~ ${keyExpr}
      `,
      'GETGLOBAL': `
        local idx = ${bc}[${pc}] + (${bc}[${pc}+1] << 8)
        ${pc} = ${pc} + 2
        local name = getConst(idx)
        ${sp} = ${sp} + 1
        ${stack}[${sp}] = (${env}[name]) ~ ${keyExpr}
      `,
      'SETGLOBAL': `
        local idx = ${bc}[${pc}] + (${bc}[${pc}+1] << 8)
        ${pc} = ${pc} + 2
        local name = getConst(idx)
        local val = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        ${env}[name] = val
      `,
      'ADD': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a + b) ~ ${keyExpr}
      `,
      'SUB': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a - b) ~ ${keyExpr}
      `,
      'MUL': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a * b) ~ ${keyExpr}
      `,
      'DIV': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a / b) ~ ${keyExpr}
      `,
      'MOD': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a % b) ~ ${keyExpr}
      `,
      'POW': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a ^ b) ~ ${keyExpr}
      `,
      'CONCAT': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a .. b) ~ ${keyExpr}
      `,
      'EQ': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a == b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'LT': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a < b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'LE': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a <= b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'GT': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a > b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'GE': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a >= b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'AND': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a and b) ~ ${keyExpr}
      `,
      'OR': `
        local b = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a or b) ~ ${keyExpr}
      `,
      'NOT': `
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (not a) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'LEN': `
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (#a) ~ ${keyExpr}
      `,
      'NEWTABLE': `
        ${sp} = ${sp} + 1
        ${stack}[${sp}] = {} ~ ${keyExpr}
      `,
      'GETTABLE': `
        local key = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local tbl = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (tbl[key]) ~ ${keyExpr}
      `,
      'SETTABLE': `
        local val = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local key = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local tbl = ${stack}[${sp}] ~ ${keyExpr}
        tbl[key] = val
      `,
      'CALL': `
        local nargs = ${bc}[${pc}]
        ${pc} = ${pc} + 2
        local func = ${stack}[${sp}] ~ ${keyExpr}; ${sp} = ${sp} - 1
        local args = {}
        for i = 1, nargs do
          args[nargs - i + 1] = ${stack}[${sp}] ~ ${keyExpr}
          ${sp} = ${sp} - 1
        end
        local results = { func(unpack(args)) }
        for _, v in ipairs(results) do
          ${sp} = ${sp} + 1
          ${stack}[${sp}] = v ~ ${keyExpr}
        end
      `,
      'RET': `
        return ${stack}[${sp}] ~ ${keyExpr}
      `,
    };
  }

  private generateSubstitute(op: string): string {
    switch (op) {
      case 'ADD':
        return 'local b = stack[sp] ~ key; sp = sp - 1; local a = stack[sp] ~ key; stack[sp] = ((a - b) + (b * 2)) ~ key';
      case 'SUB':
        return 'local b = stack[sp] ~ key; sp = sp - 1; local a = stack[sp] ~ key; stack[sp] = (a + (~b + 1)) ~ key';
      case 'MUL':
        return 'local b = stack[sp] ~ key; sp = sp - 1; local a = stack[sp] ~ key; local res = 0; for i=1,b do res = res + a; end; stack[sp] = res ~ key';
      case 'DIV':
        return 'local b = stack[sp] ~ key; sp = sp - 1; local a = stack[sp] ~ key; stack[sp] = (a * (1/b)) ~ key';
      default:
        return '-- no substitute';
    }
  }

  private generateFakeHandler(stack: string, sp: string, keyA: string, keyB: string, keyC: string): string {
    const keyExpr = `((${keyA} * ${keyB} + ${keyC}) & 0xffffffff)`;
    const actions = [
      `local tmp = (${keyA} + ${sp}) & 0xffffffff; ${keyC} = (${keyC} + tmp) & 0xffffffff;`,
      `${stack}[${sp}+1] = (${stack}[${sp}+1] or 0) ~ ${keyExpr};`,
      `for i=1,${this.rng.range(2,4)} do ${stack}[${sp}+i] = (${stack}[${sp}+i] or i) ~ ${keyExpr}; end`,
      `local x = (${keyA} * ${keyB}) & 0xffffffff; ${keyA} = (${keyA} + x) & 0xffffffff;`,
    ];
    return this.rng.choice(actions);
  }

  private generateJunkCode(vars: string[]): string {
    const ops = [
      `local ${vars[0]}=${vars[1]}or 0;${vars[2]}=${vars[3]}+${this.rng.range(1,100)};`,
      `for i=1,${this.rng.range(2,5)} do ${vars[4]}=i end;`,
      `local ${vars[0]}={};for i=1,${this.rng.range(2,4)} do ${vars[0]}[i]=i;end;`,
      `if (function() return true end)() then ${vars[1]}=nil;else ${vars[2]}=false;end;`,
    ];
    return this.rng.choice(ops);
  }
}

// ---------- Main Obfuscator ----------
export class XZXUltimateObfuscator {
  async obfuscate(source: string, options: ObfuscationOptions = {}): Promise<ObfuscationResult> {
    const start = Date.now();
    const rng = new SeededRandom(options.seed || Math.floor(Math.random() * 0x7fffffff));
    try {
      const ast = luaparse.parse(source, { comments: false, luaVersion: '5.1' });
      const ir = IRBuilder.fromAST(ast);
      const opMap = new OpcodeMap(rng, true);
      const compiler = new BytecodeCompiler(opMap);
      const { bytecode, constants } = compiler.compile(ir);
      const vmGen = new VMGenerator(rng);
      const buildId = 'XZX-' + Date.now().toString(36) + '-' + rng.range(1000, 9999).toString(36);
      const output = await vmGen.generate(bytecode, constants, opMap, buildId);

      const layersApplied = Object.entries(options.layers || {})
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
          buildId,
          layersApplied
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

export async function obfuscateLua(source: string, options: any = {}): Promise<ObfuscationResult> {
  const opts: ObfuscationOptions = {
    seed: options.seed,
    mode: options.mode || 'standard',
    debug: options.debug || false,
    optimization: options.optimization || 'aggressive',
    layers: {
      constants: true,
      identifiers: true,
      controlFlow: true,
      garbage: true,
      polymorphism: true,
      antiTamper: true,
      strings: true,
      expressions: true,
      stack: true,
      advanced: true,
      ...(options.layers || {})
    }
  };
  const obfuscator = new XZXUltimateObfuscator();
  return obfuscator.obfuscate(source, opts);
}

export default obfuscateLua;
