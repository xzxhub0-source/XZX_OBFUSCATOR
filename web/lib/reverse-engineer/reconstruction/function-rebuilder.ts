// web/lib/reverse-engineer/reconstruction/function-rebuilder.ts

export interface ReconstructedFunction {
  id: number;
  name: string;
  parameters: string[];
  upvalues: string[];
  body: string;
  bytecode: number[];
  blocks: BasicBlock[];
  complexity: number;
  captured: boolean;
  lineStart: number;
  lineEnd: number;
  calls: number[];
  calledBy: number[];
}

export class FunctionRebuilder {
  private functions: Map<number, ReconstructedFunction> = new Map();
  private nextFuncId: number = 0;

  /**
   * Rebuild functions from bytecode and control flow
   */
  rebuild(bytecode: number[], flow: ControlFlowGraph): ReconstructedFunction[] {
    // Detect function boundaries
    const boundaries = this.detectFunctionBoundaries(bytecode, flow);
    
    // Rebuild each function
    boundaries.forEach((boundary, index) => {
      const func = this.rebuildFunction(index, boundary, bytecode, flow);
      this.functions.set(func.id, func);
    });
    
    // Build call graph
    this.buildCallGraph();
    
    return Array.from(this.functions.values());
  }

  /**
   * Detect function boundaries
   */
  private detectFunctionBoundaries(bytecode: number[], flow: ControlFlowGraph): Array<{start: number, end: number}> {
    const boundaries: Array<{start: number, end: number}> = [];
    
    // Look for function prologues
    for (let i = 0; i < bytecode.length - 5; i++) {
      if (this.isFunctionPrologue(bytecode, i)) {
        const end = this.findFunctionEnd(i, bytecode, flow);
        boundaries.push({ start: i, end });
      }
    }
    
    return boundaries;
  }

  /**
   * Check if instruction sequence is function prologue
   */
  private isFunctionPrologue(bytecode: number[], pc: number): boolean {
    // Common prologue patterns
    const patterns = [
      [10, 1, 1], // CLOSURE, LOADK, LOADK
      [1, 1, 10], // LOADK, LOADK, CLOSURE
      [10, 2, 2], // CLOSURE, MOV, MOV
      [2, 10, 1]  // MOV, CLOSURE, LOADK
    ];
    
    for (const pattern of patterns) {
      let match = true;
      for (let i = 0; i < pattern.length; i++) {
        if (bytecode[pc + i] !== pattern[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    
    return false;
  }

  /**
   * Find function end
   */
  private findFunctionEnd(start: number, bytecode: number[], flow: ControlFlowGraph): number {
    // Find matching RET instruction
    for (let i = start + 1; i < bytecode.length; i++) {
      if (bytecode[i] === 9) { // RET
        // Check if this RET belongs to the function
        const block = flow.blocks.find(b => b.start <= i && b.end >= i);
        if (block && block.type === 'exit') {
          return i;
        }
      }
    }
    
    return start + 100; // Fallback
  }

  /**
   * Rebuild single function
   */
  private rebuildFunction(
    id: number,
    boundary: {start: number, end: number},
    bytecode: number[],
    flow: ControlFlowGraph
  ): ReconstructedFunction {
    const paramCount = this.extractParamCount(bytecode, boundary.start);
    const upvalues = this.extractUpvalues(bytecode, boundary.start);
    
    // Get function blocks
    const functionBlocks = flow.blocks.filter(b => 
      b.start >= boundary.start && b.end <= boundary.end
    );
    
    // Generate function body
    const body = this.generateFunctionBody(functionBlocks, bytecode);
    
    return {
      id,
      name: `func_${id}`,
      parameters: Array(paramCount).fill(0).map((_, i) => `arg${i}`),
      upvalues,
      body,
      bytecode: bytecode.slice(boundary.start, boundary.end + 1),
      blocks: functionBlocks,
      complexity: this.calculateComplexity(functionBlocks),
      captured: upvalues.length > 0,
      lineStart: boundary.start,
      lineEnd: boundary.end,
      calls: [],
      calledBy: []
    };
  }

  /**
   * Extract parameter count
   */
  private extractParamCount(bytecode: number[], start: number): number {
    // Parse from function prologue
    for (let i = start; i < start + 10; i++) {
      if (bytecode[i] === 2) { // MOV often used for params
        return bytecode[i + 2] || 0;
      }
    }
    return 0;
  }

  /**
   * Extract upvalues
   */
  private extractUpvalues(bytecode: number[], start: number): string[] {
    const upvalues: string[] = [];
    
    for (let i = start; i < start + 20; i++) {
      if (bytecode[i] === 11) { // GETUPVAL
        const idx = bytecode[i + 2];
        upvalues.push(`upvalue_${idx}`);
      }
    }
    
    return upvalues;
  }

  /**
   * Generate function body
   */
  private generateFunctionBody(blocks: BasicBlock[], bytecode: number[]): string {
    let body = '';
    
    blocks.forEach(block => {
      body += `-- Block ${block.id}\n`;
      
      for (let i = block.start; i <= block.end; i++) {
        body += this.decodeInstruction(bytecode[i], bytecode, i);
      }
      
      body += '\n';
    });
    
    return body;
  }

  /**
   * Decode instruction
   */
  private decodeInstruction(op: number, bytecode: number[], pc: number): string {
    const opNames: { [key: number]: string } = {
      1: 'LOADK',
      2: 'MOV',
      3: 'ADD',
      4: 'SUB',
      5: 'MUL',
      6: 'DIV',
      7: 'JMP',
      8: 'CALL',
      9: 'RET',
      10: 'CLOSURE',
      11: 'GETUPVAL',
      12: 'SETUPVAL',
      13: 'GETTABLE',
      14: 'SETTABLE'
    };
    
    const name = opNames[op] || `UNKNOWN_${op}`;
    
    switch (op) {
      case 1: // LOADK
        return `  [${pc}] ${name} R${bytecode[pc+1]} K${bytecode[pc+2]}\n`;
      case 2: // MOV
        return `  [${pc}] ${name} R${bytecode[pc+1]} R${bytecode[pc+2]}\n`;
      case 3: // ADD
      case 4: // SUB
      case 5: // MUL
      case 6: // DIV
        return `  [${pc}] ${name} R${bytecode[pc+1]} R${bytecode[pc+2]} R${bytecode[pc+3]}\n`;
      case 7: // JMP
        return `  [${pc}] ${name} ${bytecode[pc+1]}\n`;
      case 8: // CALL
        return `  [${pc}] ${name} R${bytecode[pc+1]} ${bytecode[pc+2]}\n`;
      case 9: // RET
        return `  [${pc}] ${name} R${bytecode[pc+1]}\n`;
      case 10: // CLOSURE
        return `  [${pc}] ${name} R${bytecode[pc+1]} ${bytecode[pc+2]}\n`;
      default:
        return `  [${pc}] ${name}\n`;
    }
  }

  /**
   * Calculate function complexity
   */
  private calculateComplexity(blocks: BasicBlock[]): number {
    let complexity = 1;
    
    blocks.forEach(block => {
      if (block.type === 'loop') complexity += 2;
      if (block.type === 'branch') complexity += 1;
    });
    
    return complexity;
  }

  /**
   * Build call graph
   */
  private buildCallGraph(): void {
    const callMap = new Map<number, Set<number>>();
    const calledByMap = new Map<number, Set<number>>();
    
    this.functions.forEach(func => {
      callMap.set(func.id, new Set());
      calledByMap.set(func.id, new Set());
    });
    
    this.functions.forEach(func => {
      func.blocks.forEach(block => {
        for (let i = block.start; i <= block.end; i++) {
          if (func.bytecode[i - func.lineStart] === 8) { // CALL
            // Find called function (simplified)
            const target = this.findCalledFunction(i, func.bytecode);
            if (target !== undefined) {
              callMap.get(func.id)!.add(target);
              calledByMap.get(target)!.add(func.id);
            }
          }
        }
      });
    });
    
    // Update functions
    this.functions.forEach(func => {
      func.calls = Array.from(callMap.get(func.id) || []);
      func.calledBy = Array.from(calledByMap.get(func.id) || []);
    });
  }

  /**
   * Find called function
   */
  private findCalledFunction(pc: number, bytecode: number[]): number | undefined {
    // Simplified - would need proper analysis
    return undefined;
  }

  /**
   * Get all functions
   */
  getAllFunctions(): ReconstructedFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * Get function by ID
   */
  getFunction(id: number): ReconstructedFunction | undefined {
    return this.functions.get(id);
  }

  /**
   * Get function statistics
   */
  getStats(): {
    totalFunctions: number;
    avgComplexity: number;
    maxComplexity: number;
  } {
    let totalComplexity = 0;
    let maxComplexity = 0;
    
    this.functions.forEach(func => {
      totalComplexity += func.complexity;
      maxComplexity = Math.max(maxComplexity, func.complexity);
    });
    
    return {
      totalFunctions: this.functions.size,
      avgComplexity: this.functions.size > 0 ? totalComplexity / this.functions.size : 0,
      maxComplexity
    };
  }
}
