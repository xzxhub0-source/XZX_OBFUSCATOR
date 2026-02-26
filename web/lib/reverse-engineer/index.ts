// web/lib/reverse-engineer/index.ts
import * as luaparse from 'luaparse';

export interface ReverseEngineerOptions {
  verbose?: boolean;
  maxDepth?: number;
  timeout?: number;
  analyzeVM?: boolean;
  decryptStrings?: boolean;
  emulateBytecode?: boolean;
  traceExecution?: boolean;
  bypassAntiTamper?: boolean;
}

export interface ReverseEngineerResult {
  success: boolean;
  deobfuscated?: string;
  analysis?: {
    vmDetected: boolean;
    bytecode?: number[];
    opcodes?: Map<number, string>;
    handlers?: Map<number, string>;
    strings?: Map<string, string>;
    functions?: FunctionInfo[];
    controlFlow?: ControlFlowGraph;
    antiTamper?: AntiTamperInfo[];
    warnings?: string[];
  };
  stats?: {
    duration: number;
    stringsDecoded: number;
    functionsFound: number;
    vmInstructions: number;
    complexity: number;
  };
  error?: string;
}

interface FunctionInfo {
  name: string;
  params: string[];
  lines: [number, number];
  complexity: number;
  decompiled?: string;
}

interface ControlFlowGraph {
  nodes: Array<{ id: number; type: string; line: number }>;
  edges: Array<{ from: number; to: number; type: string }>;
}

interface AntiTamperInfo {
  type: 'integrity' | 'environment' | 'debug' | 'timeout';
  location: number;
  bypassed: boolean;
}

export class XZXReverseEngineer {
  private options: ReverseEngineerOptions;
  private warnings: string[] = [];

  constructor(options: ReverseEngineerOptions = {}) {
    this.options = {
      verbose: false,
      maxDepth: 100,
      timeout: 30000,
      analyzeVM: true,
      decryptStrings: true,
      emulateBytecode: true,
      traceExecution: false,
      bypassAntiTamper: true,
      ...options
    };
  }

  /**
   * Main reverse engineering entry point
   */
  async reverse(code: string): Promise<ReverseEngineerResult> {
    const startTime = Date.now();
    const stats = {
      duration: 0,
      stringsDecoded: 0,
      functionsFound: 0,
      vmInstructions: 0,
      complexity: 0
    };

    try {
      if (!code || code.trim().length === 0) {
        throw new Error('Empty code provided');
      }

      let deobfuscated = code;
      const analysis: ReverseEngineerResult['analysis'] = {
        vmDetected: false,
        strings: new Map(),
        functions: [],
        warnings: []
      };

      // PHASE 1: Static Analysis - Parse into AST
      if (this.options.verbose) console.log('🔍 Phase 1: Static Analysis');
      const ast = await this.parseAST(code);
      analysis.functions = this.extractFunctions(ast);
      stats.functionsFound = analysis.functions.length;
      analysis.controlFlow = this.buildControlFlow(ast);
      stats.complexity = analysis.controlFlow.nodes.length;

      // PHASE 2: VM Detection and Analysis
      if (this.options.analyzeVM) {
        if (this.options.verbose) console.log('🖥️ Phase 2: VM Analysis');
        const vmAnalysis = this.analyzeVM(code);
        analysis.vmDetected = vmAnalysis.detected;
        analysis.bytecode = vmAnalysis.bytecode;
        analysis.opcodes = vmAnalysis.opcodes;
        analysis.handlers = vmAnalysis.handlers;
        stats.vmInstructions = vmAnalysis.bytecode?.length || 0;
      }

      // PHASE 3: String Decryption
      if (this.options.decryptStrings) {
        if (this.options.verbose) console.log('🔑 Phase 3: String Decryption');
        const strings = await this.decryptAllStrings(deobfuscated);
        analysis.strings = strings.map;
        stats.stringsDecoded = strings.count;
        deobfuscated = strings.code;
      }

      // PHASE 4: Bytecode Emulation (if VM detected)
      if (this.options.emulateBytecode && analysis.vmDetected && analysis.bytecode) {
        if (this.options.verbose) console.log('⚙️ Phase 4: Bytecode Emulation');
        const emulation = await this.emulateBytecode(analysis);
        if (emulation.success) {
          deobfuscated = emulation.code + '\n\n-- [[ Emulated VM Output ]]\n' + deobfuscated;
        }
      }

      // PHASE 5: Anti-Tamper Bypass
      if (this.options.bypassAntiTamper) {
        if (this.options.verbose) console.log('🛡️ Phase 5: Anti-Tamper Bypass');
        const tamperAnalysis = this.detectAntiTamper(code);
        analysis.antiTamper = tamperAnalysis;
        deobfuscated = this.bypassAntiTamper(deobfuscated, tamperAnalysis);
      }

      // PHASE 6: Control Flow Reconstruction
      if (analysis.controlFlow) {
        if (this.options.verbose) console.log('🔄 Phase 6: Control Flow Reconstruction');
        deobfuscated = this.reconstructControlFlow(deobfuscated, analysis.controlFlow);
      }

      // PHASE 7: Final Beautification
      deobfuscated = this.beautify(deobfuscated);

      stats.duration = (Date.now() - startTime) / 1000;
      analysis.warnings = this.warnings;

      return {
        success: true,
        deobfuscated,
        analysis,
        stats
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats
      };
    }
  }

  /**
   * PHASE 1: Parse code into AST
   */
  private async parseAST(code: string): Promise<any> {
    try {
      return luaparse.parse(code, {
        comments: true,
        locations: true,
        ranges: true
      });
    } catch (e) {
      this.warnings.push(`AST parsing failed: ${e}`);
      return null;
    }
  }

  /**
   * Extract functions from AST
   */
  private extractFunctions(ast: any): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    
    const walk = (node: any) => {
      if (!node) return;
      
      if (node.type === 'FunctionDeclaration' || node.type === 'LocalFunction') {
        functions.push({
          name: node.identifier?.name || 'anonymous',
          params: node.parameters?.map((p: any) => p.name) || [],
          lines: [node.loc?.start?.line || 0, node.loc?.end?.line || 0],
          complexity: this.calculateComplexity(node)
        });
      }
      
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(walk);
          } else if (child && typeof child === 'object') {
            walk(child);
          }
        }
      }
    };
    
    walk(ast);
    return functions;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(node: any): number {
    let complexity = 1;
    
    const count = (n: any) => {
      if (!n) return;
      if (n.type === 'IfStatement') complexity++;
      if (n.type === 'WhileStatement') complexity++;
      if (n.type === 'ForStatement') complexity++;
      if (n.type === 'RepeatStatement') complexity++;
      
      for (const key in n) {
        if (n.hasOwnProperty(key)) {
          const child = n[key];
          if (Array.isArray(child)) {
            child.forEach(count);
          } else if (child && typeof child === 'object') {
            count(child);
          }
        }
      }
    };
    
    count(node);
    return complexity;
  }

  /**
   * Build control flow graph
   */
  private buildControlFlow(ast: any): ControlFlowGraph {
    const nodes: ControlFlowGraph['nodes'] = [];
    const edges: ControlFlowGraph['edges'] = [];
    let nodeId = 0;
    
    const walk = (node: any, parentId?: number) => {
      if (!node) return;
      
      const id = nodeId++;
      nodes.push({
        id,
        type: node.type,
        line: node.loc?.start?.line || 0
      });
      
      if (parentId !== undefined) {
        edges.push({
          from: parentId,
          to: id,
          type: 'contains'
        });
      }
      
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(item => walk(item, id));
          } else if (child && typeof child === 'object') {
            walk(child, id);
          }
        }
      }
    };
    
    walk(ast);
    return { nodes, edges };
  }

  /**
   * PHASE 2: VM Detection and Analysis
   */
  private analyzeVM(code: string): {
    detected: boolean;
    bytecode?: number[];
    opcodes?: Map<number, string>;
    handlers?: Map<number, string>;
  } {
    const result: any = { detected: false };
    
    // Pattern 1: Detect bytecode tables
    const bytecodePattern = /bytecode\s*=\s*{([^}]+)}/;
    const bytecodeMatch = code.match(bytecodePattern);
    if (bytecodeMatch) {
      result.detected = true;
      try {
        result.bytecode = bytecodeMatch[1].split(',')
          .map(b => parseInt(b.trim()))
          .filter(b => !isNaN(b));
      } catch {
        this.warnings.push('Failed to parse bytecode table');
      }
    }
    
    // Pattern 2: Detect opcode mapping
    const opcodePattern = /opcodes?\s*=\s*{([^}]+)}/;
    const opcodeMatch = code.match(opcodePattern);
    if (opcodeMatch) {
      result.detected = true;
      result.opcodes = new Map();
      try {
        const pairs = opcodeMatch[1].split(',');
        pairs.forEach(pair => {
          const [key, val] = pair.split('=').map(s => s.trim());
          if (key && val) {
            result.opcodes.set(parseInt(val), key);
          }
        });
      } catch {
        this.warnings.push('Failed to parse opcode mapping');
      }
    }
    
    // Pattern 3: Detect handler table
    const handlerPattern = /handlers?\s*=\s*{([^}]+)}/s;
    const handlerMatch = code.match(handlerPattern);
    if (handlerMatch) {
      result.detected = true;
      result.handlers = new Map();
      try {
        const handlers = handlerMatch[1].split('],');
        handlers.forEach((h, i) => {
          result.handlers.set(i, h.trim());
        });
      } catch {
        this.warnings.push('Failed to parse handler table');
      }
    }
    
    return result;
  }

  /**
   * PHASE 3: String Decryption
   */
  private async decryptAllStrings(code: string): Promise<{ code: string; count: number; map: Map<string, string> }> {
    let result = code;
    let count = 0;
    const stringMap = new Map<string, string>();
    
    // Pattern 1: XOR encrypted strings
    const xorPattern = /\(function\((\w+)\)local s='';for i=1,#\1 do s=s\.\.string\.char\(\1\[i\]~\((\d+)\+i-1\)\);end;return s;end\)\((\{[^}]+\})\)/g;
    result = result.replace(xorPattern, (match, varName, key, bytesStr) => {
      try {
        const keyNum = parseInt(key, 10);
        const bytes = JSON.parse(bytesStr.replace(/{/g, '[').replace(/}/g, ']'));
        const decrypted = bytes.map((b: number, i: number) => 
          String.fromCharCode(b ^ (keyNum + i))
        ).join('');
        stringMap.set(match, decrypted);
        count++;
        return `"${this.escapeString(decrypted)}"`;
      } catch {
        return match;
      }
    });
    
    // Pattern 2: Base64 strings
    const base64Pattern = /\(function\(\)local b='[^']*'local t='([^']*)'local r=''for i=1,#t,4 do[^}]+end return r end\)\(\)/g;
    result = result.replace(base64Pattern, (match, base64Str) => {
      try {
        const decoded = Buffer.from(base64Str, 'base64').toString();
        stringMap.set(match, decoded);
        count++;
        return `"${this.escapeString(decoded)}"`;
      } catch {
        return match;
      }
    });
    
    // Pattern 3: string.char arrays
    const charPattern = /string\.char\(([^)]+)\)/g;
    result = result.replace(charPattern, (match, args) => {
      try {
        const bytes = args.split(',').map((b: string) => parseInt(b.trim(), 10));
        const decoded = String.fromCharCode(...bytes);
        stringMap.set(match, decoded);
        count++;
        return `"${this.escapeString(decoded)}"`;
      } catch {
        return match;
      }
    });
    
    return { code: result, count, map: stringMap };
  }

  /**
   * PHASE 4: Bytecode Emulation
   */
  private async emulateBytecode(analysis: any): Promise<{ success: boolean; code: string }> {
    if (!analysis.bytecode || !analysis.opcodes) {
      return { success: false, code: '' };
    }
    
    const emulated: string[] = [];
    emulated.push('-- [[ VM Bytecode Emulation ]]');
    emulated.push('-- Decoded instructions:');
    
    for (let i = 0; i < analysis.bytecode.length; i++) {
      const byte = analysis.bytecode[i];
      const op = analysis.opcodes.get(byte) || `UNKNOWN_${byte}`;
      emulated.push(`-- [${i}] ${op} (0x${byte.toString(16)})`);
    }
    
    return { success: true, code: emulated.join('\n') };
  }

  /**
   * PHASE 5: Anti-Tamper Detection
   */
  private detectAntiTamper(code: string): AntiTamperInfo[] {
    const detections: AntiTamperInfo[] = [];
    let lineNum = 1;
    
    code.split('\n').forEach((line, index) => {
      // Integrity checks
      if (line.includes('hash') && line.includes('~=')) {
        detections.push({
          type: 'integrity',
          location: index + 1,
          bypassed: false
        });
      }
      
      // Environment checks
      if (line.includes('debug') && line.includes('getinfo')) {
        detections.push({
          type: 'debug',
          location: index + 1,
          bypassed: false
        });
      }
      
      // Timeout checks
      if (line.includes('os.clock') && line.includes('>')) {
        detections.push({
          type: 'timeout',
          location: index + 1,
          bypassed: false
        });
      }
      
      lineNum++;
    });
    
    return detections;
  }

  /**
   * Bypass anti-tamper mechanisms
   */
  private bypassAntiTamper(code: string, tamper: AntiTamperInfo[]): string {
    let result = code;
    
    tamper.forEach(t => {
      const lines = result.split('\n');
      if (lines[t.location - 1]) {
        // Comment out the check
        lines[t.location - 1] = '--[BYPASSED] ' + lines[t.location - 1];
        t.bypassed = true;
      }
      result = lines.join('\n');
    });
    
    return result;
  }

  /**
   * Reconstruct control flow
   */
  private reconstructControlFlow(code: string, flow: ControlFlowGraph): string {
    // This is complex - for now, add annotations
    const lines = code.split('\n');
    const annotated: string[] = [];
    
    flow.nodes.forEach(node => {
      if (node.line > 0 && node.line <= lines.length) {
        annotated.push(`-- [[ Node ${node.id}: ${node.type} ]]`);
        annotated.push(lines[node.line - 1]);
      }
    });
    
    return annotated.join('\n');
  }

  /**
   * Final beautification
   */
  private beautify(code: string): string {
    const lines = code.split('\n');
    let indentLevel = 0;
    const beautified: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      
      // Decrease indent for closing statements
      if (trimmed.match(/^(end|else|elseif|until)/)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      // Add line with proper indentation
      beautified.push('  '.repeat(indentLevel) + trimmed);
      
      // Increase indent for opening statements
      if (trimmed.match(/(function|if|for|while|repeat|do)\s*($|\(|then|do$)/) && 
          !trimmed.includes('end')) {
        indentLevel++;
      }
    }
    
    return beautified.join('\n');
  }

  /**
   * Escape string for safe output
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}
