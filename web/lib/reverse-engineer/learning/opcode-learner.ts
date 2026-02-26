// web/lib/reverse-engineer/learning/opcode-learner.ts

export interface OpcodeObservation {
  opcode: number;
  pc: number;
  stackBefore: any[];
  stackAfter: any[];
  registersBefore: Map<number, any>;
  registersAfter: Map<number, any>;
  memoryChanges: Map<string, any>;
  jumpTarget?: number;
  timestamp: number;
  context: ExecutionContext;
}

export interface ExecutionContext {
  function?: string;
  depth: number;
  environment: Map<string, any>;
  constants: any[];
}

export interface LearnedOpcode {
  opcode: number;
  behaviors: BehaviorSet;
  confidence: number;
  observations: number;
  stackDelta: number;
  registerChanges: Map<number, RegisterChangeType>;
  jumpType?: 'conditional' | 'unconditional' | 'call' | 'return';
  memoryAccess: boolean;
  constantAccess: boolean;
  sideEffects: string[];
  classification: OpcodeClassification;
}

export interface BehaviorSet {
  primary: string;
  secondary: string[];
  probability: Map<string, number>;
}

export type RegisterChangeType = 'read' | 'write' | 'modify' | 'copy';
export type OpcodeClassification = 'arithmetic' | 'stack' | 'control' | 'memory' | 'table' | 'function' | 'unknown';

export class OpcodeLearner {
  private observations: Map<number, OpcodeObservation[]> = new Map();
  private learned: Map<number, LearnedOpcode> = new Map();
  private contextHistory: ExecutionContext[] = [];

  /**
   * Observe opcode execution
   */
  observe(observation: OpcodeObservation): void {
    if (!this.observations.has(observation.opcode)) {
      this.observations.set(observation.opcode, []);
    }
    
    this.observations.get(observation.opcode)!.push(observation);
    this.contextHistory.push(observation.context);
    
    // Limit history size
    if (this.contextHistory.length > 1000) {
      this.contextHistory.shift();
    }
    
    // Analyze after enough observations
    if (this.observations.get(observation.opcode)!.length % 5 === 0) {
      this.analyzeOpcode(observation.opcode);
    }
  }

  /**
   * Analyze single opcode
   */
  private analyzeOpcode(opcode: number): void {
    const samples = this.observations.get(opcode);
    if (!samples || samples.length < 3) return;

    const behaviors = this.inferBehaviors(samples);
    const stackDelta = this.calculateStackDelta(samples);
    const registerChanges = this.analyzeRegisterChanges(samples);
    const jumpType = this.detectJumpType(samples);
    const classification = this.classifyOpcode(behaviors, stackDelta, jumpType);
    
    const confidence = Math.min(samples.length / 50, 1.0);
    
    this.learned.set(opcode, {
      opcode,
      behaviors,
      confidence,
      observations: samples.length,
      stackDelta,
      registerChanges,
      jumpType,
      memoryAccess: this.detectMemoryAccess(samples),
      constantAccess: this.detectConstantAccess(samples),
      sideEffects: this.detectSideEffects(samples),
      classification
    });
  }

  /**
   * Infer behaviors from observations
   */
  private inferBehaviors(samples: OpcodeObservation[]): BehaviorSet {
    const probabilities = new Map<string, number>();
    const total = samples.length;
    
    samples.forEach(sample => {
      const behaviors = this.getSampleBehaviors(sample);
      behaviors.forEach(behavior => {
        probabilities.set(behavior, (probabilities.get(behavior) || 0) + 1);
      });
    });
    
    // Convert to probabilities
    probabilities.forEach((count, behavior) => {
      probabilities.set(behavior, count / total);
    });
    
    // Find primary behavior (highest probability)
    let primary = 'unknown';
    let maxProb = 0;
    probabilities.forEach((prob, behavior) => {
      if (prob > maxProb) {
        maxProb = prob;
        primary = behavior;
      }
    });
    
    // Secondary behaviors (prob > 0.3 but not primary)
    const secondary: string[] = [];
    probabilities.forEach((prob, behavior) => {
      if (prob > 0.3 && behavior !== primary) {
        secondary.push(behavior);
      }
    });
    
    return {
      primary,
      secondary,
      probability: probabilities
    };
  }

  /**
   * Get behaviors for a single sample
   */
  private getSampleBehaviors(sample: OpcodeObservation): string[] {
    const behaviors: string[] = [];
    
    // Stack behavior
    if (sample.stackBefore.length !== sample.stackAfter.length) {
      behaviors.push('stack-modify');
    }
    
    // Register behavior
    sample.registersAfter.forEach((value, key) => {
      const before = sample.registersBefore.get(key);
      if (before !== value) {
        behaviors.push('register-write');
      }
    });
    
    // Control flow
    if (sample.jumpTarget && sample.jumpTarget !== sample.pc + 1) {
      behaviors.push('control-flow');
    }
    
    // Memory access
    if (sample.memoryChanges.size > 0) {
      behaviors.push('memory-access');
    }
    
    // Arithmetic (check for numeric changes)
    const hasNumericChange = this.hasNumericChange(sample);
    if (hasNumericChange) {
      behaviors.push('arithmetic');
    }
    
    return behaviors;
  }

  /**
   * Check for numeric changes
   */
  private hasNumericChange(sample: OpcodeObservation): boolean {
    let changed = false;
    
    sample.registersAfter.forEach((value, key) => {
      const before = sample.registersBefore.get(key);
      if (typeof before === 'number' && typeof value === 'number' && before !== value) {
        changed = true;
      }
    });
    
    return changed;
  }

  /**
   * Calculate stack delta
   */
  private calculateStackDelta(samples: OpcodeObservation[]): number {
    const deltas = samples.map(s => s.stackAfter.length - s.stackBefore.length);
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    return Math.round(avg);
  }

  /**
   * Analyze register changes
   */
  private analyzeRegisterChanges(samples: OpcodeObservation[]): Map<number, RegisterChangeType> {
    const changes = new Map<number, RegisterChangeType>();
    const readCount = new Map<number, number>();
    const writeCount = new Map<number, number>();
    
    samples.forEach(sample => {
      sample.registersAfter.forEach((value, key) => {
        const before = sample.registersBefore.get(key);
        if (before === undefined && value !== undefined) {
          // First write
          writeCount.set(key, (writeCount.get(key) || 0) + 1);
        } else if (before !== value) {
          // Modified
          writeCount.set(key, (writeCount.get(key) || 0) + 1);
        } else {
          // Read
          readCount.set(key, (readCount.get(key) || 0) + 1);
        }
      });
    });
    
    // Determine change type based on read/write ratio
    readCount.forEach((reads, reg) => {
      const writes = writeCount.get(reg) || 0;
      if (writes > reads * 2) {
        changes.set(reg, 'write');
      } else if (reads > writes * 2) {
        changes.set(reg, 'read');
      } else if (writes > 0) {
        changes.set(reg, 'modify');
      }
    });
    
    return changes;
  }

  /**
   * Detect jump type
   */
  private detectJumpType(samples: OpcodeObservation[]): 'conditional' | 'unconditional' | 'call' | 'return' | undefined {
    const jumps = samples.filter(s => s.jumpTarget !== undefined);
    if (jumps.length === 0) return undefined;
    
    // Check if always jumps
    if (jumps.length === samples.length) {
      return 'unconditional';
    }
    
    // Check if sometimes jumps
    if (jumps.length > 0 && jumps.length < samples.length) {
      return 'conditional';
    }
    
    return undefined;
  }

  /**
   * Detect memory access
   */
  private detectMemoryAccess(samples: OpcodeObservation[]): boolean {
    return samples.some(s => s.memoryChanges.size > 0);
  }

  /**
   * Detect constant access
   */
  private detectConstantAccess(samples: OpcodeObservation[]): boolean {
    return samples.some(s => s.context.constants.some(c => c !== undefined));
  }

  /**
   * Detect side effects
   */
  private detectSideEffects(samples: OpcodeObservation[]): string[] {
    const effects = new Set<string>();
    
    samples.forEach(sample => {
      if (sample.memoryChanges.size > 0) {
        effects.add('memory-write');
      }
      if (sample.jumpTarget) {
        effects.add('control-flow');
      }
      if (sample.stackAfter.length !== sample.stackBefore.length) {
        effects.add('stack-modify');
      }
    });
    
    return Array.from(effects);
  }

  /**
   * Classify opcode
   */
  private classifyOpcode(behaviors: BehaviorSet, stackDelta: number, jumpType?: string): OpcodeClassification {
    if (behaviors.primary === 'arithmetic') {
      return 'arithmetic';
    }
    if (behaviors.primary === 'stack-modify' && Math.abs(stackDelta) > 0) {
      return 'stack';
    }
    if (jumpType) {
      return 'control';
    }
    if (behaviors.primary === 'memory-access') {
      return 'memory';
    }
    
    return 'unknown';
  }

  /**
   * Get learned opcode
   */
  getLearned(opcode: number): LearnedOpcode | undefined {
    return this.learned.get(opcode);
  }

  /**
   * Get all learned opcodes
   */
  getAllLearned(): Map<number, LearnedOpcode> {
    return new Map(this.learned);
  }

  /**
   * Find opcodes by behavior
   */
  findOpcodesByBehavior(behavior: string): number[] {
    const results: number[] = [];
    
    this.learned.forEach((info, opcode) => {
      if (info.behaviors.primary === behavior || info.behaviors.secondary.includes(behavior)) {
        results.push(opcode);
      }
    });
    
    return results;
  }

  /**
   * Get learning statistics
   */
  getStats(): {
    totalOpcodes: number;
    avgConfidence: number;
    classificationDistribution: Map<OpcodeClassification, number>;
  } {
    const distribution = new Map<OpcodeClassification, number>();
    let totalConfidence = 0;
    
    this.learned.forEach(info => {
      distribution.set(info.classification, (distribution.get(info.classification) || 0) + 1);
      totalConfidence += info.confidence;
    });
    
    return {
      totalOpcodes: this.learned.size,
      avgConfidence: this.learned.size > 0 ? totalConfidence / this.learned.size : 0,
      classificationDistribution: distribution
    };
  }
}
