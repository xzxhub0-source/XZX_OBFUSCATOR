// web/lib/reverse-engineer/reconstruction/control-flow.ts

export interface BasicBlock {
  id: number;
  start: number;
  end: number;
  instructions: number[];
  successors: number[];
  predecessors: number[];
  type: 'entry' | 'exit' | 'loop' | 'branch' | 'normal';
  jumpTarget?: number;
  condition?: string;
}

export interface ControlFlowGraph {
  blocks: BasicBlock[];
  entryBlock: number;
  exitBlocks: number[];
  loops: LoopInfo[];
  dominators: Map<number, number[]>;
}

export interface LoopInfo {
  header: number;
  body: number[];
  backEdges: Array<[number, number]>;
  nestingDepth: number;
}

export class ControlFlowReconstructor {
  private blocks: Map<number, BasicBlock> = new Map();
  private nextBlockId: number = 0;

  /**
   * Reconstruct control flow from bytecode
   */
  reconstruct(bytecode: number[], traces?: any[]): ControlFlowGraph {
    this.identifyBasicBlocks(bytecode, traces);
    this.buildEdges(bytecode);
    const loops = this.detectLoops();
    const dominators = this.computeDominators();
    
    return {
      blocks: Array.from(this.blocks.values()),
      entryBlock: 0,
      exitBlocks: this.findExitBlocks(),
      loops,
      dominators
    };
  }

  /**
   * Identify basic blocks
   */
  private identifyBasicBlocks(bytecode: number[], traces?: any[]): void {
    const blockStarts = new Set<number>([0]);
    
    // Find all jump targets
    for (let i = 0; i < bytecode.length; i++) {
      if (this.isJump(bytecode[i])) {
        if (i + 1 < bytecode.length) {
          blockStarts.add(bytecode[i + 1]);
          blockStarts.add(i + 2); // Next instruction after jump
        }
      }
    }
    
    // Add trace-based block starts if available
    if (traces) {
      traces.forEach(trace => {
        if (trace.jumpTarget) {
          blockStarts.add(trace.jumpTarget);
        }
      });
    }
    
    // Create blocks
    const sortedStarts = Array.from(blockStarts).sort((a, b) => a - b);
    
    for (let i = 0; i < sortedStarts.length; i++) {
      const start = sortedStarts[i];
      const end = i < sortedStarts.length - 1 ? sortedStarts[i + 1] - 1 : bytecode.length - 1;
      
      const block: BasicBlock = {
        id: this.nextBlockId++,
        start,
        end,
        instructions: bytecode.slice(start, end + 1),
        successors: [],
        predecessors: [],
        type: this.determineBlockType(bytecode, start, end)
      };
      
      this.blocks.set(block.id, block);
    }
  }

  /**
   * Build edges between blocks
   */
  private buildEdges(bytecode: number[]): void {
    this.blocks.forEach(block => {
      const lastInstruction = bytecode[block.end];
      const lastPc = block.end;
      
      if (this.isConditionalJump(lastInstruction)) {
        // Conditional jump has two successors
        const target = bytecode[lastPc + 1];
        const targetBlock = this.findBlockByPc(target);
        const nextBlock = this.findBlockByPc(lastPc + 2);
        
        if (targetBlock) {
          block.successors.push(targetBlock.id);
          targetBlock.predecessors.push(block.id);
          block.jumpTarget = target;
        }
        if (nextBlock) {
          block.successors.push(nextBlock.id);
          nextBlock.predecessors.push(block.id);
        }
        
      } else if (this.isUnconditionalJump(lastInstruction)) {
        // Unconditional jump has one successor
        const target = bytecode[lastPc + 1];
        const targetBlock = this.findBlockByPc(target);
        
        if (targetBlock) {
          block.successors.push(targetBlock.id);
          targetBlock.predecessors.push(block.id);
          block.jumpTarget = target;
        }
        
      } else if (lastInstruction === 9) { // RET
        // Return has no successors
        block.type = 'exit';
        
      } else {
        // Fall through to next block
        const nextBlock = this.findBlockByPc(block.end + 1);
        if (nextBlock) {
          block.successors.push(nextBlock.id);
          nextBlock.predecessors.push(block.id);
        }
      }
    });
  }

  /**
   * Find block by PC
   */
  private findBlockByPc(pc: number): BasicBlock | undefined {
    for (const block of this.blocks.values()) {
      if (pc >= block.start && pc <= block.end) {
        return block;
      }
    }
    return undefined;
  }

  /**
   * Determine block type
   */
  private determineBlockType(bytecode: number[], start: number, end: number): BasicBlock['type'] {
    // Check if entry (first block)
    if (start === 0) return 'entry';
    
    // Check for loop pattern
    for (let i = start; i <= end; i++) {
      if (this.isJump(bytecode[i]) && bytecode[i + 1] < start) {
        return 'loop';
      }
    }
    
    // Check for branch pattern
    for (let i = start; i <= end; i++) {
      if (this.isConditionalJump(bytecode[i])) {
        return 'branch';
      }
    }
    
    return 'normal';
  }

  /**
   * Detect loops
   */
  private detectLoops(): LoopInfo[] {
    const loops: LoopInfo[] = [];
    
    this.blocks.forEach(block => {
      // Check for back edges
      block.successors.forEach(succId => {
        const succ = this.blocks.get(succId);
        if (succ && succ.start < block.start) {
          // Found a back edge - potential loop
          const loopBody = this.findLoopBody(block.id, succId);
          loops.push({
            header: succId,
            body: loopBody,
            backEdges: [[block.id, succId]],
            nestingDepth: this.calculateNestingDepth(loopBody)
          });
        }
      });
    });
    
    return loops;
  }

  /**
   * Find loop body
   */
  private findLoopBody(header: number, backTarget: number): number[] {
    const body: number[] = [];
    const visited = new Set<number>();
    const stack = [header];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      
      const block = this.blocks.get(current);
      if (block) {
        body.push(current);
        block.successors.forEach(succ => {
          if (succ !== backTarget && !visited.has(succ)) {
            stack.push(succ);
          }
        });
      }
    }
    
    return body;
  }

  /**
   * Calculate nesting depth
   */
  private calculateNestingDepth(loopBody: number[]): number {
    // Simple depth calculation - could be more sophisticated
    return 1;
  }

  /**
   * Compute dominators
   */
  private computeDominators(): Map<number, number[]> {
    const dominators = new Map<number, number[]>();
    const blocks = Array.from(this.blocks.keys());
    
    // Initialize
    blocks.forEach(block => {
      dominators.set(block, []);
    });
    
    // Simple dominance calculation
    blocks.forEach(block => {
      const blockObj = this.blocks.get(block)!;
      blockObj.predecessors.forEach(pred => {
        if (!dominators.get(block)!.includes(pred)) {
          dominators.get(block)!.push(pred);
        }
      });
    });
    
    return dominators;
  }

  /**
   * Find exit blocks
   */
  private findExitBlocks(): number[] {
    const exits: number[] = [];
    
    this.blocks.forEach(block => {
      if (block.type === 'exit' || block.successors.length === 0) {
        exits.push(block.id);
      }
    });
    
    return exits;
  }

  /**
   * Check if opcode is a jump
   */
  private isJump(opcode: number): boolean {
    return opcode === 7 || opcode === 8; // JMP or CALL
  }

  /**
   * Check if opcode is conditional jump
   */
  private isConditionalJump(opcode: number): boolean {
    return opcode === 7; // JMP with condition
  }

  /**
   * Check if opcode is unconditional jump
   */
  private isUnconditionalJump(opcode: number): boolean {
    return opcode === 8; // CALL
  }

  /**
   * Generate Mermaid flowchart
   */
  generateMermaid(): string {
    let mermaid = 'graph TD;\n';
    
    this.blocks.forEach(block => {
      const label = `Block_${block.id}`;
      const title = `${block.type} (${block.start}-${block.end})`;
      mermaid += `  ${label}["${title}"];\n`;
    });
    
    this.blocks.forEach(block => {
      block.successors.forEach(succId => {
        mermaid += `  Block_${block.id} --> Block_${succId}`;
        if (block.jumpTarget === this.blocks.get(succId)?.start) {
          mermaid += ';\n';
        } else {
          mermaid += ';\n';
        }
      });
    });
    
    return mermaid;
  }
}
