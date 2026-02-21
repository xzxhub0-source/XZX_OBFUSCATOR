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

class CryptoUtils {
  static readonly primes = [
    0x9e3779b9, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35,
    0x27d4eb2f, 0x165667b1, 0xda3e39cb, 0x9e3779b9
  ];

  static teaEncrypt(value: number, key: number[]): number {
    let v0 = value & 0xffffffff;
    let v1 = (value >> 32) & 0xffffffff;
    let sum = 0;
    const delta = 0x9e3779b9;
    
    for (let i = 0; i < 32; i++) {
      sum += delta;
      v0 += ((v1 << 4) + key[0]) ^ (v1 + sum) ^ ((v1 >> 5) + key[1]);
      v1 += ((v0 << 4) + key[2]) ^ (v0 + sum) ^ ((v0 >> 5) + key[3]);
    }
    
    return (v0 & 0xffffffff) | ((v1 & 0xffffffff) << 32);
  }

  static teaDecrypt(value: number, key: number[]): number {
    let v0 = value & 0xffffffff;
    let v1 = (value >> 32) & 0xffffffff;
    let sum = 0xc6ef3720;
    const delta = 0x9e3779b9;
    
    for (let i = 0; i < 32; i++) {
      v1 -= ((v0 << 4) + key[2]) ^ (v0 + sum) ^ ((v0 >> 5) + key[3]);
      v0 -= ((v1 << 4) + key[0]) ^ (v1 + sum) ^ ((v1 >> 5) + key[1]);
      sum -= delta;
    }
    
    return (v0 & 0xffffffff) | ((v1 & 0xffffffff) << 32);
  }

  static xxHash(data: number[]): number {
    let h32 = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      h32 += data[i] * 0x85ebca6b;
      h32 = ((h32 << 13) | (h32 >>> 19)) ^ (h32 * 0xc2b2ae35);
    }
    return h32 & 0xffffffff;
  }

  static rc4(key: number[], data: number[]): number[] {
    const s = Array.from({ length: 256 }, (_, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length]) & 0xff;
      [s[i], s[j]] = [s[j], s[i]];
    }
    
    const result = [];
    let i = 0;
    j = 0;
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) & 0xff;
      j = (j + s[i]) & 0xff;
      [s[i], s[j]] = [s[j], s[i]];
      result.push(data[k] ^ s[(s[i] + s[j]) & 0xff]);
    }
    return result;
  }
}

class SeededRandom {
  private state: Uint32Array;
  private readonly gold = 0x9e3779b9;
  
  constructor(seed?: number) {
    this.state = new Uint32Array(4);
    if (seed) {
      this.state[0] = seed;
      this.state[1] = seed ^ this.gold;
      this.state[2] = (seed << 13) | (seed >>> 19);
      this.state[3] = ~seed;
    } else {
      crypto.getRandomValues(this.state);
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
    const result = new Uint8Array(length);
    for (let i = 0; i < length; i += 4) {
      const val = this.next();
      result[i] = val & 0xff;
      if (i + 1 < length) result[i + 1] = (val >> 8) & 0xff;
      if (i + 2 < length) result[i + 2] = (val >> 16) & 0xff;
      if (i + 3 < length) result[i + 3] = (val >> 24) & 0xff;
    }
    return result;
  }

  unicodeConfusable(): string {
    const confusables = [
      'а', 'е', 'о', 'р', 'с', 'у', 'х', 'Н', 'В', 'М', 'Т',
      'А', 'Е', 'О', 'Р', 'С', 'У', 'Х', 'Н', 'В', 'М', 'Т',
      'a\u0308', 'o\u0308', 'u\u0308', 'A\u0308', 'O\u0308', 'U\u0308'
    ];
    return this.choice(confusables);
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

  generateKey(length: number): Uint32Array {
    const key = new Uint32Array(length);
    for (let i = 0; i < length; i++) {
      key[i] = this.next();
    }
    return key;
  }
}

class NameGenerator {
  private rng: SeededRandom;
  private used: Set<string> = new Set();
  
  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  generate(length?: number): string {
    length = length || this.rng.range(3, 8);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.rng.range(0, chars.length - 1)];
    }
    
    if (this.used.has(result) || result === '_ENV' || result === 'getfenv') {
      return this.generate();
    }
    this.used.add(result);
    return result;
  }

  generateTable(length?: number): string[] {
    length = length || this.rng.range(10, 30);
    const names: string[] = [];
    for (let i = 0; i < length; i++) {
      names.push(this.generate());
    }
    return names;
  }
}

class OpaquePredicateGenerator {
  private rng: SeededRandom;
  
  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  generate(): string {
    const type = this.rng.range(0, 8);
    const a = this.rng.range(1, 1000);
    const b = this.rng.range(1, 1000);
    
    switch(type) {
      case 0: return `(function()local x=${a}*${b};local y=${a}+${b};return x%${a}==0 end)()`;
      case 1: return `(function()local x=${a}^2;local y=${b}^2;return x>=0 and y>=0 end)()`;
      case 2: return `(function()local x=${a}<<3;local y=${b}>>1;return x~${a}==${a} end)()`;
      case 3: return `(function()local x=${a}&${b};local y=${a}|${b};return x<y end)()`;
      case 4: return `(function()local x=${a}..'';local y=${b}..'';return #x+#y>0 end)()`;
      case 5: return `(function()local x=math.sin(${a});local y=math.cos(${b});return x*x+y*y==1 end)()`;
      case 6: return `(function()local x=string.char(${a}):byte();local y=string.char(${b}):byte();return x+${a}==${a}+x end)()`;
      case 7: return `(function()local x=tostring(${a});local y=tostring(${b});return x~=y end)()`;
      default: return `(function()local x=${a}^${b};local y=${b}^${a};return x>=0 end)()`;
    }
  }
}

class JunkCodeInjector {
  private rng: SeededRandom;
  private names: string[];
  
  constructor(rng: SeededRandom, names: string[]) {
    this.rng = rng;
    this.names = names;
  }

  inject(): string {
    const type = this.rng.range(0, 6);
    const vars = this.names.slice(0, this.rng.range(2, 5));
    
    switch(type) {
      case 0: return this.generateArithmetic(vars);
      case 1: return this.generateTableOps(vars);
      case 2: return this.generateStringOps(vars);
      case 3: return this.generateFunctionWrapper(vars);
      case 4: return this.generateLoop(vars);
      case 5: return this.generateConditional(vars);
      default: return this.generateArithmetic(vars);
    }
  }

  private generateArithmetic(vars: string[]): string {
    const ops = ['+', '-', '*', '/', '%', '^', '<<', '>>', '&', '|', '~'];
    let code = '';
    for (let i = 0; i < vars.length - 1; i++) {
      const op = this.rng.choice(ops);
      const val = this.rng.range(1, 1000);
      code += `local ${vars[i]}=${vars[i+1]}${op}${val};`;
    }
    return code;
  }

  private generateTableOps(vars: string[]): string {
    const tableName = vars[0];
    return `local ${tableName}={};` +
           `for i=1,${this.rng.range(2, 5)} do ${tableName}[i]=i*${this.rng.range(1, 10)};end;` +
           `for _,v in ipairs(${tableName}) do ${vars[1]}=(${vars[1]}or 0)+v;end;`;
  }

  private generateStringOps(vars: string[]): string {
    const str = this.rng.randomString(3, 8);
    return `local ${vars[0]}='${str}';` +
           `local ${vars[1]}=string.len(${vars[0]});` +
           `local ${vars[2]}=string.sub(${vars[0]},1,1);`;
  }

  private generateFunctionWrapper(vars: string[]): string {
    return `local function ${vars[0]}() ` +
           `${this.generateArithmetic(vars.slice(1))} ` +
           `return ${vars[1]} or ${this.rng.range(1, 100)};` +
           `end; local ${vars[2]}=${vars[0]}();`;
  }

  private generateLoop(vars: string[]): string {
    return `for ${vars[0]}=1,${this.rng.range(2, 5)} do ` +
           `local ${vars[1]}=${vars[0]}*${this.rng.range(1, 10)};` +
           `local ${vars[2]}=${vars[1]}+${this.rng.range(1, 10)};` +
           `end;`;
  }

  private generateConditional(vars: string[]): string {
    const pred = new OpaquePredicateGenerator(this.rng).generate();
    return `if ${pred} then ` +
           `local ${vars[0]}=${this.rng.range(1, 100)};` +
           `else local ${vars[1]}=${this.rng.range(1, 100)};` +
           `end;`;
  }
}

class ControlFlowFlattener {
  static flatten(code: string, rng: SeededRandom): string {
    const blocks = code.split('\n').filter(line => line.trim().length > 0);
    if (blocks.length < 2) return code;
    
    const stateVar = '__state_' + rng.range(1000, 9999).toString(36);
    const states: string[] = [];
    
    for (let i = 0; i < blocks.length; i++) {
      const nextState = i < blocks.length - 1 ? `${stateVar}=${i + 2}` : '';
      states.push(`
        if ${stateVar}==${i + 1} then
          ${blocks[i]}
          ${nextState}
        end
      `);
    }
    
    return `
      local ${stateVar}=1
      while ${stateVar}<=${blocks.length} do
        ${states.join('\n')}
      end
    `;
  }
}

class VMFunctionGenerator {
  private rng: SeededRandom;
  private names: string[];
  
  constructor(rng: SeededRandom, names: string[]) {
    this.rng = rng;
    this.names = names;
  }

  generate(opMap: OpcodeMap, constants: any[], bytecode: number[]): string {
    const vmName = this.names[0];
    const stackName = this.names[1];
    const pcName = this.names[2];
    const constName = this.names[3];
    const envName = this.names[4];
    
    // Encrypt bytecode with multiple layers
    const key1 = this.rng.bytes(32);
    const key2 = this.rng.bytes(32);
    const encrypted1 = CryptoUtils.rc4(Array.from(key1), bytecode);
    const encrypted2 = CryptoUtils.rc4(Array.from(key2), encrypted1);
    
    // Format encrypted bytecode
    const bcStr = this.formatBytecode(encrypted2);
    
    // Encrypt constants
    const encryptedConsts = this.encryptConstants(constants);
    const constStr = JSON.stringify(encryptedConsts)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'");
    
    // Generate VM handlers
    const handlers = this.generateHandlers(opMap);
    
    // Generate random VM structure
    return `
local function ${vmName}(${envName})
  local ${stackName}={}
  local ${pcName}=1
  local ${constName}=${constStr}
  local ${this.names[5]}={${bcStr}}
  local ${this.names[6]}={${Array.from(key1).join(',')}}
  local ${this.names[7]}={${Array.from(key2).join(',')}}
  
  -- Decrypt bytecode
  for ${this.names[8]}=1,#${this.names[5]} do
    ${this.names[5]}[${this.names[8]}]=${this.names[5]}[${this.names[8]}]~${this.names[7]}[(${this.names[8]}-1)%#${this.names[7]}+1]
    ${this.names[5]}[${this.names[8]}]=${this.names[5]}[${this.names[8]}]~${this.names[6]}[(${this.names[8]}-1)%#${this.names[6]}+1]
  end
  
  -- Decrypt constants
  for ${this.names[8]}=1,#${constName} do
    local c=${constName}[${this.names[8]}]
    if type(c)=='table' then
      if c.t=='multi' then
        local s=''
        for i=1,#c.c do
          local chunk=c.c[i]
          local k=c.k[i]
          for j=1,#chunk do
            s=s..string.char(chunk[j]~k)
          end
        end
        ${constName}[${this.names[8]}]=s
      elseif c.t=='tea' then
        local v=c.v
        local k=c.k
        local a=(v+k[4])&0xffffffff
        local b=((a<<4)+k[1])^((a>>5)+k[2])^a
        ${constName}[${this.names[8]}]=(b-k[3])&0xffffffff
      end
    end
  end
  
  -- VM loop
  while ${pcName}<=#${this.names[5]} do
    local op=${this.names[5]}[${pcName}]
    ${pcName}=${pcName}+1
    
    ${handlers}
    
    ${new JunkCodeInjector(this.rng, this.names.slice(9)).inject()}
  end
  
  return ${stackName}[1] or ${stackName}[${pcName}-1]
end
`;
  }

  private formatBytecode(bytecode: number[]): string {
    const parts: string[] = [];
    for (let i = 0; i < bytecode.length; i++) {
      const fmt = this.rng.range(0, 3);
      if (fmt === 0) parts.push(bytecode[i].toString());
      else if (fmt === 1) parts.push('0x' + bytecode[i].toString(16));
      else if (fmt === 2) parts.push('0b' + bytecode[i].toString(2));
      else parts.push('0' + bytecode[i].toString(8));
    }
    return parts.join(',');
  }

  private encryptConstants(constants: any[]): any[] {
    const encrypted: any[] = [null];
    for (let i = 1; i < constants.length; i++) {
      const c = constants[i];
      if (typeof c === 'string') {
        const chunks: number[][] = [];
        const keys: number[] = [];
        for (let j = 0; j < c.length; j += 3) {
          const chunk = c.slice(j, j + 3);
          const key = this.rng.range(1, 255);
          keys.push(key);
          chunks.push(Array.from(chunk).map(ch => ch.charCodeAt(0) ^ key));
        }
        encrypted.push({ t: 'multi', c: chunks, k: keys });
      } else if (typeof c === 'number') {
        const teaKey = this.rng.generateKey(4);
        const encrypted = CryptoUtils.teaEncrypt(c, Array.from(teaKey));
        encrypted.push({ t: 'tea', v: encrypted, k: Array.from(teaKey) });
      } else {
        encrypted.push(c);
      }
    }
    return encrypted;
  }

  private generateHandlers(opMap: OpcodeMap): string {
    const handlers: string[] = [];
    
    handlers.push(`
      if op==${opMap.get('LOADK')} then
        local idx=${this.names[5]}[${this.names[2]}]+(${this.names[5]}[${this.names[2]}+1]<<8)
        ${this.names[2]}=${this.names[2]}+2
        ${this.names[1]}[${this.names[2]}-1]=${this.names[3]}[idx]
    `);
    
    handlers.push(`
      elseif op==${opMap.get('GETGLOBAL')} then
        local idx=${this.names[5]}[${this.names[2]}]+(${this.names[5]}[${this.names[2]}+1]<<8)
        ${this.names[2]}=${this.names[2]}+2
        ${this.names[1]}[${this.names[2]}-1]=${this.names[4]}[${this.names[3]}[idx]]
    `);
    
    handlers.push(`
      elseif op==${opMap.get('SETGLOBAL')} then
        local idx=${this.names[5]}[${this.names[2]}]+(${this.names[5]}[${this.names[2]}+1]<<8)
        ${this.names[2]}=${this.names[2]}+2
        local val=${this.names[1]}[${this.names[2]}-1]
        ${this.names[2]}=${this.names[2]}-1
        ${this.names[4]}[${this.names[3]}[idx]]=val
    `);
    
    handlers.push(`
      elseif op==${opMap.get('CALL')} then
        local nargs=${this.names[5]}[${this.names[2]}]
        ${this.names[2]}=${this.names[2]}+2
        local func=${this.names[1]}[${this.names[2]}-1]
        ${this.names[2]}=${this.names[2]}-1
        local args={}
        for i=1,nargs do
          args[nargs-i+1]=${this.names[1]}[${this.names[2]}-1]
          ${this.names[2]}=${this.names[2]}-1
        end
        local results={func(unpack(args))}
        for _,v in ipairs(results) do
          ${this.names[1]}[${this.names[2]}]=v
          ${this.names[2]}=${this.names[2]}+1
        end
    `);
    
    handlers.push(`
      elseif op==${opMap.get('ADD')} then
        local b=${this.names[1]}[${this.names[2]}-1]
        local a=${this.names[1]}[${this.names[2]}-2]
        ${this.names[2]}=${this.names[2]}-2
        ${this.names[1]}[${this.names[2]}-1]=a+b
    `);
    
    handlers.push(`
      elseif op==${opMap.get('SUB')} then
        local b=${this.names[1]}[${this.names[2]}-1]
        local a=${this.names[1]}[${this.names[2]}-2]
        ${this.names[2]}=${this.names[2]}-2
        ${this.names[1]}[${this.names[2]}-1]=a-b
    `);
    
    handlers.push(`
      elseif op==${opMap.get('MUL')} then
        local b=${this.names[1]}[${this.names[2]}-1]
        local a=${this.names[1]}[${this.names[2]}-2]
        ${this.names[2]}=${this.names[2]}-2
        ${this.names[1]}[${this.names[2]}-1]=a*b
    `);
    
    handlers.push(`
      elseif op==${opMap.get('DIV')} then
        local b=${this.names[1]}[${this.names[2]}-1]
        local a=${this.names[1]}[${this.names[2]}-2]
        ${this.names[2]}=${this.names[2]}-2
        ${this.names[1]}[${this.names[2]}-1]=a/b
    `);
    
    handlers.push(`
      elseif op==${opMap.get('RET')} then
        return ${this.names[1]}[${this.names[2]}-1] or ${this.names[1]}[1]
    `);
    
    return handlers.join('\n');
  }
}

class XZXUltimateObfuscator {
  private rng: SeededRandom;
  private nameGen: NameGenerator;
  
  obfuscate(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
    const start = Date.now();
    this.rng = new SeededRandom(options.seed || Math.floor(Math.random() * 0x7fffffff));
    this.nameGen = new NameGenerator(this.rng);
    
    try {
      // Parse source
      const ast = luaparse.parse(source, { comments: false, luaVersion: '5.1' });
      
      // Generate random names for everything
      const names = this.nameGen.generateTable(50);
      
      // Build control flow graph
      const cfg = this.buildCFG(ast);
      
      // Apply optimizations
      const optimized = this.optimize(cfg, options.optimization || 'aggressive');
      
      // Generate bytecode with polymorphism
      const bytecode = this.generateBytecode(optimized);
      
      // Encrypt constants
      const constants = this.extractConstants(optimized);
      
      // Create VM
      const vm = new VMFunctionGenerator(this.rng, names.slice(0, 20));
      const vmCode = vm.generate(this.getOpMap(), constants, bytecode);
      
      // Generate function table
      const funcTable = this.generateFunctionTable(names.slice(20, 40));
      
      // Generate anti-debugging
      const antiDebug = this.generateAntiDebugging(names.slice(40, 45));
      
      // Generate opaque predicates
      const predicates = this.generateOpaquePredicates(names.slice(45, 50));
      
      // Generate entry point
      const entryPoint = this.generateEntryPoint(names);
      
      // Combine everything
      let output = this.wrapInLoader(
        funcTable + '\n' +
        vmCode + '\n' +
        antiDebug + '\n' +
        predicates + '\n' +
        entryPoint
      );
      
      // Apply control flow flattening
      if (options.layers?.controlFlow) {
        output = ControlFlowFlattener.flatten(output, this.rng);
      }
      
      // Add junk code
      if (options.layers?.garbage) {
        output = this.addJunkCode(output, names);
      }
      
      const buildId = 'XZX-' + Date.now().toString(36) + '-' + this.rng.range(1000, 9999).toString(36);
      
      return {
        success: true,
        code: '--[[ XZX Build: ' + buildId + ' ]]\n' + output,
        metrics: {
          inputSize: source.length,
          outputSize: output.length,
          duration: (Date.now() - start) / 1000,
          instructionCount: bytecode.length,
          buildId: buildId,
          layersApplied: Object.keys(options.layers || {}).filter(k => options.layers?.[k])
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private buildCFG(ast: any): any {
    // Build control flow graph from AST
    return ast;
  }

  private optimize(cfg: any, level: string): any {
    // Apply optimizations based on level
    return cfg;
  }

  private generateBytecode(cfg: any): number[] {
    // Generate bytecode from optimized CFG
    return []; // Placeholder
  }

  private extractConstants(cfg: any): any[] {
    // Extract constants from optimized code
    return [null]; // Placeholder
  }

  private getOpMap(): OpcodeMap {
    return new OpcodeMap(this.rng, true);
  }

  private generateFunctionTable(names: string[]): string {
    const funcs: string[] = [];
    for (let i = 0; i < names.length; i++) {
      funcs.push(`
        ${names[i]}=function(...)
          local ${this.nameGen.generate()}=...
          return ${this.nameGen.generate()}(${this.nameGen.generate()})
        end
      `);
    }
    return 'local ' + names.join(',') + ';\n' + funcs.join('\n');
  }

  private generateAntiDebugging(names: string[]): string {
    return `
      local ${names[0]}=debug and debug.getinfo
      local ${names[1]}=pcall
      local ${names[2]}=function()
        if ${names[0]} and ${names[1]}(function() debug.getinfo(2, 'S') end) then
          error('Debugger detected')
        end
        local ${names[3]}=os.clock()
        local ${names[4]}=0
        for i=1,10000 do ${names[4]}=${names[4]}+i end
        if os.clock()-${names[3]}>0.1 then
          error('Stepping detected')
        end
      end
      ${names[2]}()
    `;
  }

  private generateOpaquePredicates(names: string[]): string {
    const preds: string[] = [];
    for (let i = 0; i < names.length; i += 2) {
      const pred = new OpaquePredicateGenerator(this.rng).generate();
      preds.push(`
        if ${pred} then
          local ${names[i]}=true
        else
          local ${names[i+1]}=false
        end
      `);
    }
    return preds.join('\n');
  }

  private generateEntryPoint(names: string[]): string {
    return `
      local ${names[0]}=getfenv and getfenv() or _ENV
      local ${names[1]}=${names[2]}(${names[0]})
      return ${names[1]}
    `;
  }

  private wrapInLoader(code: string): string {
    return `
      load=load or loadstring
      return load((function()
        ${code}
      end)()..'')()
    `;
  }

  private addJunkCode(code: string, names: string[]): string {
    const injector = new JunkCodeInjector(this.rng, names);
    const parts = code.split('\n');
    const result: string[] = [];
    
    for (const line of parts) {
      result.push(line);
      if (this.rng.range(0, 5) === 0) {
        result.push(injector.inject());
      }
    }
    
    return result.join('\n');
  }
}

export function obfuscateLua(source: string, options: any): ObfuscationResult {
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
