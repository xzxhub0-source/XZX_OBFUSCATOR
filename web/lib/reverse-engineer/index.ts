// web/lib/reverse-engineer/index.ts
import { VMDetector } from './core/vm-detector';
import { BytecodeExtractor } from './core/bytecode-extractor';
import { OpcodeLearner } from './learning/opcode-learner';
import { HandlerSimulator } from './emulation/handler-simulator';
import { ControlFlowReconstructor } from './reconstruction/control-flow';
import { FunctionRebuilder } from './reconstruction/function-rebuilder';
import { RuntimeTracer } from './tracing/runtime-tracer';
import { EnvironmentSpoofer } from './environment/spoofing-layer';

export interface ReverseEngineerConfig {
  enableTracing?: boolean;
  enableLearning?: boolean;
  enableReconstruction?: boolean;
  enableSpoofing?: boolean;
  maxInstructions?: number;
  verbose?: boolean;
}

export class XZXReverseEngineer {
  private config: ReverseEngineerConfig;
  private vmDetector: VMDetector;
  private bytecodeExtractor: BytecodeExtractor;
  private opcodeLearner: OpcodeLearner;
  private handlerSimulator: HandlerSimulator;
  private flowReconstructor: ControlFlowReconstructor;
  private functionRebuilder: FunctionRebuilder;
  private tracer: RuntimeTracer;
  private spoofer: EnvironmentSpoofer;
  
  private debug: string[] = [];

  constructor(config: ReverseEngineerConfig = {}) {
    this.config = {
      enableTracing: true,
      enableLearning: true,
      enableReconstruction: true,
      enableSpoofing: true,
      maxInstructions: 1000000,
      verbose: false,
      ...config
    };
    
    this.vmDetector = new VMDetector();
    this.bytecodeExtractor = new BytecodeExtractor();
    this.opcodeLearner = new OpcodeLearner();
    this.handlerSimulator = new HandlerSimulator();
    this.flowReconstructor = new ControlFlowReconstructor();
    this.functionRebuilder = new FunctionRebuilder();
    this.tracer = new RuntimeTracer();
    this.spoofer = new EnvironmentSpoofer();
  }

  /**
   * Reverse engineer any Lua obfuscator
   */
  async reverse(code: string): Promise<any> {
    this.debug = [];
    
    try {
      const result: any = {
        success: true,
        stages: {},
        stats: {}
      };

      // Stage 1: VM Detection
      this.debug.push('Stage 1: Detecting VM...');
      result.vm = this.vmDetector.detect(code);
      
      // Stage 2: Bytecode Extraction
      this.debug.push('Stage 2: Extracting bytecode...');
      result.bytecode = this.bytecodeExtractor.extract(code);
      
      // Stage 3: Handler Analysis
      this.debug.push('Stage 3: Analyzing handlers...');
      result.handlers = await this.handlerSimulator.analyzeHandlers(code);
      
      // Stage 4: Control Flow Reconstruction
      if (this.config.enableReconstruction && result.bytecode.length > 0) {
        this.debug.push('Stage 4: Reconstructing control flow...');
        const bytecode = result.bytecode[0]?.raw || [];
        result.controlFlow = this.flowReconstructor.reconstruct(bytecode);
        
        // Stage 5: Function Rebuilding
        this.debug.push('Stage 5: Rebuilding functions...');
        result.functions = this.functionRebuilder.rebuild(bytecode, result.controlFlow);
      }
      
      // Stage 6: Environment Spoofing
      if (this.config.enableSpoofing) {
        this.debug.push('Stage 6: Spoofing environment...');
        this.spoofer.initialize(global);
      }
      
      // Stage 7: Runtime Tracing (if enabled)
      if (this.config.enableTracing) {
        this.debug.push('Stage 7: Starting runtime trace...');
        const traceId = this.tracer.startSession();
        result.trace = {
          id: traceId,
          session: this.tracer.exportTrace()
        };
      }
      
      // Stage 8: Opcode Learning (if enabled)
      if (this.config.enableLearning && result.vm.detected) {
        this.debug.push('Stage 8: Learning opcode behaviors...');
        result.learning = {
          learned: Array.from(this.opcodeLearner.getAllLearned().entries()),
          stats: this.opcodeLearner.getStats()
        };
      }
      
      // Stage 9: Generate Visualizations
      if (result.controlFlow) {
        result.visualizations = {
          mermaid: this.flowReconstructor.generateMermaid()
        };
      }
      
      // Stage 10: Calculate Statistics
      result.stats = this.calculateStats(result);
      result.debug = this.debug;
      
      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: this.debug
      };
    }
  }

  /**
   * Calculate statistics
   */
  private calculateStats(result: any): any {
    const stats: any = {};
    
    if (result.bytecode) {
      stats.bytecodeSize = result.bytecode.reduce((sum: number, bc: any) => sum + bc.size, 0);
      stats.bytecodeCount = result.bytecode.length;
    }
    
    if (result.handlers) {
      stats.handlerCount = result.handlers.length;
      stats.handlerComplexity = result.handlers.reduce((sum: number, h: any) => sum + h.complexity, 0);
    }
    
    if (result.functions) {
      stats.functionCount = result.functions.length;
      stats.functionComplexity = result.functions.reduce((sum: number, f: any) => sum + f.complexity, 0);
    }
    
    return stats;
  }
}

export default XZXReverseEngineer;
