// web/lib/reverse-engineer/core/vm-detector.ts

export interface VMInfo {
  detected: boolean;
  type: 'dispatch' | 'threaded' | 'stack' | 'register' | 'hybrid';
  confidence: number;
  entryPoints: number[];
  handlerCount: number;
  registerCount: number;
  hasEncryption: boolean;
  hasMutation: boolean;
  hasAntiDebug: boolean;
  bytecodeLocation?: string;
  dispatchLocation?: string;
  features: VMSignature[];
}

export interface VMSignature {
  name: string;
  pattern: RegExp;
  weight: number;
  detected: boolean;
}

export class VMDetector {
  private signatures: VMSignature[] = [];

  constructor() {
    this.initializeSignatures();
  }

  /**
   * Initialize VM signatures
   */
  private initializeSignatures(): void {
    this.signatures = [
      // Dispatch loop signatures
      {
        name: 'dispatch_loop',
        pattern: /while\s+pc\s*<=\s*#bytecode\s+do.*?end/s,
        weight: 10,
        detected: false
      },
      {
        name: 'handler_table',
        pattern: /(handlers?|dispatch)\s*=\s*{[^}]+}/s,
        weight: 8,
        detected: false
      },
      {
        name: 'opcode_map',
        pattern: /(opcodes?|opMap)\s*=\s*{[^}]+}/s,
        weight: 8,
        detected: false
      },
      
      // Bytecode signatures
      {
        name: 'bytecode_table',
        pattern: /bytecode\s*=\s*{[^}]+}/s,
        weight: 9,
        detected: false
      },
      {
        name: 'instruction_table',
        pattern: /instructions\s*=\s*{[^}]+}/s,
        weight: 9,
        detected: false
      },
      
      // Register-based VM signatures
      {
        name: 'register_array',
        pattern: /registers?\s*=\s*{[^}]+}/s,
        weight: 7,
        detected: false
      },
      {
        name: 'stack_operations',
        pattern: /stack\[[^\]]+\]\s*=\s*[^;]+/g,
        weight: 6,
        detected: false
      },
      
      // Anti-debug signatures
      {
        name: 'debug_checks',
        pattern: /debug\.getinfo|debug\.gethook|os\.clock/,
        weight: 5,
        detected: false
      },
      
      // Encryption signatures
      {
        name: 'bytecode_encryption',
        pattern: /bytecode\s*=\s*encrypt\([^)]+\)/,
        weight: 10,
        detected: false
      },
      {
        name: 'xor_encryption',
        pattern: /~\s*\(\s*\w+\s*\+\s*i\s*-\s*1\s*\)/,
        weight: 7,
        detected: false
      },
      
      // Mutation signatures
      {
        name: 'handler_mutation',
        pattern: /(handlers?|dispatch)\s*\[\s*\w+\s*\]\s*=\s*function/,
        weight: 8,
        detected: false
      },
      {
        name: 'opcode_swapping',
        pattern: /swap|shuffle|mutate/,
        weight: 6,
        detected: false
      },
      
      // Advanced VM patterns
      {
        name: 'threaded_dispatch',
        pattern: /goto\s+[^\s]+|computed\s+goto/,
        weight: 9,
        detected: false
      },
      {
        name: 'indirect_dispatch',
        pattern: /dispatch\[[^\]]+\]\[[^\]]+\]/,
        weight: 8,
        detected: false
      },
      {
        name: 'self_modifying',
        pattern: /load|loadstring|load\([^)]+\)/g,
        weight: 8,
        detected: false
      }
    ];
  }

  /**
   * Detect VM type and features
   */
  detect(code: string): VMInfo {
    const detectedSignatures: VMSignature[] = [];
    let score = 0;
    
    // Check each signature
    this.signatures.forEach(sig => {
      if (sig.pattern.test(code)) {
        sig.detected = true;
        detectedSignatures.push(sig);
        score += sig.weight;
      }
    });
    
    // Determine VM type based on signatures
    const type = this.determineVMType(detectedSignatures);
    const confidence = Math.min(score / 50, 1.0);
    
    return {
      detected: confidence > 0.3,
      type,
      confidence,
      entryPoints: this.findEntryPoints(code),
      handlerCount: this.countHandlers(code),
      registerCount: this.countRegisters(code),
      hasEncryption: this.hasEncryption(code),
      hasMutation: this.hasMutation(code),
      hasAntiDebug: this.hasAntiDebug(code),
      bytecodeLocation: this.findBytecodeLocation(code),
      dispatchLocation: this.findDispatchLocation(code),
      features: detectedSignatures
    };
  }

  /**
   * Determine VM type
   */
  private determineVMType(signatures: VMSignature[]): VMInfo['type'] {
    const types = {
      dispatch: 0,
      threaded: 0,
      stack: 0,
      register: 0,
      hybrid: 0
    };
    
    signatures.forEach(sig => {
      if (sig.name.includes('dispatch')) types.dispatch += sig.weight;
      if (sig.name.includes('threaded')) types.threaded += sig.weight;
      if (sig.name.includes('stack')) types.stack += sig.weight;
      if (sig.name.includes('register')) types.register += sig.weight;
    });
    
    const maxType = Object.entries(types).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    return maxType as VMInfo['type'];
  }

  /**
   * Find entry points
   */
  private findEntryPoints(code: string): number[] {
    const entryPoints: number[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes('pc = 1') || line.includes('ip = 1')) {
        entryPoints.push(index + 1);
      }
    });
    
    return entryPoints;
  }

  /**
   * Count handlers
   */
  private countHandlers(code: string): number {
    const handlerMatch = code.match(/(handlers?|dispatch)\s*=\s*{([^}]+)}/s);
    if (!handlerMatch) return 0;
    
    return (handlerMatch[2].match(/\[/g) || []).length;
  }

  /**
   * Count registers
   */
  private countRegisters(code: string): number {
    const registerMatch = code.match(/registers?\s*=\s*{([^}]+)}/s);
    if (!registerMatch) return 0;
    
    return (registerMatch[1].match(/,/g) || []).length + 1;
  }

  /**
   * Check for encryption
   */
  private hasEncryption(code: string): boolean {
    return /encrypt|decrypt|xor|aes|base64/i.test(code);
  }

  /**
   * Check for mutation
   */
  private hasMutation(code: string): boolean {
    return /mutate|swap|shuffle|self.?modify/i.test(code);
  }

  /**
   * Check for anti-debug
   */
  private hasAntiDebug(code: string): boolean {
    return /debug\.getinfo|debug\.gethook|os\.clock|timing/i.test(code);
  }

  /**
   * Find bytecode location
   */
  private findBytecodeLocation(code: string): string | undefined {
    const match = code.match(/(bytecode|instructions?)\s*=\s*{([^}]+)}/);
    return match?.[0];
  }

  /**
   * Find dispatch location
   */
  private findDispatchLocation(code: string): string | undefined {
    const match = code.match(/(handlers?|dispatch)\s*=\s*{([^}]+)}/s);
    return match?.[0];
  }
}
