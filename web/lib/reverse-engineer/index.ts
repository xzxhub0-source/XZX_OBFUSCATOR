// web/lib/reverse-engineer/index.ts
// Professional Reverse Engineering Toolkit

import * as luaparse from 'luaparse';

export interface REOptions {
  verbose?: boolean;
  outputFormat?: 'json' | 'yaml' | 'table';
  includeMetadata?: boolean;
  maxDepth?: number;
  timeout?: number;
}

export interface REAnalysis {
  success: boolean;
  data?: any;
  error?: string;
  metrics?: {
    duration: number;
    functions: number;
    strings: number;
    globals: number;
    complexity: number;
  };
}

// ============================================
// LUA DECOMPILER / ANALYZER
// ============================================

interface FunctionInfo {
  name: string;
  params: string[];
  lines: { start: number; end: number };
  complexity: number;
  code?: string;
}

interface InstructionInfo {
  index: number;
  opcode: number;
  decoded: string;
}

interface HandlerInfo {
  index: number;
  code: string;
}

interface CFNode {
  id: number;
  type: string;
  line: number;
}

interface CFEdge {
  from: number;
  to: number;
  type: string;
}

export class LuaDecompiler {
  private ast: any;
  private functions: Map<string, FunctionInfo> = new Map();
  private strings: Set<string> = new Set();
  private globals: Set<string> = new Set();
  private complexity: number = 0;

  analyze(code: string): REAnalysis {
    const startTime = Date.now();
    
    try {
      // Parse AST
      this.ast = luaparse.parse(code, {
        comments: true,
        locations: true,
        ranges: true
      });

      // Walk AST
      this.walkAST(this.ast);

      // Extract metadata
      const functions = Array.from(this.functions.values());
      const strings = Array.from(this.strings);
      const globals = Array.from(this.globals);

      return {
        success: true,
        data: {
          functions,
          strings,
          globals,
          ast: this.ast
        },
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: functions.length,
          strings: strings.length,
          globals: globals.length,
          complexity: this.complexity
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: 0,
          globals: 0,
          complexity: 0
        }
      };
    }
  }

  private walkAST(node: any, depth: number = 0) {
    if (!node || depth > 100) return;

    this.complexity++;

    switch (node.type) {
      case 'FunctionDeclaration':
      case 'LocalFunction':
        this.analyzeFunction(node);
        break;

      case 'StringLiteral':
        if (node.value && node.value.length > 3) {
          this.strings.add(node.value);
        }
        break;

      case 'Identifier':
        if (node.name && !node.name.startsWith('_')) {
          this.globals.add(node.name);
        }
        break;

      case 'CallExpression':
        this.analyzeCall(node);
        break;
    }

    // Recursively walk children
    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach((item: any) => this.walkAST(item, depth + 1));
        } else if (child && typeof child === 'object') {
          this.walkAST(child, depth + 1);
        }
      }
    }
  }

  private analyzeFunction(node: any) {
    const info: FunctionInfo = {
      name: node.identifier?.name || 'anonymous',
      params: node.parameters?.map((p: any) => p.name) || [],
      lines: this.getFunctionLines(node),
      complexity: this.calculateFunctionComplexity(node),
      code: this.extractFunctionCode(node)
    };
    
    this.functions.set(info.name, info);
  }

  private analyzeCall(node: any) {
    if (node.base?.type === 'Identifier') {
      this.globals.add(node.base.name);
    }
  }

  private getFunctionLines(node: any): { start: number; end: number } {
    return {
      start: node.loc?.start?.line || 0,
      end: node.loc?.end?.line || 0
    };
  }

  private extractFunctionCode(node: any): string {
    // Simple code extraction - in a real tool you'd want better formatting
    return JSON.stringify(node.body);
  }

  private calculateFunctionComplexity(node: any): number {
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
}

// ============================================
// VM BYTECODE ANALYZER
// ============================================

export class VMAnalyzer {
  private instructions: Map<number, InstructionInfo> = new Map();
  private handlers: Map<number, HandlerInfo> = new Map();
  private constants: any[] = [];

  analyze(vmCode: string): REAnalysis {
    const startTime = Date.now();

    try {
      // Extract VM components
      this.extractBytecode(vmCode);
      this.extractConstants(vmCode);
      this.extractHandlers(vmCode);

      return {
        success: true,
        data: {
          instructions: Array.from(this.instructions.values()),
          handlers: Array.from(this.handlers.values()),
          constants: this.constants
        },
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: this.handlers.size,
          strings: this.constants.filter(c => typeof c === 'string').length,
          globals: 0,
          complexity: this.instructions.size
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: 0,
          globals: 0,
          complexity: 0
        }
      };
    }
  }

  private extractBytecode(code: string) {
    // Extract bytecode array
    const bytecodeMatch = code.match(/bytecode\s*=\s*{([^}]+)}/);
    if (bytecodeMatch) {
      const bytes = bytecodeMatch[1].split(',').map(b => parseInt(b.trim()));
      bytes.forEach((byte, i) => {
        this.instructions.set(i, {
          index: i,
          opcode: byte,
          decoded: this.decodeOpcode(byte)
        });
      });
    }
  }

  private extractConstants(code: string) {
    // Extract constants
    const constantsMatch = code.match(/constants\s*=\s*{([^}]+)}/);
    if (constantsMatch) {
      try {
        this.constants = JSON.parse(`[${constantsMatch[1]}]`);
      } catch {
        // Fallback to string extraction
        const constStr = constantsMatch[1];
        const matches = constStr.match(/"([^"]*)"/g);
        if (matches) {
          this.constants = matches.map(m => m.slice(1, -1));
        }
      }
    }
  }

  private extractHandlers(code: string) {
    // Extract handler functions
    const handlerMatches = code.match(/handlers\s*=\s*{([^}]+)}/s);
    if (handlerMatches) {
      const handlers = handlerMatches[1].split('],');
      handlers.forEach((handler, i) => {
        this.handlers.set(i, {
          index: i,
          code: handler.trim()
        });
      });
    }
  }

  private decodeOpcode(opcode: number): string {
    const opNames: { [key: number]: string } = {
      0: 'NOP', 1: 'MOV', 2: 'ADD', 3: 'SUB', 4: 'MUL',
      5: 'DIV', 6: 'JMP', 7: 'JIF', 8: 'CALL', 9: 'RET',
      10: 'LOADK', 11: 'GETGLOBAL', 12: 'SETGLOBAL'
    };
    return opNames[opcode] || `UNKNOWN_${opcode}`;
  }
}

// ============================================
// STRING DECRYPTOR
// ============================================

export class StringDecryptor {
  private patterns: RegExp[] = [
    /string\.char\(([^)]+)\)/g,
    /\(function\((\w+)\)local s='';for i=1,#\1 do s=s\.\.string\.char\(\1\[i\]~(\d+)\);end;return s;end\)\((\{[^}]+\})\)/g,
    /"([^"\\]*(\\.[^"\\]*)*)"/g
  ];

  decrypt(obfuscated: string): REAnalysis {
    const startTime = Date.now();
    const decrypted: string[] = [];
    const matches: string[] = [];

    try {
      // Find all encoded strings
      for (const pattern of this.patterns) {
        const found = obfuscated.matchAll(pattern);
        for (const match of found) {
          matches.push(match[0]);
          
          // Attempt to decrypt
          if (match[0].startsWith('string.char')) {
            const bytes = match[1].split(',').map(b => parseInt(b.trim()));
            decrypted.push(String.fromCharCode(...bytes));
          } else if (match[0].includes('function(')) {
            // XOR decryption
            const key = parseInt(match[2]);
            const bytes = JSON.parse(match[3].replace(/{/g, '[').replace(/}/g, ']'));
            const result = bytes.map((b: number) => String.fromCharCode(b ^ key)).join('');
            decrypted.push(result);
          } else {
            // Plain string
            decrypted.push(match[1]);
          }
        }
      }

      return {
        success: true,
        data: {
          matches,
          decrypted
        },
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: decrypted.length,
          globals: 0,
          complexity: matches.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: 0,
          globals: 0,
          complexity: 0
        }
      };
    }
  }
}

// ============================================
// CONTROL FLOW VISUALIZER
// ============================================

export class ControlFlowVisualizer {
  private nodes: Map<number, CFNode> = new Map();
  private edges: CFEdge[] = [];

  analyze(code: string): REAnalysis {
    const startTime = Date.now();

    try {
      const ast = luaparse.parse(code);
      this.walkAST(ast);

      return {
        success: true,
        data: {
          nodes: Array.from(this.nodes.values()),
          edges: this.edges
        },
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: this.nodes.size,
          strings: 0,
          globals: 0,
          complexity: this.edges.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: 0,
          globals: 0,
          complexity: 0
        }
      };
    }
  }

  private walkAST(node: any, parentId?: number) {
    if (!node) return;

    const nodeId = this.nodes.size;
    this.nodes.set(nodeId, {
      id: nodeId,
      type: node.type,
      line: node.loc?.start?.line || 0
    });

    if (parentId !== undefined) {
      this.edges.push({
        from: parentId,
        to: nodeId,
        type: 'contains'
      });
    }

    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach((item: any) => this.walkAST(item, nodeId));
        } else if (child && typeof child === 'object') {
          this.walkAST(child, nodeId);
        }
      }
    }
  }

  generateMermaid(): string {
    let mermaid = 'graph TD;\n';
    
    this.nodes.forEach((node) => {
      mermaid += `  node${node.id}["${node.type} (line ${node.line})"];\n`;
    });
    
    this.edges.forEach((edge) => {
      mermaid += `  node${edge.from} --> node${edge.to};\n`;
    });
    
    return mermaid;
  }
}

// ============================================
// METADATA EXTRACTOR
// ============================================

export class MetadataExtractor {
  extract(code: string): REAnalysis {
    const startTime = Date.now();
    const metadata: any = {};

    try {
      // Extract build ID
      const buildMatch = code.match(/Build:?\s*([^\n]+)/i);
      if (buildMatch) metadata.buildId = buildMatch[1].trim();

      // Extract version
      const versionMatch = code.match(/version:?\s*([^\n]+)/i);
      if (versionMatch) metadata.version = versionMatch[1].trim();

      // Extract layers
      const layersMatch = code.match(/layers:?\s*([^\n]+)/i);
      if (layersMatch) {
        metadata.layers = layersMatch[1].split(',').map((l: string) => l.trim());
      }

      // Extract timestamps
      const timeMatch = code.match(/time:?\s*(\d+)/i);
      if (timeMatch) metadata.timestamp = parseInt(timeMatch[1]);

      return {
        success: true,
        data: metadata,
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: 0,
          globals: 0,
          complexity: Object.keys(metadata).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: 0,
          globals: 0,
          complexity: 0
        }
      };
    }
  }
}

// ============================================
// MAIN REVERSE ENGINEER
// ============================================

export class XZXReverseEngineer {
  private decompiler: LuaDecompiler;
  private vmAnalyzer: VMAnalyzer;
  private stringDecryptor: StringDecryptor;
  private flowVisualizer: ControlFlowVisualizer;
  private metadataExtractor: MetadataExtractor;

  constructor() {
    this.decompiler = new LuaDecompiler();
    this.vmAnalyzer = new VMAnalyzer();
    this.stringDecryptor = new StringDecryptor();
    this.flowVisualizer = new ControlFlowVisualizer();
    this.metadataExtractor = new MetadataExtractor();
  }

  analyze(code: string, options: REOptions = {}): REAnalysis {
    const startTime = Date.now();
    const results: any = {};

    try {
      // Run all analyzers
      results.decompiled = this.decompiler.analyze(code);
      results.vm = this.vmAnalyzer.analyze(code);
      results.strings = this.stringDecryptor.decrypt(code);
      results.flow = this.flowVisualizer.analyze(code);
      results.metadata = this.metadataExtractor.extract(code);

      // Calculate overall metrics
      const totalMetrics = {
        duration: (Date.now() - startTime) / 1000,
        functions: results.decompiled.metrics?.functions || 0,
        strings: results.strings.metrics?.strings || 0,
        globals: results.decompiled.metrics?.globals || 0,
        complexity: results.flow.metrics?.complexity || 0
      };

      return {
        success: true,
        data: results,
        metrics: totalMetrics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: (Date.now() - startTime) / 1000,
          functions: 0,
          strings: 0,
          globals: 0,
          complexity: 0
        }
      };
    }
  }

  // Specialized analysis methods
  extractStrings(code: string): string[] {
    const result = this.stringDecryptor.decrypt(code);
    return result.data?.decrypted || [];
  }

  extractFunctions(code: string): FunctionInfo[] {
    const result = this.decompiler.analyze(code);
    return result.data?.functions || [];
  }

  extractBytecode(code: string): InstructionInfo[] {
    const result = this.vmAnalyzer.analyze(code);
    return result.data?.instructions || [];
  }

  visualizeControlFlow(code: string): string {
    const result = this.flowVisualizer.analyze(code);
    return this.flowVisualizer.generateMermaid();
  }
}

// ============================================
// EXPORT
// ============================================

export default XZXReverseEngineer;
