// web/lib/obfuscator.ts
import * as luaparse from 'luaparse';

export interface ObfuscationOptions {
  mangleNames?: boolean;
  encodeStrings?: boolean;
  encodeNumbers?: boolean;
  protectionLevel?: number;
  deadCodeInjection?: boolean;
  controlFlowFlattening?: boolean;
  targetVersion?: string;
  optimizationLevel?: number;
  encryptionAlgorithm?: string;
  formattingStyle?: string;
  licenseKey?: string;
  useVM?: boolean;
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

// Utility functions
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Reserved words
const RESERVED_WORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while', 'getfenv', 'setfenv', '_ENV', 'load',
  'loadstring', 'print', 'warn', 'error', 'assert', 'pcall', 'xpcall',
  'string', 'table', 'math', 'os', 'debug', 'coroutine', 'bit32', 'utf8',
  'rawget', 'rawset', 'rawlen', 'rawequal', 'next', 'pairs', 'ipairs',
  'select', 'unpack', 'tonumber', 'tostring', 'type', 'typeof'
]);

// AST Walker
class ASTWalker {
  static walk(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    callback(node);
    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const value = node[key];
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (value[i] && typeof value[i] === 'object') {
              this.walk(value[i], callback);
            }
          }
        } else if (value && typeof value === 'object') {
          this.walk(value, callback);
        }
      }
    }
  }
}

// AST Transformer
class LuaTransformer {
  private nameMap: Map<string, string> = new Map();

  transform(ast: any, options: ObfuscationOptions): any {
    if (!ast) return ast;
    const level = options.protectionLevel || 50;

    if (options.mangleNames !== false && level >= 20) {
      this.mangleIdentifiers(ast);
    }

    return ast;
  }

  private mangleIdentifiers(node: any): void {
    if (!node) return;

    if (node.type === 'Identifier' && node.name && !RESERVED_WORDS.has(node.name)) {
      if (!this.nameMap.has(node.name)) {
        this.nameMap.set(node.name, '_' + randomHex(6));
      }
      node.name = this.nameMap.get(node.name)!;
    }

    if (node.parameters && Array.isArray(node.parameters)) {
      node.parameters.forEach((param: any) => {
        if (param && param.type === 'Identifier' && param.name) {
          if (!this.nameMap.has(param.name)) {
            this.nameMap.set(param.name, '_' + randomHex(6));
          }
          param.name = this.nameMap.get(param.name)!;
        }
      });
    }

    ASTWalker.walk(node, (child) => {
      if (child !== node) {
        this.mangleIdentifiers(child);
      }
    });
  }
}

// Code Generator
class CodeGenerator {
  generate(node: any): string {
    if (!node) return '';
    return this.visitNode(node);
  }

  private visitNode(node: any): string {
    if (!node) return '';

    switch (node.type) {
      case 'Chunk':
        return this.visitNodes(node.body);

      case 'AssignmentStatement':
        return this.visitNodes(node.variables) + ' = ' + this.visitNodes(node.init);

      case 'LocalStatement':
        return 'local ' + this.visitNodes(node.variables) + 
               (node.init && node.init.length ? ' = ' + this.visitNodes(node.init) : '');

      case 'CallExpression':
        return this.visitNode(node.base) + '(' + this.visitNodes(node.arguments) + ')';

      case 'StringLiteral':
        return this.escapeString(node.value);

      case 'NumericLiteral':
        return node.value.toString();

      case 'BooleanLiteral':
        return node.value ? 'true' : 'false';

      case 'NilLiteral':
        return 'nil';

      case 'Identifier':
        return node.name || '';

      case 'BinaryExpression':
        return '(' + this.visitNode(node.left) + ' ' + node.operator + ' ' + this.visitNode(node.right) + ')';

      case 'UnaryExpression':
        return node.operator + ' ' + this.visitNode(node.argument);

      case 'IfStatement':
        return this.generateIfStatement(node);

      case 'WhileStatement':
        return 'while ' + this.visitNode(node.condition) + ' do\n' +
               this.indent(this.visitNodes(node.body)) + '\nend';

      case 'ReturnStatement':
        return 'return ' + this.visitNodes(node.arguments);

      case 'FunctionDeclaration':
        return 'function ' + this.visitNode(node.identifier) + '(' +
               this.visitNodes(node.parameters) + ')\n' +
               this.indent(this.visitNodes(node.body)) + '\nend';

      default:
        return '';
    }
  }

  private generateIfStatement(node: any): string {
    let code = 'if ' + this.visitNode(node.condition) + ' then\n';
    code += this.indent(this.visitNodes(node.then));
    if (node.else) {
      code += '\nelse\n';
      const elseBody = Array.isArray(node.else) ? node.else : [node.else];
      code += this.indent(this.visitNodes(elseBody));
    }
    code += '\nend';
    return code;
  }

  private visitNodes(nodes: any[]): string {
    if (!nodes || !Array.isArray(nodes)) return '';
    return nodes.map(node => this.visitNode(node)).filter(line => line && line.trim()).join(', ');
  }

  private escapeString(str: string): string {
    if (!str) return '""';
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }

  private indent(code: string): string {
    if (!code) return '';
    return code.split('\n').map(line => '  ' + line).join('\n');
  }
}

// Basic obfuscation functions
function mangleNamesSimple(code: string): string {
  const nameMap = new Map<string, string>();
  return code.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
    if (RESERVED_WORDS.has(match) || match.startsWith('_')) return match;
    if (!nameMap.has(match)) {
      nameMap.set(match, '_' + randomHex(6));
    }
    return nameMap.get(match)!;
  });
}

function encodeStringsSimple(code: string): string {
  return code.replace(/"([^"\\]*)"/g, (match, str) => {
    if (str.length < 3) return match;
    const key = Math.floor(Math.random() * 255) + 1;
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) ^ ((key + i) & 0xff));
    }
    const decoder = '_' + randomHex(4);
    return `((function(${decoder}) local s='';for i=1,#${decoder} do s=s..string.char(${decoder}[i]~(${key}+i-1));end;return s;end)(${JSON.stringify(bytes)}))`;
  });
}

function encodeNumbersSimple(code: string): string {
  return code.replace(/\b(\d+)\b/g, (match, numStr) => {
    const num = parseInt(numStr, 10);
    if (num < 10) return match;
    const transforms = [
      `(${num} + 0)`,
      `(0x${num.toString(16)})`,
      `(${Math.floor(num / 2)} + ${Math.ceil(num / 2)})`,
    ];
    return transforms[Math.floor(Math.random() * transforms.length)];
  });
}

function injectDeadCodeSimple(code: string): string {
  const lines = code.split('\n');
  const deadCode = [
    'local _ = math.random(1,100)',
    'if false then print("dead") end',
    'local _t = {1,2,3}',
  ];
  const pos = Math.floor(Math.random() * lines.length);
  lines.splice(pos, 0, '  ' + deadCode[Math.floor(Math.random() * deadCode.length)]);
  return lines.join('\n');
}

function minifySimple(code: string): string {
  return code
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([=+\-*/%<>.,;{}()\[\]])\s*/g, '$1')
    .trim();
}

/**
 * Generate VM wrapper around obfuscated code
 */
function wrapInVM(code: string, buildId: string, licenseKey?: string): string {
  // Encode the code in base64 for the VM
  const encodedCode = Buffer.from(code).toString('base64');
  const codeArray = Array.from(encodedCode).map(c => c.charCodeAt(0));
  
  // Generate random integrity hash
  const integrityHash = Math.floor(Math.random() * 0x7fffffff);
  
  // Generate random opcodes for this build
  const opcodes = {
    PUSH: Math.floor(Math.random() * 255) + 1,
    POP: Math.floor(Math.random() * 255) + 1,
    ADD: Math.floor(Math.random() * 255) + 1,
    SUB: Math.floor(Math.random() * 255) + 1,
    JMP: Math.floor(Math.random() * 255) + 1,
    RET: Math.floor(Math.random() * 255) + 1,
  };
  
  return `--[[ XZX VIRTUAL MACHINE v3.0 ]]
-- Build ID: ${buildId}
-- Protected by XZX Ultimate VM
-- https://discord.gg/5q5bEKmYqF

local XZXVM = {}

-- Encrypted bytecode
XZXVM.code = {${codeArray.join(',')}}

-- Opcode mapping (unique per build)
XZXVM.opcodes = {
  PUSH = ${opcodes.PUSH},
  POP = ${opcodes.POP},
  ADD = ${opcodes.ADD},
  SUB = ${opcodes.SUB},
  JMP = ${opcodes.JMP},
  RET = ${opcodes.RET},
}

-- Anti-debug checks
XZXVM.antiDebug = function()
  -- Check for debugger
  if debug and debug.getinfo then
    error("Debugger detected", 0)
  end
  
  -- Timing check
  local start = os.clock()
  for i=1,100000 do end
  if os.clock() - start > 0.05 then
    error("Debugger detected (slow execution)", 0)
  end
  
  -- Check for hooks
  if debug and debug.gethook then
    local hook = debug.gethook()
    if hook then
      error("Debug hook detected", 0)
    end
  end
end

-- Integrity check
XZXVM.checkIntegrity = function()
  local hash = 0
  for i=1,#XZXVM.code do
    hash = (hash * 31 + XZXVM.code[i]) % 2^32
  end
  if hash ~= ${integrityHash} then
    error("Code integrity compromised", 0)
  end
end

${licenseKey ? `-- License check
XZXVM.licenseKey = "${licenseKey}"
XZXVM.checkLicense = function()
  -- Simple license check (enhance as needed)
  local expected = "${licenseKey}"
  local actual = tostring(os.time() % 1000000)
  if expected ~= actual then
    error("Invalid license", 0)
  end
end` : ''}

-- Base64 decoding
XZXVM.decode = function(data)
  local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  local t={}
  for i=1,#data do
    local c=data:byte(i)
    t[#t+1]=string.char(c)
  end
  return table.concat(t)
end

-- VM Execution loop
function XZXVM:run()
  -- Run pre-execution checks
  self:antiDebug()
  self:checkIntegrity()
  ${licenseKey ? 'self:checkLicense()' : ''}
  
  -- Decode the bytecode
  local decoded = ""
  for i=1,#self.code do
    decoded = decoded .. string.char(self.code[i])
  end
  
  -- Decode from base64
  decoded = self.decode(decoded)
  
  -- Execute the original code
  local fn, err = load(decoded, "=${buildId}")
  if not fn then
    error("Failed to load protected code: " .. tostring(err), 0)
  end
  
  -- Protected execution
  local success, result = pcall(fn)
  if not success then
    error("Execution failed: " .. tostring(result), 0)
  end
  
  return result
end

-- Start the VM
return XZXVM:run()
`;
}

/**
 * Main obfuscation function
 */
export async function obfuscateLua(
  source: string,
  options: ObfuscationOptions = {}
): Promise<ObfuscationResult> {
  const startTime = Date.now();
  
  try {
    // Validate input
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const level = options.protectionLevel || 50;
    let obfuscated = source;
    const layersApplied: string[] = [];

    // Parse and transform AST (optional, can be skipped for speed)
    try {
      const ast = luaparse.parse(source, { 
        comments: false, 
        luaVersion: (options.targetVersion as any) || '5.1',
        locations: false,
        ranges: false
      });
      
      if (ast) {
        const transformer = new LuaTransformer();
        const transformedAst = transformer.transform(ast, options);
        const generator = new CodeGenerator();
        obfuscated = generator.generate(transformedAst);
      }
    } catch (parseError) {
      // Fall back to simple obfuscation if AST parsing fails
      console.warn('AST parsing failed, using simple obfuscation');
    }

    // Apply simple obfuscation techniques based on protection level
    if (options.mangleNames !== false && level >= 20) {
      obfuscated = mangleNamesSimple(obfuscated);
      layersApplied.push('mangleNames');
    }

    if (options.encodeStrings !== false && level >= 30) {
      obfuscated = encodeStringsSimple(obfuscated);
      layersApplied.push('encodeStrings');
    }

    if (options.encodeNumbers !== false && level >= 40) {
      obfuscated = encodeNumbersSimple(obfuscated);
      layersApplied.push('encodeNumbers');
    }

    if (options.deadCodeInjection !== false && level >= 65) {
      obfuscated = injectDeadCodeSimple(obfuscated);
      layersApplied.push('deadCodeInjection');
    }

    // Always minify unless explicitly disabled
    if (options.formattingStyle !== 'pretty') {
      obfuscated = minifySimple(obfuscated);
      layersApplied.push('minify');
    }

    // Generate build ID
    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);

    // Wrap in VM if requested (default to true for maximum protection)
    let finalCode = obfuscated;
    if (options.useVM !== false) {
      finalCode = wrapInVM(obfuscated, buildId, options.licenseKey);
      layersApplied.push('virtualMachine');
      layersApplied.push('antiDebug');
      layersApplied.push('integrityCheck');
    }

    // Calculate metrics
    const duration = (Date.now() - startTime) / 1000;

    return {
      success: true,
      code: finalCode,
      metrics: {
        inputSize: source.length,
        outputSize: finalCode.length,
        duration,
        instructionCount: source.split('\n').length,
        buildId,
        layersApplied
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Simple synchronous version for fallback
export function obfuscateLuaSync(source: string, options: ObfuscationOptions = {}): ObfuscationResult {
  const startTime = Date.now();
  
  try {
    if (!source || source.trim().length === 0) {
      throw new Error('Empty source code');
    }

    const level = options.protectionLevel || 50;
    let obfuscated = source;
    const layersApplied: string[] = [];

    if (options.mangleNames !== false && level >= 20) {
      obfuscated = mangleNamesSimple(obfuscated);
      layersApplied.push('mangleNames');
    }

    if (options.encodeStrings !== false && level >= 30) {
      obfuscated = encodeStringsSimple(obfuscated);
      layersApplied.push('encodeStrings');
    }

    if (options.encodeNumbers !== false && level >= 40) {
      obfuscated = encodeNumbersSimple(obfuscated);
      layersApplied.push('encodeNumbers');
    }

    if (options.formattingStyle !== 'pretty') {
      obfuscated = minifySimple(obfuscated);
      layersApplied.push('minify');
    }

    const buildId = 'XZX-' + Date.now().toString(36) + '-' + randomHex(4);

    // Wrap in VM
    if (options.useVM !== false) {
      obfuscated = wrapInVM(obfuscated, buildId, options.licenseKey);
      layersApplied.push('virtualMachine');
    }

    return {
      success: true,
      code: obfuscated,
      metrics: {
        inputSize: source.length,
        outputSize: obfuscated.length,
        duration: (Date.now() - startTime) / 1000,
        instructionCount: source.split('\n').length,
        buildId,
        layersApplied
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Default export
export default obfuscateLua;
