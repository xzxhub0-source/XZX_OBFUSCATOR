// web/workers/obfuscator.worker.ts
/// <reference lib="webworker" />

const ctx: Worker = self as any;

// Import the obfuscator dynamically
let obfuscateLuaModule: any = null;

// Progress stages
const STAGES = [
  'Parsing AST',
  'Analyzing code structure',
  'Renaming identifiers',
  'Encoding strings',
  'Encoding numbers',
  'Injecting dead code',
  'Flattening control flow',
  'Adding anti-debugging',
  'Optimizing output',
  'Finalizing'
];

ctx.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  if (type === 'cancel') {
    // Handle cancellation
    return;
  }

  if (type === 'obfuscate') {
    try {
      const { source, options, startTime } = data;
      const totalSteps = STAGES.length;

      // Update progress: Parsing AST
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[0],
          percent: 10,
          currentStep: 1,
          totalSteps
        }
      });

      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Analyzing code structure
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[1],
          percent: 20,
          currentStep: 2,
          totalSteps
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Renaming identifiers
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[2],
          percent: 30,
          currentStep: 3,
          totalSteps
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Encoding strings
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[3],
          percent: 40,
          currentStep: 4,
          totalSteps
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Encoding numbers
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[4],
          percent: 50,
          currentStep: 5,
          totalSteps
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Injecting dead code
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[5],
          percent: 60,
          currentStep: 6,
          totalSteps
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Flattening control flow
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[6],
          percent: 70,
          currentStep: 7,
          totalSteps
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Adding anti-debugging
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[7],
          percent: 80,
          currentStep: 8,
          totalSteps
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update progress: Optimizing output
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[8],
          percent: 90,
          currentStep: 9,
          totalSteps
        }
      });

      // Dynamically import the obfuscator
      if (!obfuscateLuaModule) {
        // Use a relative path that works in the worker context
        const module = await import('../lib/obfuscator');
        obfuscateLuaModule = module;
      }

      // Perform the actual obfuscation
      const result = await obfuscateLuaModule.obfuscateLua(source, options);

      // Update progress: Finalizing
      ctx.postMessage({
        type: 'progress',
        data: {
          stage: STAGES[9],
          percent: 100,
          currentStep: 10,
          totalSteps
        }
      });

      // Add duration to metrics
      if (result.success && result.metrics) {
        result.metrics.duration = (Date.now() - startTime) / 1000;
      }

      ctx.postMessage({
        type: 'complete',
        data: result
      });
    } catch (error) {
      ctx.postMessage({
        type: 'error',
        data: {
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      });
    }
  }
});

export {};
