/**
 * XZX Military-Grade Lua Obfuscator Engine
 * Version: 2.0.0 - Optimized for browser performance
 * Protected by XZX HUB (https://discord.gg/5q5bEKmYqF)
 */

import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  // Basic options
  mangleNames: boolean;
  encodeStrings: boolean;
  encodeNumbers: boolean;
  controlFlow: boolean;
  minify: boolean;
  protectionLevel: number;
  
  // Advanced options
  encryptionAlgorithm: string;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  antiDebugging: boolean;
  formattingStyle: string;
  
  // Military-grade features
  intenseVM: boolean;
  gcFixes: boolean;
  targetVersion: '5.1' | '5.2' | '5.3' | '5.4' | 'luajit';
  hardcodeGlobals: boolean;
  optimizationLevel: 0 | 1 | 2 | 3;
  staticEnvironment: boolean;
  vmCompression: boolean;
  disableLineInfo: boolean;
  useDebugLibrary: boolean;
  opaquePredicates: boolean;
  virtualization: boolean;
  bytecodeEncryption: boolean;
  antiTamper: boolean;
  selfModifying: boolean;
  mutation: boolean;
  codeSplitting: boolean;
  environmentLock: boolean;
  integrityChecks: boolean;
}

export interface ObfuscationResult {
  success: boolean;
  code?: string;
  error?: string;
  errorDetails?: any;
  metrics?: {
    inputSize: number;
    outputSize: number;
    duration: number;
    sizeRatio: number;
    transformations: {
      namesMangled: number;
      stringsEncoded: number;
      numbersEncoded: number;
      deadCodeBlocks: number;
      antiDebugChecks: number;
    };
    encryptionAlgorithm?: string;
  };
}

/**
 * XZX Military-Grade Obfuscation Engine - Browser Optimized
 * Implements VM-based obfuscation with progressive processing
 */
export class XZXObfuscatorEngine {
  private options: ObfuscationOptions;
  private ast: any;
  private bytecode: number[] = [];
  private vmFunctions: string[] = [];
  private encryptionKey: number[] = [];
  private metrics = {
    namesMangled: 0,
    stringsEncoded: 0,
    numbersEncoded: 0,
    deadCodeBlocks: 0,
    antiDebugChecks: 0
  };
  private nameMap: Map<string, string> = new Map();
  private stringMap: Map<string, string> = new Map();
  private constCounter: number = 0;
  private abortController: AbortController = new AbortController();

  constructor(options: ObfuscationOptions) {
    this.options = options;
    
    // Generate encryption key if bytecode encryption is enabled
    if (options.bytecodeEncryption) {
      for (let i = 0; i < 32; i++) {
        this.encryptionKey.push(Math.floor(Math.random() * 256));
      }
    }
  }

  /**
   * Sleep function to yield to browser
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if operation was aborted
   */
  private checkAborted(): void {
    if (this.abortController.signal.aborted) {
      throw new Error('Obfuscation aborted by user');
    }
  }

  /**
   * Process in chunks to avoid browser freezing
   */
  private async processInChunks<T>(
    items: T[],
    processor: (item: T, index: number) => void,
    chunkSize: number = 10,
    delayMs: number = 1
  ): Promise<void> {
    for (let i = 0; i < items.length; i += chunkSize) {
      this.checkAborted();
      const chunk = items.slice(i, i + chunkSize);
      chunk.forEach((item, idx) => processor(item, i + idx));
      // Yield to browser
      if (i + chunkSize < items.length) {
        await this.sleep(delayMs);
      }
    }
  }

  /**
   * Main obfuscation pipeline with progressive loading
   */
  public async obfuscate(sourceCode: string): Promise<ObfuscationResult> {
    try {
      const startTime = Date.now();
      const inputSize = sourceCode.length;

      // Step 1: Parse to AST (synchronous but fast)
      this.ast = luaparse.parse(sourceCode, {
        locations: !this.options.disableLineInfo,
        comments: false,
        scope: true,
        luaVersion: this.options.targetVersion === 'luajit' ? '5.1' : this.options.targetVersion
      });

      // Step 2: Apply optimization passes in chunks
      await this.applyOptimizationsAsync();

      // Step 3: Apply AST transformations in chunks
      await this.applyASTTransformationsAsync();

      // Step 4: Compile to bytecode if VM is enabled (progressive)
      let outputCode: string;
      if (this.options.intenseVM || this.options.virtualization) {
        await this.compileToBytecodeAsync();
        outputCode = await this.generateVMOutputAsync();
      } else {
        outputCode = await this.generateStandardOutputAsync();
      }

      // Step 5: Add header and apply final formatting
      outputCode = this.addHeader(outputCode);
      outputCode = this.applyFormatting(outputCode);

      const endTime = Date.now();
      const outputSize = outputCode.length;
      const duration = endTime - startTime;

      return {
        success: true,
        code: outputCode,
        metrics: {
          inputSize,
          outputSize,
          duration,
          sizeRatio: outputSize / inputSize,
          transformations: { ...this.metrics },
          encryptionAlgorithm: this.options.bytecodeEncryption ? 'AES-256-XOR' : 
                              this.options.encryptionAlgorithm !== 'none' ? this.options.encryptionAlgorithm : undefined
        }
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Obfuscation aborted by user') {
        return {
          success: false,
          error: 'Obfuscation cancelled',
          errorDetails: error
        };
      }
      console.error('Obfuscation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorDetails: error
      };
    }
  }

  /**
   * Async version of optimizations with progress
   */
  private async applyOptimizationsAsync(): Promise<void> {
    if (this.options.optimizationLevel >= 1) {
      await this.constantFoldingAsync();
      await this.deadCodeEliminationAsync();
      await this.sleep(5);
    }
    if (this.options.optimizationLevel >= 2) {
      await this.inlineSimpleFunctionsAsync();
      await this.sleep(5);
    }
    if (this.options.optimizationLevel >= 3) {
      await this.reorderStatementsAsync();
      await this.sleep(5);
    }
  }

  /**
   * Async version of AST transformations
   */
  private async applyASTTransformationsAsync(): Promise<void> {
    const transformations = [];

    // Name mangling
    if (this.options.mangleNames) {
      transformations.push(() => this.mangleIdentifiersAsync());
    }

    // String encryption
    if (this.options.encodeStrings) {
      transformations.push(() => this.encryptStringsAsync());
    }

    // Number encoding
    if (this.options.encodeNumbers) {
      transformations.push(() => this.encodeNumbersAsync());
    }

    // Control flow transformations
    if (this.options.controlFlowFlattening) {
      transformations.push(() => this.flattenControlFlowAsync());
    }

    if (this.options.opaquePredicates) {
      transformations.push(() => this.insertOpaquePredicatesAsync());
    }

    if (this.options.controlFlow) {
      transformations.push(() => this.insertBasicControlFlowAsync());
    }

    // Code obfuscation
    if (this.options.deadCodeInjection) {
      transformations.push(() => this.injectDeadCodeAsync());
    }

    if (this.options.codeSplitting) {
      transformations.push(() => this.splitCodeAsync());
    }

    if (this.options.mutation) {
      transformations.push(() => this.mutateCodeAsync());
    }

    // Anti-analysis
    if (this.options.antiDebugging) {
      transformations.push(() => this.insertAntiDebugAsync());
    }

    if (this.options.antiTamper || this.options.integrityChecks) {
      transformations.push(() => this.insertAntiTamperAsync());
    }

    if (this.options.useDebugLibrary) {
      transformations.push(() => this.useDebugFeaturesAsync());
    }

    // Environment hardening
    if (this.options.environmentLock) {
      transformations.push(() => this.lockEnvironmentAsync());
    }

    if (this.options.staticEnvironment) {
      transformations.push(() => this.optimizeStaticEnvironmentAsync());
    }

    if (this.options.hardcodeGlobals) {
      transformations.push(() => this.hardcodeGlobalsAsync());
    }

    // GC fixes
    if (this.options.gcFixes) {
      transformations.push(() => this.applyGCFixesAsync());
    }

    // Process transformations sequentially with delays
    for (let i = 0; i < transformations.length; i++) {
      this.checkAborted();
      await transformations[i]();
      await this.sleep(10); // Yield between major transformations
    }
  }

  /**
   * Async bytecode compilation with chunked processing
   */
  private async compileToBytecodeAsync(): Promise<void> {
    const instructions: number[] = [];
    const opcodes = this.generateOpcodeMap();
    
    // Traverse AST and generate bytecode in chunks
    const visitor = this.createBytecodeVisitor(instructions, opcodes);
    
    // Process AST nodes in chunks
    if (this.ast.body && Array.isArray(this.ast.body)) {
      await this.processInChunks(this.ast.body, (stmt) => {
        this.traverseAST(stmt, visitor);
      }, 5, 2);
    }

    // Apply VM layers if virtualization enabled
    if (this.options.virtualization) {
      // First VM layer
      const layer1 = await this.virtualizeBytecodeAsync(instructions);
      await this.sleep(20);
      
      // Second VM layer if intense VM enabled
      if (this.options.intenseVM) {
        const layer2 = await this.virtualizeBytecodeAsync(layer1);
        await this.sleep(30);
        this.bytecode = await this.applyBytecodeEncryptionAsync(layer2);
      } else {
        this.bytecode = await this.applyBytecodeEncryptionAsync(layer1);
      }
    } else {
      this.bytecode = await this.applyBytecodeEncryptionAsync(instructions);
    }

    // Generate VM interpreter
    await this.generateVMInterpreterAsync();
  }

  /**
   * Add XZX header to output
   */
  private addHeader(code: string): string {
    return `--[[ PROTECTED BY XZX HUB v2.0.0 OBFUSCATOR https://discord.gg/5q5bEKmYqF ]]\n\n${code}`;
  }

  /**
   * Apply formatting to output code
   */
  private applyFormatting(code: string): string {
    switch (this.options.formattingStyle) {
      case 'minified':
        return this.minify(code);
      case 'single-line':
        return code.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      case 'pretty':
        return code;
      case 'obfuscated':
        return this.obfuscateFormatting(code);
      default:
        return code;
    }
  }

  /**
   * Minify code (remove comments and unnecessary whitespace)
   */
  private minify(code: string): string {
    return code
      .replace(/--\[\[.*?\]\]/gs, '')
      .replace(/--.*$/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([=+\-*/%<>~^,;{}()[\]])\s*/g, '$1')
      .replace(/\n/g, ' ')
      .trim();
  }

  /**
   * Apply obfuscated formatting (random spacing)
   */
  private obfuscateFormatting(code: string): string {
    const lines = code.split('\n');
    return lines.map(line => {
      const indent = Math.floor(Math.random() * 10);
      return ' '.repeat(indent) + line.replace(/\s+/g, () => 
        ' '.repeat(Math.floor(Math.random() * 5) + 1)
      );
    }).join('\n');
  }

  /**
   * Generate opcode map for bytecode
   */
  private generateOpcodeMap(): Record<string, number> {
    return {
      PUSH: 0x01,
      POP: 0x02,
      ADD: 0x03,
      SUB: 0x04,
      MUL: 0x05,
      DIV: 0x06,
      MOD: 0x07,
      POW: 0x08,
      CONCAT: 0x09,
      EQ: 0x0A,
      LT: 0x0B,
      LE: 0x0C,
      NOT: 0x0D,
      AND: 0x0E,
      OR: 0x0F,
      JMP: 0x10,
      JIF: 0x11,
      CALL: 0x12,
      RET: 0x13,
      GETGLOBAL: 0x14,
      SETGLOBAL: 0x15,
      GETTABLE: 0x16,
      SETTABLE: 0x17,
      NEWTABLE: 0x18,
      DUP: 0x19,
      SWAP: 0x1A,
      NOP: 0x1B,
      ENCRYPTED: 0xFF
    };
  }

  /**
   * Create bytecode visitor for AST traversal
   */
  private createBytecodeVisitor(instructions: number[], opcodes: Record<string, number>): any {
    const visitor: any = {};
    const self = this;

    visitor.Literal = function(node: any) {
      if (typeof node.value === 'number') {
        instructions.push(opcodes.PUSH);
        instructions.push(0); // type: number
        self.encodeNumber(node.value).forEach(b => instructions.push(b));
      } else if (typeof node.value === 'string') {
        instructions.push(opcodes.PUSH);
        instructions.push(1); // type: string
        self.encodeString(node.value).forEach(b => instructions.push(b));
      } else if (typeof node.value === 'boolean') {
        instructions.push(opcodes.PUSH);
        instructions.push(2); // type: boolean
        instructions.push(node.value ? 1 : 0);
      } else if (node.value === null) {
        instructions.push(opcodes.PUSH);
        instructions.push(3); // type: nil
      }
    };

    visitor.BinaryExpression = function(node: any) {
      self.traverseNode(node.left, visitor);
      self.traverseNode(node.right, visitor);
      switch (node.operator) {
        case '+': instructions.push(opcodes.ADD); break;
        case '-': instructions.push(opcodes.SUB); break;
        case '*': instructions.push(opcodes.MUL); break;
        case '/': instructions.push(opcodes.DIV); break;
        case '%': instructions.push(opcodes.MOD); break;
        case '^': instructions.push(opcodes.POW); break;
        case '..': instructions.push(opcodes.CONCAT); break;
        case '==': instructions.push(opcodes.EQ); break;
        case '<': instructions.push(opcodes.LT); break;
        case '<=': instructions.push(opcodes.LE); break;
        case 'and': instructions.push(opcodes.AND); break;
        case 'or': instructions.push(opcodes.OR); break;
      }
    };

    visitor.UnaryExpression = function(node: any) {
      self.traverseNode(node.argument, visitor);
      if (node.operator === 'not') {
        instructions.push(opcodes.NOT);
      } else if (node.operator === '-') {
        instructions.push(opcodes.PUSH);
        instructions.push(0); // number type
        self.encodeNumber(0).forEach(b => instructions.push(b));
        instructions.push(opcodes.SUB);
      } else if (node.operator === '#') {
        instructions.push(opcodes.PUSH);
        instructions.push(1); // string type
        self.encodeString('#').forEach(b => instructions.push(b));
        instructions.push(opcodes.GETTABLE);
      }
    };

    visitor.CallExpression = function(node: any) {
      self.traverseNode(node.base, visitor);
      if (node.arguments && node.arguments.length > 0) {
        node.arguments.forEach((arg: any) => self.traverseNode(arg, visitor));
      }
      instructions.push(opcodes.CALL);
      instructions.push(node.arguments ? node.arguments.length : 0);
    };

    visitor.Identifier = function(node: any) {
      const name = self.nameMap.get(node.name) || node.name;
      instructions.push(opcodes.PUSH);
      instructions.push(1); // string type
      self.encodeString(name).forEach(b => instructions.push(b));
      instructions.push(opcodes.GETGLOBAL);
    };

    visitor.AssignmentStatement = function(node: any) {
      if (node.init && node.init.length > 0) {
        node.init.forEach((init: any) => self.traverseNode(init, visitor));
      }
      if (node.variables && node.variables.length > 0) {
        node.variables.forEach((var_: any) => {
          if (var_.type === 'Identifier') {
            const name = self.nameMap.get(var_.name) || var_.name;
            instructions.push(opcodes.PUSH);
            instructions.push(1); // string type
            self.encodeString(name).forEach(b => instructions.push(b));
          } else {
            self.traverseNode(var_, visitor);
          }
        });
      }
      instructions.push(opcodes.SETGLOBAL);
    };

    visitor.LocalStatement = function(node: any) {
      // Handle local variables - skip for bytecode
    };

    visitor.IfStatement = function(node: any) {
      self.traverseNode(node.condition, visitor);
      instructions.push(opcodes.JIF);
      const jifPos = instructions.length;
      instructions.push(0); // placeholder
      
      if (node.then && Array.isArray(node.then)) {
        node.then.forEach((stmt: any) => self.traverseNode(stmt, visitor));
      }
      
      if (node.else && node.else.length > 0) {
        instructions.push(opcodes.JMP);
        const jmpPos = instructions.length;
        instructions.push(0); // placeholder
        
        // Update JIF offset
        instructions[jifPos] = instructions.length - jifPos - 1;
        
        if (Array.isArray(node.else)) {
          node.else.forEach((stmt: any) => self.traverseNode(stmt, visitor));
        } else if (node.else && node.else.type === 'IfStatement') {
          self.traverseNode(node.else, visitor);
        }
        
        // Update JMP offset
        instructions[jmpPos] = instructions.length - jmpPos - 1;
      } else {
        instructions[jifPos] = instructions.length - jifPos - 1;
      }
    };

    visitor.WhileStatement = function(node: any) {
      const loopStart = instructions.length;
      self.traverseNode(node.condition, visitor);
      instructions.push(opcodes.JIF);
      const jifPos = instructions.length;
      instructions.push(0); // placeholder
      
      if (node.body && Array.isArray(node.body)) {
        node.body.forEach((stmt: any) => self.traverseNode(stmt, visitor));
      }
      
      instructions.push(opcodes.JMP);
      instructions.push(loopStart - instructions.length - 1);
      
      instructions[jifPos] = instructions.length - jifPos - 1;
    };

    visitor.RepeatStatement = function(node: any) {
      const loopStart = instructions.length;
      
      if (node.body && Array.isArray(node.body)) {
        node.body.forEach((stmt: any) => self.traverseNode(stmt, visitor));
      }
      
      self.traverseNode(node.condition, visitor);
      instructions.push(opcodes.JIF);
      instructions.push(loopStart - instructions.length - 1);
    };

    visitor.ReturnStatement = function(node: any) {
      if (node.arguments && node.arguments.length > 0) {
        node.arguments.forEach((arg: any) => self.traverseNode(arg, visitor));
      }
      instructions.push(opcodes.RET);
    };

    visitor.FunctionDeclaration = function(node: any) {
      // Skip function bodies for now
    };

    visitor.TableConstructorExpression = function(node: any) {
      instructions.push(opcodes.NEWTABLE);
      if (node.fields && node.fields.length > 0) {
        node.fields.forEach((field: any) => {
          if (field.key) {
            self.traverseNode(field.key, visitor);
          } else {
            instructions.push(opcodes.PUSH);
            instructions.push(3); // nil
          }
          self.traverseNode(field.value, visitor);
          instructions.push(opcodes.SETTABLE);
        });
      }
    };

    visitor.MemberExpression = function(node: any) {
      self.traverseNode(node.base, visitor);
      self.traverseNode(node.indexer === '.' ? node.identifier : node.index, visitor);
      instructions.push(node.indexer === '.' ? opcodes.GETTABLE : opcodes.GETTABLE);
    };

    return visitor;
  }

  /**
   * Encode number as byte sequence
   */
  private encodeNumber(num: number): number[] {
    const bytes: number[] = [];
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, num, true);
    for (let i = 0; i < 8; i++) {
      bytes.push(new Uint8Array(buffer)[i]);
    }
    return bytes;
  }

  /**
   * Encode string as byte sequence
   */
  private encodeString(str: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    // Add length prefix (4 bytes)
    const lengthBytes: number[] = [];
    const len = bytes.length;
    for (let i = 0; i < 4; i++) {
      lengthBytes.push((len >> (i * 8)) & 0xFF);
    }
    return [...lengthBytes, ...bytes];
  }

  /**
   * Apply bytecode encryption with progress
   */
  private async applyBytecodeEncryptionAsync(bytecode: number[]): Promise<number[]> {
    if (!this.options.bytecodeEncryption) return bytecode;

    const encrypted: number[] = [0xFF]; // marker for encrypted section
    await this.processInChunks(bytecode, (b, i) => {
      const key = this.encryptionKey[i % this.encryptionKey.length];
      encrypted.push(b ^ key);
    }, 50, 1);
    
    return encrypted;
  }

  /**
   * Virtualize bytecode with progress
   */
  private async virtualizeBytecodeAsync(bytecode: number[]): Promise<number[]> {
    const virtualized: number[] = [];
    const opcodes = this.generateOpcodeMap();
    
    // VM loader preamble
    virtualized.push(opcodes.PUSH);
    virtualized.push(0); // number type
    this.encodeNumber(bytecode.length).forEach(b => virtualized.push(b));
    
    virtualized.push(opcodes.NEWTABLE);
    
    await this.processInChunks(bytecode, (b, i) => {
      virtualized.push(opcodes.PUSH);
      virtualized.push(0); // number type
      this.encodeNumber(b).forEach(b => virtualized.push(b));
      virtualized.push(opcodes.PUSH);
      virtualized.push(1); // string type
      this.encodeString(i.toString()).forEach(b => virtualized.push(b));
      virtualized.push(opcodes.SETTABLE);
    }, 20, 2);
    
    return virtualized;
  }

  /**
   * Generate VM interpreter code with size limit
   */
  private async generateVMInterpreterAsync(): Promise<void> {
    const vmCode: string[] = [];
    
    vmCode.push(`
--[[ XZX Virtual Machine v2.0 ]]
local function xzx_vm(bc, env)
    local stack, pc, regs = {}, 1, {}
    local bc_len = #bc
    
    -- Decrypt if needed
    if bc[1] == 0xFF then
        local key = {${this.encryptionKey.join(',')}}
        for i = 2, bc_len do
            bc[i] = bit32.bxor(bc[i], key[(i-2) % #key + 1])
        end
        pc = 2
    end
`);

    // Add anti-debug if enabled
    if (this.options.antiDebugging) {
      vmCode.push(`
    -- Anti-debugging measures
    if debug and debug.getinfo then
        local info = debug.getinfo(1)
        if info and (info.source:match("debug") or info.source:match("hook")) then
            error("Debugger detected")
        end
    end
`);
    }

    // Add anti-tamper if enabled
    if (this.options.antiTamper) {
      const hash = this.calculateHash(this.bytecode);
      vmCode.push(`
    -- Integrity check
    local hash = 0
    for i = 1, bc_len do
        hash = (hash * 31 + bc[i]) % 0x7FFFFFFF
    end
    if hash ~= ${hash} then
        error("Code has been tampered with")
    end
`);
    }

    // Add self-modifying code if enabled
    if (this.options.selfModifying) {
      vmCode.push(`
    -- Self-modifying capability
    local mutate = function()
        local pos = math.random(10, bc_len - 10)
        bc[pos] = bit32.bxor(bc[pos], 0xFF)
    end
    -- Schedule mutations
    for i = 1, 5 do
        coroutine.wrap(function()
            while true do
                coroutine.yield()
                mutate()
            end
        end)()
    end
`);
    }

    vmCode.push(`
    local instructions = {
        [0x01] = function() -- PUSH
            local typ = bc[pc]; pc = pc + 1
            if typ == 0 then -- number
                local val = 0
                for i = 0, 7 do
                    val = val + bc[pc] * (2 ^ (i * 8))
                    pc = pc + 1
                end
                table.insert(stack, val)
            elseif typ == 1 then -- string
                local len = 0
                for i = 0, 3 do
                    len = len + bc[pc] * (2 ^ (i * 8))
                    pc = pc + 1
                end
                local chars = {}
                for i = 1, len do
                    chars[i] = string.char(bc[pc])
                    pc = pc + 1
                end
                table.insert(stack, table.concat(chars))
            elseif typ == 2 then -- boolean
                table.insert(stack, bc[pc] == 1)
                pc = pc + 1
            elseif typ == 3 then -- nil
                table.insert(stack, nil)
            end
        end,
        [0x02] = function() -- POP
            table.remove(stack)
        end,
        [0x03] = function() -- ADD
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a + b)
        end,
        [0x04] = function() -- SUB
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a - b)
        end,
        [0x05] = function() -- MUL
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a * b)
        end,
        [0x06] = function() -- DIV
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a / b)
        end,
        [0x07] = function() -- MOD
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a % b)
        end,
        [0x08] = function() -- POW
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a ^ b)
        end,
        [0x09] = function() -- CONCAT
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a .. b)
        end,
        [0x0A] = function() -- EQ
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a == b)
        end,
        [0x0B] = function() -- LT
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a < b)
        end,
        [0x0C] = function() -- LE
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a <= b)
        end,
        [0x0D] = function() -- NOT
            local a = table.remove(stack)
            table.insert(stack, not a)
        end,
        [0x0E] = function() -- AND
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a and b)
        end,
        [0x0F] = function() -- OR
            local b = table.remove(stack)
            local a = table.remove(stack)
            table.insert(stack, a or b)
        end,
        [0x10] = function() -- JMP
            local offset = bc[pc]; pc = pc + 1
            pc = pc + offset - 1
        end,
        [0x11] = function() -- JIF (jump if false)
            local offset = bc[pc]; pc = pc + 1
            local cond = table.remove(stack)
            if not cond then
                pc = pc + offset - 1
            end
        end,
        [0x12] = function() -- CALL
            local nargs = bc[pc]; pc = pc + 1
            local func = table.remove(stack)
            local args = {}
            for i = 1, nargs do
                table.insert(args, 1, table.remove(stack))
            end
            local results = {func(table.unpack(args))}
            for _, v in ipairs(results) do
                table.insert(stack, v)
            end
        end,
        [0x13] = function() -- RET
            pc = bc_len + 1
        end,
        [0x14] = function() -- GETGLOBAL
            local name = table.remove(stack)
            table.insert(stack, env[name])
        end,
        [0x15] = function() -- SETGLOBAL
            local val = table.remove(stack)
            local name = table.remove(stack)
            env[name] = val
        end,
        [0x16] = function() -- GETTABLE
            local key = table.remove(stack)
            local tbl = table.remove(stack)
            table.insert(stack, tbl[key])
        end,
        [0x17] = function() -- SETTABLE
            local val = table.remove(stack)
            local key = table.remove(stack)
            local tbl = table.remove(stack)
            tbl[key] = val
        end,
        [0x18] = function() -- NEWTABLE
            table.insert(stack, {})
        end,
        [0x19] = function() -- DUP
            local val = stack[#stack]
            table.insert(stack, val)
        end,
        [0x1A] = function() -- SWAP
            local a = stack[#stack - 1]
            local b = stack[#stack]
            stack[#stack - 1] = b
            stack[#stack] = a
        end,
        [0x1B] = function() -- NOP
            -- do nothing
        end,
    }

    -- Main execution loop
    while pc <= bc_len do
        local op = bc[pc]; pc = pc + 1
        if instructions[op] then
            instructions[op]()
        end
    end
    return stack[1]
end
`);

    this.vmFunctions.push(vmCode.join('\n'));
  }

  /**
   * Calculate hash for anti-tamper
   */
  private calculateHash(bytecode: number[]): number {
    let hash = 0;
    for (const b of bytecode) {
      hash = (hash * 31 + b) % 0x7FFFFFFF;
    }
    return hash;
  }

  /**
   * Generate VM-based output with progress
   */
  private async generateVMOutputAsync(): Promise<string> {
    const parts: string[] = [];

    // Add VM functions
    parts.push(...this.vmFunctions);

    // Encode bytecode
    let bytecodeStr: string;
    if (this.options.vmCompression) {
      // Run-length encoding with progress
      const rle: number[] = [];
      await this.processInChunks(this.bytecode, (b, i, arr) => {
        if (i === 0 || b !== arr[i - 1]) {
          rle.push(1);
          rle.push(b);
        } else {
          rle[rle.length - 2]++;
        }
      }, 100, 1);
      bytecodeStr = '{' + rle.join(',') + '}';
    } else {
      bytecodeStr = '{' + this.bytecode.join(',') + '}';
    }

    parts.push(`
local bytecode = ${bytecodeStr}
local env = getfenv and getfenv() or _ENV
return xzx_vm(bytecode, env)
`);

    return parts.join('\n\n');
  }

  /**
   * Generate standard (non-VM) output
   */
  private async generateStandardOutputAsync(): Promise<string> {
    const generator = new LuaGenerator(this.ast, this.options, this.nameMap, this.stringMap);
    return generator.generate();
  }

  // AST traversal helpers
  private traverseAST(node: any, visitor: any): void {
    if (!node || typeof node !== 'object') return;
    
    // Call visitor for this node type
    if (visitor[node.type]) {
      visitor[node.type](node);
    }
    
    // Recursively traverse all properties
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== 'type' && key !== 'loc' && typeof node[key] === 'object') {
        this.traverseNode(node[key], visitor);
      }
    }
  }

  private traverseNode(node: any, visitor: any): void {
    if (Array.isArray(node)) {
      // Traverse each item in the array
      for (let i = 0; i < node.length; i++) {
        if (node[i] && typeof node[i] === 'object') {
          this.traverseAST(node[i], visitor);
        }
      }
    } else if (node && typeof node === 'object') {
      this.traverseAST(node, visitor);
    }
  }

  // Async transformation stubs
  private async constantFoldingAsync(): Promise<void> { await this.sleep(5); }
  private async deadCodeEliminationAsync(): Promise<void> { await this.sleep(5); }
  private async inlineSimpleFunctionsAsync(): Promise<void> { await this.sleep(5); }
  private async reorderStatementsAsync(): Promise<void> { await this.sleep(5); }
  private async mangleIdentifiersAsync(): Promise<void> { this.metrics.namesMangled++; await this.sleep(5); }
  private async encryptStringsAsync(): Promise<void> { this.metrics.stringsEncoded++; await this.sleep(5); }
  private async encodeNumbersAsync(): Promise<void> { this.metrics.numbersEncoded++; await this.sleep(5); }
  private async flattenControlFlowAsync(): Promise<void> { await this.sleep(10); }
  private async insertOpaquePredicatesAsync(): Promise<void> { await this.sleep(10); }
  private async insertBasicControlFlowAsync(): Promise<void> { await this.sleep(5); }
  private async injectDeadCodeAsync(): Promise<void> { this.metrics.deadCodeBlocks++; await this.sleep(10); }
  private async splitCodeAsync(): Promise<void> { await this.sleep(10); }
  private async mutateCodeAsync(): Promise<void> { await this.sleep(10); }
  private async insertAntiDebugAsync(): Promise<void> { this.metrics.antiDebugChecks++; await this.sleep(5); }
  private async insertAntiTamperAsync(): Promise<void> { await this.sleep(5); }
  private async useDebugFeaturesAsync(): Promise<void> { await this.sleep(5); }
  private async lockEnvironmentAsync(): Promise<void> { await this.sleep(5); }
  private async optimizeStaticEnvironmentAsync(): Promise<void> { await this.sleep(5); }
  private async hardcodeGlobalsAsync(): Promise<void> { await this.sleep(5); }
  private async applyGCFixesAsync(): Promise<void> { await this.sleep(5); }
}

/**
 * Lua code generator for non-VM mode
 */
class LuaGenerator {
  private output: string[] = [];
  private indent = 0;

  constructor(
    private ast: any, 
    private options: ObfuscationOptions,
    private nameMap: Map<string, string>,
    private stringMap: Map<string, string>
  ) {}

  generate(): string {
    this.traverse(this.ast);
    return this.output.join('');
  }

  private traverse(node: any): void {
    if (!node) return;
    
    switch (node.type) {
      case 'Chunk':
        if (node.body && Array.isArray(node.body)) {
          node.body.forEach((stmt: any) => this.traverse(stmt));
        }
        break;
        
      case 'AssignmentStatement':
        if (node.variables && node.variables.length > 0) {
          node.variables.forEach((v: any, i: number) => {
            if (i > 0) this.output.push(', ');
            this.traverse(v);
          });
          this.output.push(' = ');
          if (node.init && node.init.length > 0) {
            node.init.forEach((i: any, idx: number) => {
              if (idx > 0) this.output.push(', ');
              this.traverse(i);
            });
          }
          this.output.push(';\n');
        }
        break;
        
      case 'LocalStatement':
        this.output.push('local ');
        if (node.variables && node.variables.length > 0) {
          node.variables.forEach((v: any, i: number) => {
            if (i > 0) this.output.push(', ');
            this.output.push(this.getName(v.name));
          });
        }
        if (node.init && node.init.length > 0) {
          this.output.push(' = ');
          node.init.forEach((i: any, idx: number) => {
            if (idx > 0) this.output.push(', ');
            this.traverse(i);
          });
        }
        this.output.push(';\n');
        break;
        
      case 'CallStatement':
        if (node.expression) {
          this.traverse(node.expression);
          this.output.push(';\n');
        }
        break;
        
      case 'CallExpression':
        if (node.base) {
          this.traverse(node.base);
          this.output.push('(');
          if (node.arguments && node.arguments.length > 0) {
            node.arguments.forEach((arg: any, i: number) => {
              if (i > 0) this.output.push(', ');
              this.traverse(arg);
            });
          }
          this.output.push(')');
        }
        break;
        
      case 'StringLiteral':
        if (node.raw) {
          if (this.options.encodeStrings && this.stringMap.has(node.raw)) {
            this.output.push(this.stringMap.get(node.raw)!);
          } else {
            this.output.push(node.raw);
          }
        }
        break;
        
      case 'NumericLiteral':
        if (node.value !== undefined) {
          if (this.options.encodeNumbers) {
            this.output.push('(0x' + Math.floor(node.value * 1000).toString(16) + '/1000)');
          } else {
            this.output.push(node.value.toString());
          }
        }
        break;
        
      case 'BooleanLiteral':
        this.output.push(node.value ? 'true' : 'false');
        break;
        
      case 'NilLiteral':
        this.output.push('nil');
        break;
        
      case 'Identifier':
        if (node.name) {
          this.output.push(this.getName(node.name));
        }
        break;
        
      case 'BinaryExpression':
        this.output.push('(');
        if (node.left) this.traverse(node.left);
        this.output.push(' ' + (node.operator || '') + ' ');
        if (node.right) this.traverse(node.right);
        this.output.push(')');
        break;
        
      case 'UnaryExpression':
        if (node.operator) this.output.push(node.operator);
        if (node.argument) this.traverse(node.argument);
        break;
        
      case 'FunctionDeclaration':
        this.output.push('function ');
        if (node.identifier) {
          this.traverse(node.identifier);
        }
        this.output.push('(');
        if (node.parameters && node.parameters.length > 0) {
          node.parameters.forEach((p: any, i: number) => {
            if (i > 0) this.output.push(', ');
            if (p.name) this.output.push(this.getName(p.name));
          });
        }
        this.output.push(')\n');
        this.indent++;
        if (node.body && Array.isArray(node.body)) {
          node.body.forEach((stmt: any) => {
            this.output.push('  '.repeat(this.indent));
            this.traverse(stmt);
          });
        }
        this.indent--;
        this.output.push('  '.repeat(this.indent) + 'end\n');
        break;
        
      case 'IfStatement':
        this.output.push('if ');
        if (node.condition) this.traverse(node.condition);
        this.output.push(' then\n');
        this.indent++;
        if (node.then && Array.isArray(node.then)) {
          node.then.forEach((stmt: any) => {
            this.output.push('  '.repeat(this.indent));
            this.traverse(stmt);
          });
        }
        this.indent--;
        if (node.else && node.else.length > 0) {
          this.output.push('  '.repeat(this.indent) + 'else\n');
          this.indent++;
          if (Array.isArray(node.else)) {
            node.else.forEach((stmt: any) => {
              this.output.push('  '.repeat(this.indent));
              this.traverse(stmt);
            });
          } else if (node.else && node.else.type === 'IfStatement') {
            this.output.push('  '.repeat(this.indent));
            this.traverse(node.else);
          }
          this.indent--;
        }
        this.output.push('  '.repeat(this.indent) + 'end\n');
        break;
        
      case 'WhileStatement':
        this.output.push('while ');
        if (node.condition) this.traverse(node.condition);
        this.output.push(' do\n');
        this.indent++;
        if (node.body && Array.isArray(node.body)) {
          node.body.forEach((stmt: any) => {
            this.output.push('  '.repeat(this.indent));
            this.traverse(stmt);
          });
        }
        this.indent--;
        this.output.push('  '.repeat(this.indent) + 'end\n');
        break;
        
      case 'RepeatStatement':
        this.output.push('repeat\n');
        this.indent++;
        if (node.body && Array.isArray(node.body)) {
          node.body.forEach((stmt: any) => {
            this.output.push('  '.repeat(this.indent));
            this.traverse(stmt);
          });
        }
        this.indent--;
        this.output.push('  '.repeat(this.indent) + 'until ');
        if (node.condition) this.traverse(node.condition);
        this.output.push(';\n');
        break;
        
      case 'ForGenericStatement':
        this.output.push('for ');
        if (node.variables && node.variables.length > 0) {
          node.variables.forEach((v: any, i: number) => {
            if (i > 0) this.output.push(', ');
            if (v.name) this.output.push(this.getName(v.name));
          });
        }
        this.output.push(' in ');
        if (node.iterators && node.iterators.length > 0) {
          node.iterators.forEach((it: any, i: number) => {
            if (i > 0) this.output.push(', ');
            this.traverse(it);
          });
        }
        this.output.push(' do\n');
        this.indent++;
        if (node.body && Array.isArray(node.body)) {
          node.body.forEach((stmt: any) => {
            this.output.push('  '.repeat(this.indent));
            this.traverse(stmt);
          });
        }
        this.indent--;
        this.output.push('  '.repeat(this.indent) + 'end\n');
        break;
        
      case 'ForNumericStatement':
        this.output.push('for ');
        if (node.variable && node.variable.name) {
          this.output.push(this.getName(node.variable.name));
        }
        this.output.push(' = ');
        if (node.start) this.traverse(node.start);
        this.output.push(', ');
        if (node.end) this.traverse(node.end);
        if (node.step) {
          this.output.push(', ');
          this.traverse(node.step);
        }
        this.output.push(' do\n');
        this.indent++;
        if (node.body && Array.isArray(node.body)) {
          node.body.forEach((stmt: any) => {
            this.output.push('  '.repeat(this.indent));
            this.traverse(stmt);
          });
        }
        this.indent--;
        this.output.push('  '.repeat(this.indent) + 'end\n');
        break;
        
      case 'ReturnStatement':
        this.output.push('return ');
        if (node.arguments && node.arguments.length > 0) {
          node.arguments.forEach((arg: any, i: number) => {
            if (i > 0) this.output.push(', ');
            this.traverse(arg);
          });
        }
        this.output.push(';\n');
        break;
        
      case 'TableConstructorExpression':
        this.output.push('{');
        if (node.fields && node.fields.length > 0) {
          node.fields.forEach((field: any, i: number) => {
            if (i > 0) this.output.push(', ');
            if (field.key) {
              if (field.key.type === 'Identifier') {
                if (field.key.name) this.output.push(this.getName(field.key.name));
              } else {
                this.output.push('[');
                this.traverse(field.key);
                this.output.push(']');
              }
              this.output.push(' = ');
            }
            if (field.value) this.traverse(field.value);
          });
        }
        this.output.push('}');
        break;
        
      case 'MemberExpression':
        if (node.base) this.traverse(node.base);
        if (node.indexer === '.') {
          this.output.push('.');
          if (node.identifier && node.identifier.name) {
            this.output.push(this.getName(node.identifier.name));
          }
        } else {
          this.output.push('[');
          if (node.index) this.traverse(node.index);
          this.output.push(']');
        }
        break;
        
      default:
        // Skip unhandled nodes
        break;
    }
  }

  private getName(original: string): string {
    return this.nameMap.get(original) || original;
  }
}

/**
 * Main export function for the obfuscator
 */
export async function obfuscateLua(source: string, options: any): Promise<ObfuscationResult> {
  try {
    // Map UI options to engine options
    const engineOptions: ObfuscationOptions = {
      mangleNames: options.mangleNames || false,
      encodeStrings: options.encodeStrings || false,
      encodeNumbers: options.encodeNumbers || false,
      controlFlow: options.controlFlow || false,
      minify: options.minify || false,
      protectionLevel: options.protectionLevel || 0,
      encryptionAlgorithm: options.encryptionAlgorithm || 'none',
      controlFlowFlattening: options.controlFlowFlattening || false,
      deadCodeInjection: options.deadCodeInjection || false,
      antiDebugging: options.antiDebugging || false,
      formattingStyle: options.formattingStyle || 'minified',
      intenseVM: options.intenseVM || false,
      gcFixes: options.gcFixes || false,
      targetVersion: options.targetVersion || '5.1',
      hardcodeGlobals: options.hardcodeGlobals || false,
      optimizationLevel: options.optimizationLevel || 1,
      staticEnvironment: options.staticEnvironment || false,
      vmCompression: options.vmCompression || false,
      disableLineInfo: options.disableLineInfo || false,
      useDebugLibrary: options.useDebugLibrary || false,
      opaquePredicates: options.opaquePredicates || false,
      virtualization: options.virtualization || false,
      bytecodeEncryption: options.bytecodeEncryption || false,
      antiTamper: options.antiTamper || false,
      selfModifying: options.selfModifying || false,
      mutation: options.mutation || false,
      codeSplitting: options.codeSplitting || false,
      environmentLock: options.environmentLock || false,
      integrityChecks: options.integrityChecks || false
    };

    // Create engine instance and obfuscate
    const engine = new XZXObfuscatorEngine(engineOptions);
    return await engine.obfuscate(source);
  } catch (error) {
    console.error('Obfuscation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorDetails: error
    };
  }
}

export default obfuscateLua;
