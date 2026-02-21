import * as luaparse from 'luaparse';

// ---------- Crypto Utilities with Environment Detection ----------
class CryptoUtils {
  private static crypto: any;
  private static useNodeCrypto = false;
  private static useWebCrypto = false;

  static {
    // Detect available crypto implementation
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      this.crypto = globalThis.crypto;
      this.useWebCrypto = true;
    } else if (typeof window !== 'undefined' && window.crypto) {
      this.crypto = window.crypto;
      this.useWebCrypto = true;
    } else if (typeof require !== 'undefined') {
      try {
        // Try to use Node.js crypto
        const nodeCrypto = require('crypto');
        if (nodeCrypto && nodeCrypto.webcrypto) {
          this.crypto = nodeCrypto.webcrypto;
          this.useWebCrypto = true;
        } else if (nodeCrypto && nodeCrypto.randomBytes) {
          this.crypto = nodeCrypto;
          this.useNodeCrypto = true;
        }
      } catch (e) {
        // Node.js crypto not available
      }
    }

    // If no crypto available, use fallback
    if (!this.crypto) {
      console.warn('No crypto implementation found, using fallback (insecure for production)');
      this.crypto = this.createFallbackCrypto();
    }
  }

  private static createFallbackCrypto(): any {
    return {
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {
        importKey: async () => {},
        encrypt: async () => {},
        decrypt: async () => {}
      }
    };
  }

  // xxHash32 implementation
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

  // HMAC-style integrity
  static hmac(data: Uint8Array, secret: Uint8Array): number {
    const combined = new Uint8Array(data.length + secret.length);
    combined.set(data);
    combined.set(secret, data.length);
    
    // Double hash for stronger integrity
    let h1 = this.xxHash32(combined, 0x9e3779b9);
    let h2 = this.xxHash32(combined, 0x85ebca6b);
    return (h1 ^ h2) >>> 0;
  }

  // XOR-based encryption (fallback when AES not available)
  static xorEncrypt(key: Uint8Array, data: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length];
    }
    return result;
  }

  // AES-GCM encryption with fallback
  static async aesEncrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    if (this.useWebCrypto && this.crypto.subtle) {
      try {
        const cryptoKey = await this.crypto.subtle.importKey(
          'raw',
          key,
          { name: 'AES-GCM' },
          false,
          ['encrypt']
        );
        const iv = this.getRandomValues(new Uint8Array(12));
        const encrypted = await this.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          data
        );
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv);
        result.set(new Uint8Array(encrypted), iv.length);
        return result;
      } catch (e) {
        // Fallback to XOR if AES fails
        return this.xorEncrypt(key, data);
      }
    } else {
      // Fallback to XOR if WebCrypto not available
      return this.xorEncrypt(key, data);
    }
  }

  // AES-GCM decryption with fallback
  static async aesDecrypt(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    if (this.useWebCrypto && this.crypto.subtle && data.length > 12) {
      try {
        const iv = data.slice(0, 12);
        const ciphertext = data.slice(12);
        const cryptoKey = await this.crypto.subtle.importKey(
          'raw',
          key,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
        const decrypted = await this.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          ciphertext
        );
        return new Uint8Array(decrypted);
      } catch (e) {
        // Fallback to XOR if AES fails
        return this.xorEncrypt(key, data);
      }
    } else {
      // Fallback to XOR if WebCrypto not available
      return this.xorEncrypt(key, data);
    }
  }

  // Secure random bytes with fallback
  static getRandomValues(array: Uint8Array): Uint8Array {
    if (this.useWebCrypto && this.crypto.getRandomValues) {
      return this.crypto.getRandomValues(array);
    } else if (this.useNodeCrypto && this.crypto.randomBytes) {
      const bytes = this.crypto.randomBytes(array.length);
      for (let i = 0; i < array.length; i++) {
        array[i] = bytes[i];
      }
      return array;
    } else {
      // Fallback to Math.random (insecure, but better than nothing)
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }
  }

  // Generate random bytes
  static randomBytes(length: number): Uint8Array {
    const array = new Uint8Array(length);
    return this.getRandomValues(array);
  }

  // Shuffle blocks with order preservation
  static shuffleBlocks(data: Uint8Array, blockSize: number): { data: Uint8Array; order: number[] } {
    const blocks: Uint8Array[] = [];
    for (let i = 0; i < data.length; i += blockSize) {
      blocks.push(data.slice(i, Math.min(i + blockSize, data.length)));
    }
    
    const order = Array.from({ length: blocks.length }, (_, i) => i);
    // Fisher-Yates shuffle using secure random
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    
    const result = new Uint8Array(data.length);
    let pos = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[order[i]];
      result.set(block, pos);
      pos += block.length;
    }
    
    return { data: result, order };
  }

  // Strong hash for runtime checks
  static strongHash(data: string): number {
    let h1 = 0x9e3779b9;
    let h2 = 0x85ebca6b;
    for (let i = 0; i < data.length; i++) {
      const c = data.charCodeAt(i);
      h1 = (h1 ^ c) * 0x1000193;
      h2 = (h2 ^ (c << 1)) * 0x1000193;
    }
    return (h1 ^ h2) >>> 0;
  }
}

// ---------- Seeded Random ----------
class SeededRandom {
  private state: Uint32Array;
  private useCryptoRandom: boolean;
  
  constructor(seed?: number) {
    this.state = new Uint32Array(4);
    this.useCryptoRandom = !seed;
    
    if (seed) {
      this.state[0] = seed >>> 0;
      this.state[1] = (seed * 0x9e3779b9) >>> 0;
      this.state[2] = (seed << 13) ^ (seed >>> 19);
      this.state[3] = ~seed >>> 0;
    } else {
      // Use crypto random for seed
      const bytes = CryptoUtils.randomBytes(16);
      for (let i = 0; i < 4; i++) {
        this.state[i] = (bytes[i * 4] | (bytes[i * 4 + 1] << 8) | 
                        (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24)) >>> 0;
      }
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

  randomHex(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.range(0, 15)];
    }
    return result;
  }
}

// ---------- Opcode Map ----------
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
  private mutationSeed: number;
  public readonly size: number;
  private rng: SeededRandom;
  
  constructor(rng: SeededRandom, enablePolymorphism: boolean = false) {
    this.opToNum = new Map();
    this.numToOp = new Map();
    this.size = BASE_OPCODES.length;
    this.rng = rng;
    this.dynamicKey = enablePolymorphism ? rng.range(1, 0xffff) : 0;
    this.mutationSeed = rng.range(1, 0xffffffff);
    this.randomize();
  }
  
  private randomize(): void {
    const shuffled = this.rng.shuffle([...BASE_OPCODES]);
    shuffled.forEach((op, idx) => {
      let h = CryptoUtils.xxHash32(
        new TextEncoder().encode(op + this.dynamicKey.toString() + this.mutationSeed), 
        this.mutationSeed
      );
      let num = (h & 0xff) + 1;
      
      while (this.opToNum.has(op) || Array.from(this.opToNum.values()).includes(num)) {
        h = CryptoUtils.xxHash32(new TextEncoder().encode(h.toString()), h);
        num = (h & 0xff) + 1;
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

  getMutationSeed(): number {
    return this.mutationSeed;
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
    
    switch (node.type) {
      case 'Chunk':
        const chunk = new IRNode('CHUNK');
        chunk.children = (node.body || []).map((stmt: any) => IRBuilder.fromAST(stmt));
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
          ...(node.arguments || []).map((arg: any) => IRBuilder.fromAST(arg))
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
        ifNode.children = [IRBuilder.fromAST(node.condition)];
        
        const thenNode = new IRNode('THEN');
        thenNode.value = (node.then || []).map((stmt: any) => IRBuilder.fromAST(stmt));
        ifNode.children.push(thenNode);
        
        if (node.else) {
          const elseNode = new IRNode('ELSE');
          elseNode.value = (Array.isArray(node.else) ? node.else : [node.else])
            .map((stmt: any) => IRBuilder.fromAST(stmt));
          ifNode.children.push(elseNode);
        }
        return ifNode;
      
      case 'WhileStatement':
        const whileNode = new IRNode('WHILE');
        whileNode.left = IRBuilder.fromAST(node.condition);
        
        const bodyNode = new IRNode('BODY');
        bodyNode.value = (node.body || []).map((stmt: any) => IRBuilder.fromAST(stmt));
        whileNode.right = bodyNode;
        return whileNode;
      
      case 'ReturnStatement':
        const ret = new IRNode('RETURN');
        ret.children = (node.arguments || []).map((arg: any) => IRBuilder.fromAST(arg));
        return ret;
      
      default:
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
  private rng: SeededRandom;
  
  constructor(opMap: OpcodeMap, rng: SeededRandom) {
    this.opMap = opMap;
    this.rng = rng;
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

  addGarbageInstructions(): void {
    const garbageOps = ['NOP', 'PUSH', 'POP'];
    const garbageCount = this.rng.range(5, 15);
    
    for (let i = 0; i < garbageCount; i++) {
      const pos = this.rng.range(0, this.bytecode.length - 1);
      const op = this.rng.choice(garbageOps);
      const garbage = [this.opMap.get(op)];
      
      for (let j = 0; j < this.rng.range(0, 2); j++) {
        garbage.push(this.rng.range(0, 255));
        garbage.push(this.rng.range(0, 255));
      }
      
      this.bytecode.splice(pos, 0, ...garbage);
    }
  }

  compile(ir: IRNode, options: ObfuscationOptions): { bytecode: number[]; constants: any[] } {
    this.visitIR(ir);
    this.emit('RET');
    
    if (options.layers?.garbage) {
      this.addGarbageInstructions();
    }
    
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
        const opMap: { [key: string]: string } = {
          '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV',
          '%': 'MOD', '^': 'POW', '..': 'CONCAT', '==': 'EQ',
          '<': 'LT', '<=': 'LE', '>': 'GT', '>=': 'GE',
          'and': 'AND', 'or': 'OR'
        };
        if (opMap[op]) this.emit(opMap[op]);
        break;
      
      case 'UNARY':
        this.visitIR(node.left!);
        const unaryMap: { [key: string]: string } = {
          'not': 'NOT', '-': 'NEG', '#': 'LEN'
        };
        if (unaryMap[node.value]) this.emit(unaryMap[node.value]);
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
      const encrypted = this.chunkedEncrypt(bytes, key, rng);
      return { 
        t: 'f64', 
        d: encrypted.d, 
        k: encrypted.k, 
        o: encrypted.o,
        s: rng.range(0, 0xffff)
      };
    }
    
    if (typeof value === 'string') {
      const data = new TextEncoder().encode(value);
      const encrypted = this.chunkedEncrypt(data, rng.bytes(8), rng);
      return { 
        t: 'str', 
        d: encrypted.d, 
        k: encrypted.k, 
        o: encrypted.o,
        s: rng.randomHex(8)
      };
    }
    
    if (typeof value === 'boolean') {
      const key = rng.range(1, 0xffff);
      const salt = rng.range(1, 0xff);
      return { 
        t: 'bool', 
        v: (value ? 1 : 0) ^ key, 
        k: key,
        s: salt
      };
    }
    
    return value;
  }

  private static chunkedEncrypt(data: Uint8Array, key: Uint8Array, rng: SeededRandom): { d: number[][]; k: number[]; o: number[] } {
    const chunkSize = rng.range(4, 8);
    const chunks: number[][] = [];
    const keys: number[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkKey = rng.range(1, 0xff);
      keys.push(chunkKey);
      chunks.push(Array.from(chunk).map(b => b ^ chunkKey));
    }
    
    const paddingCount = rng.range(1, 3);
    for (let i = 0; i < paddingCount; i++) {
      chunks.push(Array.from({ length: rng.range(3, 6) }, () => rng.range(32, 126)));
      keys.push(rng.range(1, 0xff));
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
  private reservedWords = new Set([
    'getfenv', '_ENV', 'load', 'string', 'table', 'debug',
    'os', 'io', 'math', 'coroutine', 'package', 'bit32'
  ]);
  
  constructor(rng: SeededRandom) { 
    this.rng = rng; 
  }
  
  generate(minLen?: number): string {
    const len = minLen || this.rng.range(4, 8);
    const templates = [
      () => 'x' + this.rng.randomHex(4),
      () => '_' + this.rng.randomHex(3),
      () => this.rng.choice(['a', 'b', 'c']) + this.rng.randomHex(4),
      () => 'v' + this.rng.range(1000, 9999).toString(36)
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

// ---------- Lightweight AES Implementation for Lua ----------
const LUA_AES_IMPLEMENTATION = `
-- Lightweight AES-128 decryption for Lua
local function aesDecrypt(key, data)
  -- Simplified AES S-box
  local sbox = {
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
  }
  
  -- Inverse S-box for decryption
  local inv_sbox = {}
  for i=0,255 do inv_sbox[sbox[i+1]+1] = i end
  
  local function subBytes(state)
    for i=1,#state do state[i] = inv_sbox[state[i]+1] end
  end
  
  local function shiftRows(state)
    -- Simplified shift rows implementation
    local temp = state[5]
    state[5] = state[9]
    state[9] = state[13]
    state[13] = state[1]
    state[1] = temp
  end
  
  local function mixColumns(state)
    -- Simplified mix columns
    for i=1,4 do
      local a = state[i]
      local b = state[i+4]
      state[i] = a ~ b
    end
  end
  
  local function addRoundKey(state, roundKey)
    for i=1,#state do
      state[i] = state[i] ~ roundKey[i]
    end
  end
  
  -- Main decryption function
  local result = {}
  local state = {}
  
  for i=1,#data,16 do
    for j=1,16 do
      state[j] = data[i+j-1] or 0
    end
    
    -- Apply inverse AES rounds
    for round=1,10 do
      addRoundKey(state, key)
      if round < 10 then
        mixColumns(state)
      end
      shiftRows(state)
      subBytes(state)
    end
    
    for j=1,16 do
      result[#result+1] = state[j]
    end
  end
  
  return result
end

-- Return the decryption function
return { aesDecrypt = aesDecrypt }
`;

// ---------- VM Generator ----------
class VMGenerator {
  private rng: SeededRandom;
  private nameGen: NameGenerator;
  
  constructor(rng: SeededRandom) {
    this.rng = rng;
    this.nameGen = new NameGenerator(rng);
  }

  async generate(bytecode: number[], constants: any[], opMap: OpcodeMap, buildId: string, options: ObfuscationOptions): Promise<string> {
    // Generate random names
    const names = {
      vm: this.nameGen.generate(3),
      bc: this.nameGen.generate(3),
      consts: this.nameGen.generate(3),
      sp: this.nameGen.generate(2),
      pc: this.nameGen.generate(2),
      env: this.nameGen.generate(3),
      tmp: this.nameGen.generate(2),
      hash: this.nameGen.generate(3),
      stack: this.nameGen.generate(3),
      keyA: this.nameGen.generate(3),
      keyB: this.nameGen.generate(3),
      keyC: this.nameGen.generate(3),
      engineTable: this.nameGen.generate(4),
      engineIdx: this.nameGen.generate(2),
      antiDebug: this.nameGen.generate(4),
      constCache: this.nameGen.generate(3),
      seedEnc: this.nameGen.generate(3),
      seedKey: this.nameGen.generate(3),
      shuffleOrder: this.nameGen.generate(3),
      aesImpl: this.nameGen.generate(3),
      vmCoreEnc: this.nameGen.generate(3),
      dispatch: this.nameGen.generate(3),
      subst: this.nameGen.generate(3),
      pcMap: this.nameGen.generate(3)
    };

    // Generate master seed and encryption keys
    const masterSeed = CryptoUtils.randomBytes(64);
    const seedEncryptionKey = CryptoUtils.randomBytes(32);
    const encryptedSeed = await CryptoUtils.aesEncrypt(seedEncryptionKey, masterSeed);
    
    // Derive all keys from master seed
    const aesKey = masterSeed.slice(0, 32);
    const xorKey = masterSeed.slice(32, 64);
    
    // Encrypt bytecode
    const bcBytes = new Uint8Array(bytecode);
    const encrypted = await CryptoUtils.aesEncrypt(aesKey, bcBytes);
    
    // Shuffle with order preservation
    const blockSize = 64;
    const { data: shuffled, order: shuffleOrder } = CryptoUtils.shuffleBlocks(encrypted, blockSize);
    
    // XOR obfuscation
    const finalEncrypted = CryptoUtils.xorEncrypt(xorKey, shuffled);
    
    // Format bytecode array with mixed radix
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

    // HMAC for integrity
    const buildHmac = CryptoUtils.hmac(bcBytes, new TextEncoder().encode(buildId));

    // Generate opcode handlers
    const opList = opMap.getAll();
    const engineCount = this.rng.range(3, 5);
    const engineIndices: { [op: number]: number } = {};
    const handlerIndices: { [op: number]: number } = {};

    opList.forEach(([name, num]) => {
      engineIndices[num] = this.rng.range(1, engineCount);
      handlerIndices[num] = this.rng.range(1, 0xff);
    });

    const handlerBodies = this.generateHandlerBodies(
      names.bc, names.sp, names.pc, names.consts, names.env, 
      names.tmp, names.stack, names.keyA, names.keyB, names.keyC, names.constCache
    );

    // Generate handler functions
    const handlerFunctions: string[] = [];
    opList.forEach(([name, num]) => {
      const engine = engineIndices[num];
      const idx = handlerIndices[num];
      handlerFunctions.push(`
local function h_${engine}_${idx}()
  ${handlerBodies[name]}
end
`);
    });

    // Add fake handlers
    if (options.layers?.garbage) {
      for (let f = 0; f < engineCount * 2; f++) {
        const engine = this.rng.range(1, engineCount);
        const idx = this.rng.range(1, 0xff);
        handlerFunctions.push(`
local function h_${engine}_${idx}()
  ${this.generateFakeHandler(names.stack, names.sp, names.keyA, names.keyB, names.keyC)}
end
`);
      }
    }

    const handlerFuncsStr = handlerFunctions.join('\n');

    // Generate engine dispatch table
    let engineDispatchStr = 'local dispatch = {}\n';
    for (let i = 1; i <= engineCount; i++) {
      engineDispatchStr += `dispatch[${i}] = {}\n`;
    }
    
    opList.forEach(([name, num]) => {
      const engine = engineIndices[num];
      const idx = handlerIndices[num];
      engineDispatchStr += `dispatch[${engine}][${idx}] = h_${engine}_${idx}\n`;
    });

    // Generate PC mapping for non-linear execution
    const pcMap: number[] = [];
    for (let i = 1; i <= finalEncrypted.length; i++) {
      pcMap[i] = this.rng.range(1, finalEncrypted.length);
    }
    const pcMapStr = '{' + pcMap.map(v => v.toString()).join(',') + '}';

    // Generate substitution table
    const substTable: { [op: number]: string } = {};
    if (options.layers?.polymorphism) {
      opList.forEach(([name, num]) => {
        if (this.rng.range(0, 2) === 0) {
          substTable[num] = this.generateSubstitute(name);
        }
      });
    }
    const substStr = Object.entries(substTable)
      .map(([k, v]) => `  [${k}] = function() ${v} end`)
      .join(',\n');

    // Junk variables
    const junkVars = this.nameGen.generateTable(8);

    // Build final loader
    return `--[[ XZX Ultimate Build: ${buildId} ]]
load=load or loadstring
return load((function(...)
  -- Variable declarations
  local ${names.vm},${names.bc},${names.consts},${names.sp},${names.pc},${names.env}
  local ${names.tmp},${names.hash},${names.stack},${names.keyA},${names.keyB},${names.keyC}
  local ${names.engineTable},${names.engineIdx},${names.antiDebug},${names.constCache}
  local ${names.seedEnc},${names.seedKey},${names.shuffleOrder},${names.aesImpl}
  local ${names.vmCoreEnc},${names.dispatch},${names.subst},${names.pcMap}
  local ${junkVars.join(',')}

  -- Embedded AES implementation
  ${names.aesImpl} = (function()
    ${LUA_AES_IMPLEMENTATION}
  end)()
  
  -- Encrypted seed
  ${names.seedEnc} = {${Array.from(encryptedSeed).join(',')}}
  ${names.seedKey} = {${Array.from(seedEncryptionKey).join(',')}}
  
  -- Decrypt seed at runtime
  local realSeed = {}
  for i=1,#${names.seedEnc} do
    realSeed[i] = ${names.seedEnc}[i] ~ ${names.seedKey}[(i-1)%#${names.seedKey}+1]
  end
  ${names.seedEnc} = nil
  ${names.seedKey} = nil
  collectgarbage()
  
  -- Derive decryption keys from seed
  local function deriveKey(ctx)
    local h = 0x9e3779b9
    for i=1,#realSeed do
      h = (h + realSeed[i] + ctx) * 0x85ebca6b
      h = h & 0xffffffff
    end
    local key = {}
    for i=1,32 do
      key[i] = (h >> ((i-1) % 16)) & 0xff
    end
    return key
  end
  
  -- Derive all keys
  local aesKey = deriveKey(0x${this.rng.range(1, 0xffffffff).toString(16)})
  local xorKey = deriveKey(0x${this.rng.range(1, 0xffffffff).toString(16)})
  
  -- Initialize VM state
  ${names.bc} = {${bcArray}}
  ${names.consts} = ${constStr}
  ${names.shuffleOrder} = {${shuffleOrder.join(',')}}
  ${names.sp} = 0
  ${names.pc} = 1
  ${names.env} = getfenv and getfenv() or _ENV
  ${names.stack} = {}
  ${names.keyA} = ${this.rng.range(1, 0xffffffff)}
  ${names.keyB} = ${this.rng.range(1, 0xffffffff)}
  ${names.keyC} = ${this.rng.range(1, 0xffffffff)}
  ${names.constCache} = {}
  
  -- Integrity verification with HMAC
  local expectedHmac = ${buildHmac}
  local actualHmac = 0x9e3779b9
  for i=1,#${names.bc} do
    actualHmac = ((actualHmac * 0x85ebca6b) + ${names.bc}[i] + (i * 0xc2b2ae3d)) & 0xffffffff
  end
  if actualHmac ~= expectedHmac then
    error([[${this.rng.randomHex(16)}]])
  end
  
  -- Unshuffle bytecode
  local function unshuffle(data, order)
    local result = {}
    local blockSize = 64
    for i = 1, #order do
      local srcPos = (order[i] - 1) * blockSize + 1
      local dstPos = (i - 1) * blockSize + 1
      for j = 0, blockSize - 1 do
        if srcPos + j <= #data then
          result[dstPos + j] = data[srcPos + j]
        end
      end
    end
    return result
  end
  
  -- Decrypt bytecode
  local function decryptBytecode()
    local data = ${names.bc}
    data = unshuffle(data, ${names.shuffleOrder})
    
    -- XOR decrypt
    for i=1,#data do
      data[i] = data[i] ~ xorKey[(i-1)%#xorKey+1]
    end
    
    -- AES decrypt
    local aes = ${names.aesImpl}
    data = aes.aesDecrypt(aesKey, data)
    
    return data
  end
  
  local decrypted = decryptBytecode()
  ${names.bc} = nil
  collectgarbage()
  
  ${handlerFuncsStr}
  
  ${engineDispatchStr}
  
  -- Clear function references
  for i=1,${engineCount} do
    for k,v in pairs(dispatch[i]) do
      _G['h_' .. i .. '_' .. k] = nil
    end
  end
  
  ${names.subst} = {${substStr}}
  ${names.pcMap} = ${pcMapStr}
  
  -- Anti-debug with silent corruption
  ${names.antiDebug} = function()
    local corrupt = false
    
    -- Check for debugger
    if debug and debug.getinfo then
      local info = debug.getinfo(2, 'S')
      if info and info.what == 'C' then
        corrupt = true
      end
    end
    
    -- Timing check
    local start = os.clock()
    for i=1,10000 do end
    if os.clock() - start > 0.1 then
      corrupt = true
    end
    
    -- Check for hooks
    if debug and debug.gethook then
      local hook = debug.gethook()
      if hook then corrupt = true end
    end
    
    -- Silent corruption if detected
    if corrupt then
      ${names.keyA} = (${names.keyA} + os.clock() + #${names.stack}) & 0xffffffff
      ${names.keyB} = (${names.keyB} + ${names.pc} + ${names.sp}) & 0xffffffff
      ${names.keyC} = (${names.keyC} ~ ${names.keyA}) & 0xffffffff
    end
  end
  
  -- Lazy constant decryption with caching
  local function getConst(idx)
    if ${names.constCache}[idx] then
      return ${names.constCache}[idx]
    end
    
    local c = ${names.consts}[idx]
    if type(c) == 'table' then
      if c.t == 'f64' or c.t == 'str' then
        -- Reorder chunks
        local chunks = {}
        for i=1,#c.d do
          local origIdx = c.o[i]
          chunks[origIdx] = c.d[i]
        end
        
        -- Decrypt chunks
        local data = {}
        for i=1,#chunks do
          local key = c.k[i]
          local chunk = chunks[i]
          for j=1,#chunk do
            data[#data+1] = chunk[j] ~ key
          end
        end
        
        -- Convert to proper type
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
    
    ${names.constCache}[idx] = c
    return c
  end
  
  -- Stack hash for key evolution
  local function stackHash()
    local h = 0x9e3779b9
    for i=1,${names.sp} do
      local v = ${names.stack}[i]
      if type(v) == 'number' then
        h = (h + v) * 0x85ebca6b
      else
        h = (h + #tostring(v)) * 0xc2b2ae3d
      end
      h = h & 0xffffffff
    end
    return h
  end
  
  -- Main execution loop
  while ${names.pc} <= #decrypted do
    -- Anti-debug check
    if math.random(1,20) > 15 then
      ${names.antiDebug}()
    end
    
    local raw = decrypted[${names.pc}]
    local stackHashVal = stackHash()
    local mix = (${names.keyA} + ${names.pc} + stackHashVal) & 0xffffffff
    local op = raw
    
    ${names.pc} = ${names.pcMap}[${names.pc}]
    
    -- Dynamic execution path selection
    local execPath = (${names.keyB} + ${names.sp}) % 3
    
    if execPath == 0 then
      -- Normal execution
      local engine = ((${names.keyA} + ${names.pc} + ${names.sp}) % ${engineCount}) + 1
      local handler = dispatch[engine] and dispatch[engine][op]
      if handler then
        handler()
      else
        local sub = ${names.subst}[op]
        if sub then 
          sub()
        else
          -- Junk operation
          ${names.keyC} = (${names.keyC} + op) & 0xffffffff
        end
      end
    elseif execPath == 1 then
      -- Reversed stack execution
      local temp = {}
      for i=1,${names.sp} do
        temp[i] = ${names.stack}[${names.sp}-i+1]
      end
      ${names.stack} = temp
      ${names.keyA} = (${names.keyA} + 1) & 0xffffffff
    else
      -- Indirect execution through proxy
      local proxy = setmetatable({}, {
        __index = function(t,k)
          return ${names.stack}[k] ~ (${names.keyA} + k)
        end
      })
      ${names.stack} = proxy
      ${names.keyB} = (${names.keyB} + ${names.sp}) & 0xffffffff
    end
    
    -- Key evolution
    if (${names.pc} % 5) == 0 then
      local top = ${names.stack}[${names.sp}] or 0
      local val = type(top) == 'number' and top or #tostring(top)
      ${names.keyA} = (${names.keyA} * val + ${names.pc}) & 0xffffffff
      ${names.keyB} = (${names.keyB} ~ val + ${names.sp}) & 0xffffffff
      ${names.keyC} = (${names.keyC} + ${names.keyA}) & 0xffffffff
    end
    
    ${this.generateJunkCode(junkVars)}
  end
  
  -- Return result
  local top = ${names.stack}[${names.sp}] or ${names.stack}[1]
  if top then
    local finalKey = (${names.keyA} * ${names.keyB} + ${names.keyC}) & 0xffffffff
    if type(top) == 'number' then
      return top ~ finalKey
    end
    return top
  end
  return nil
end)()..'')()`;
  }

  private generateHandlerBodies(
    bc: string, sp: string, pc: string, consts: string, env: string,
    tmp: string, stack: string, keyA: string, keyB: string, keyC: string, constCache: string
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
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a + b) ~ ${keyExpr}
      `,
      'SUB': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a - b) ~ ${keyExpr}
      `,
      'MUL': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a * b) ~ ${keyExpr}
      `,
      'DIV': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a / b) ~ ${keyExpr}
      `,
      'MOD': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a % b) ~ ${keyExpr}
      `,
      'POW': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a ^ b) ~ ${keyExpr}
      `,
      'CONCAT': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a .. b) ~ ${keyExpr}
      `,
      'EQ': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a == b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'LT': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a < b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'LE': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a <= b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'GT': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a > b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'GE': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a >= b) and 1 or 0
        ${stack}[${sp}] = ${stack}[${sp}] ~ ${keyExpr}
      `,
      'AND': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local a = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (a and b) ~ ${keyExpr}
      `,
      'OR': `
        local b = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
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
        local key = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local tbl = ${stack}[${sp}] ~ ${keyExpr}
        ${stack}[${sp}] = (tbl[key]) ~ ${keyExpr}
      `,
      'SETTABLE': `
        local val = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local key = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
        local tbl = ${stack}[${sp}] ~ ${keyExpr}
        tbl[key] = val
      `,
      'CALL': `
        local nargs = ${bc}[${pc}]
        ${pc} = ${pc} + 2
        local func = ${stack}[${sp}] ~ ${keyExpr}
        ${sp} = ${sp} - 1
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
    const subs: { [key: string]: string } = {
      'ADD': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;stack[sp]=((a-b)+(b*2))~key',
      'SUB': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;stack[sp]=(a+(~b+1))~key',
      'MUL': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;local r=0;for i=1,b do r=r+a end;stack[sp]=r~key',
      'DIV': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;stack[sp]=(a*(1/b))~key',
      'MOD': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;stack[sp]=(a-math.floor(a/b)*b)~key',
      'AND': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;stack[sp]=((a and b)or false)~key',
      'OR': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;stack[sp]=((a or b)or a)~key',
      'NOT': 'local a=stack[sp]~key;stack[sp]=((not a)and 1 or 0)~key',
      'EQ': 'local b=stack[sp]~key;sp=sp-1;local a=stack[sp]~key;stack[sp]=((a==b)and 1 or 0)~key'
    };
    return subs[op] || '-- no substitute';
  }

  private generateFakeHandler(stack: string, sp: string, keyA: string, keyB: string, keyC: string): string {
    const keyExpr = `((${keyA} * ${keyB} + ${keyC}) & 0xffffffff)`;
    const actions = [
      `local tmp = (${keyA} + ${sp}) & 0xffffffff; ${keyC} = (${keyC} + tmp) & 0xffffffff;`,
      `${stack}[${sp}+1] = (${stack}[${sp}+1] or 0) ~ ${keyExpr};`,
      `for i=1,${this.rng.range(2,4)} do ${stack}[${sp}+i] = (${stack}[${sp}+i] or i) ~ ${keyExpr}; end`,
      `local x = (${keyA} * ${keyB}) & 0xffffffff; ${keyA} = (${keyA} + x) & 0xffffffff;`,
      `local y = (${keyB} ~ ${keyC}) & 0xffffffff; ${keyB} = (${keyB} + y) & 0xffffffff;`,
      `if ${sp} > 0 then ${stack}[${sp}] = ${stack}[${sp}] ~ (${keyA} + ${sp}) end`
    ];
    return this.rng.choice(actions);
  }

  private generateJunkCode(vars: string[]): string {
    const ops = [
      `local ${vars[0]}=${vars[1]}or 0;${vars[2]}=${vars[3]}+${this.rng.range(1,100)};`,
      `for i=1,${this.rng.range(2,5)} do ${vars[4]}=i;${vars[0]}=(${vars[0]}+i) end;`,
      `local ${vars[0]}={};for i=1,${this.rng.range(2,4)} do ${vars[0]}[i]=i*i;end;`,
      `if (function() return true end)() then ${vars[1]}=nil;else ${vars[2]}=false;end;`,
      `local ${vars[3]}=math.random();${vars[4]}=tostring(${vars[3]});`,
      `local ${vars[5]} = {${vars[0]},${vars[1]},${vars[2]}};`
    ];
    return this.rng.choice(ops);
  }
}

// ---------- Obfuscation Options Interface ----------
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

// ---------- Main Obfuscator ----------
export class XZXUltimateObfuscator {
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
      
      // Build IR
      let ir = IRBuilder.fromAST(ast);
      
      // Create opcode map
      const opMap = new OpcodeMap(rng, options.layers?.polymorphism);
      
      // Compile to bytecode
      const compiler = new BytecodeCompiler(opMap, rng);
      const { bytecode, constants } = compiler.compile(ir, options);
      
      // Generate VM
      const vmGen = new VMGenerator(rng);
      const buildId = 'XZX-' + Date.now().toString(36) + '-' + rng.randomHex(8);
      const output = await vmGen.generate(bytecode, constants, opMap, buildId, options);

      // Calculate metrics
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

// ---------- Public API ----------
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
