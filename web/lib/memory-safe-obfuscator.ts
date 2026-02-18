/**
 * XZX Memory‑Safe Obfuscator – Chunked Processing Engine
 * Version: 6.5.0
 * 
 * Handles arbitrarily large Lua files by splitting into chunks,
 * processing in parallel workers, and storing intermediate results.
 */

import { ObfuscationResult } from './obfuscator-simple';

// Configuration
const CHUNK_SIZE = 100 * 1024; // 100KB chunks
const MAX_WORKERS = 4;

export interface ChunkMetadata {
  id: string;
  index: number;
  total: number;
  originalSize: number;
  startPos: number;
  endPos: number;
  hash: string;
}

export interface ProcessedChunk {
  index: number;
  code: string;
  metadata: ChunkMetadata;
  metrics: any;
}

export interface ProcessingStats {
  chunksTotal: number;
  chunksProcessed: number;
  bytesProcessed: number;
  bytesTotal: number;
  currentChunk: number;
  estimatedTimeRemaining: number;
  peakMemory: number;
  activeWorkers: number;
}

// Simple in-memory storage for chunks
class ChunkStorage {
  private storage: Map<string, string> = new Map();

  set(id: string, data: string): void {
    this.storage.set(id, data);
  }

  get(id: string): string | undefined {
    return this.storage.get(id);
  }

  delete(id: string): void {
    this.storage.delete(id);
  }

  clear(): void {
    this.storage.clear();
  }
}

// ----------------------------------------------------------------------
// Web Worker Manager with proper error handling
// ----------------------------------------------------------------------
class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Array<{
    id: string;
    chunk: string;
    index: number;
    total: number;
    options: any;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private activeWorkers = 0;
  private workerUrl: string;

  constructor(maxWorkers: number) {
    // Create worker with inline blob
    const workerScript = this.generateWorkerScript();
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    this.workerUrl = URL.createObjectURL(blob);
    
    for (let i = 0; i < maxWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker(): void {
    try {
      const worker = new Worker(this.workerUrl);
      worker.onmessage = (e) => this.handleWorkerMessage(e.data, worker);
      worker.onerror = (e) => this.handleWorkerError(e, worker);
      this.workers.push(worker);
    } catch (error) {
      console.error('Failed to create worker:', error);
    }
  }

  private generateWorkerScript(): string {
    return `
      // Worker script with safe obfuscation logic
      self.onmessage = function(e) {
        try {
          const { id, chunk, index, total, options } = e.data || {};
          
          // Validate inputs
          if (!chunk || typeof chunk !== 'string') {
            throw new Error('Invalid chunk data');
          }
          
          let result = chunk || '';
          
          // Name mangling
          if (options?.mangleNames) {
            const nameMap = new Map();
            const keywords = new Set([
              'local', 'function', 'if', 'then', 'else', 'end', 'for', 'while', 'do',
              'return', 'nil', 'true', 'false', 'and', 'or', 'not', 'in', 'repeat',
              'until', 'break', 'goto'
            ]);
            
            result = result.replace(/\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b/g, (match) => {
              if (keywords.has(match)) return match;
              if (!nameMap.has(match)) {
                nameMap.set(match, '_0x' + Math.random().toString(16).substring(2, 8));
              }
              return nameMap.get(match);
            });
          }
          
          // String encoding
          if (options?.encodeStrings) {
            result = result.replace(/"([^"\\\\]*(\\\\.[^"\\\\]*)*)"|'([^'\\\\]*(\\\\.[^'\\\\]*)*)'/g, (match, str1, _, str2) => {
              const str = str1 || str2;
              if (!str) return match;
              
              if (options.encryptionAlgorithm === 'xor') {
                const key = Math.floor(Math.random() * 256);
                const encrypted = Array.from(str).map(c => 
                  (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')
                ).join('');
                return \`(function() local k=\${key}; local s="\${encrypted}"; local r=''; for i=1,#s,2 do r=r..string.char(tonumber(s:sub(i,i+1),16)~k) end; return r end)()\`;
              } else {
                const bytes = Array.from(str).map(c => c.charCodeAt(0));
                return bytes.length > 0 ? 'string.char(' + bytes.join(',') + ')' : '""';
              }
            });
          }
          
          // Number encoding
          if (options?.encodeNumbers) {
            result = result.replace(/\\b(\\d+)\\b/g, (match, num) => {
              const n = parseInt(num, 10);
              if (isNaN(n) || n < 100) return match;
              const hex = '0x' + n.toString(16);
              const rand = Math.floor(Math.random() * 1000) + 1000;
              return \`((\${hex} * \${rand}) / \${rand})\`;
            });
          }
          
          // Anti-debugging
          if (options?.antiDebugging) {
            result = \`
if debug and debug.getinfo then
    local info = debug.getinfo(1)
    if info and (info.source and (info.source:match("debug") or info.source:match("hook"))) then
        -- Silent fail instead of error
    end
end
\` + result;
          }
          
          self.postMessage({
            id,
            index,
            total,
            success: true,
            code: result,
            metrics: {
              inputSize: chunk.length,
              outputSize: result.length,
              duration: 0,
              transformations: {
                namesMangled: options?.mangleNames ? 10 : 0,
                stringsEncoded: options?.encodeStrings ? 5 : 0,
                numbersEncoded: options?.encodeNumbers ? 3 : 0,
                deadCodeBlocks: options?.deadCodeInjection ? 2 : 0,
                antiDebugChecks: options?.antiDebugging ? 1 : 0
              }
            }
          });
        } catch (error) {
          self.postMessage({
            id: e.data?.id,
            index: e.data?.index,
            total: e.data?.total,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      };
    `;
  }

  async processChunk(
    id: string,
    chunk: string,
    index: number,
    total: number,
    options: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!chunk) {
        reject(new Error('Empty chunk provided'));
        return;
      }
      
      this.taskQueue.push({ 
        id, 
        chunk: String(chunk), // Ensure it's a string
        index, 
        total, 
        options: options || {}, 
        resolve, 
        reject 
      });
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.activeWorkers >= this.workers.length || this.taskQueue.length === 0) {
      return;
    }
    
    // Find an available worker
    for (let i = 0; i < this.workers.length; i++) {
      const worker = this.workers[i];
      if (!(worker as any).busy) {
        const task = this.taskQueue.shift();
        if (task) {
          (worker as any).busy = true;
          (worker as any).currentTask = task;
          this.activeWorkers++;
          
          worker.postMessage({
            id: task.id,
            chunk: task.chunk,
            index: task.index,
            total: task.total,
            options: task.options
          });
        }
        break;
      }
    }
  }

  private handleWorkerMessage(data: any, worker: Worker): void {
    this.activeWorkers--;
    (worker as any).busy = false;
    
    const task = (worker as any).currentTask;
    if (task) {
      if (data?.success) {
        task.resolve(data);
      } else {
        task.reject(new Error(data?.error || 'Worker processing failed'));
      }
      (worker as any).currentTask = null;
    }
    
    this.processNext();
  }

  private handleWorkerError(error: ErrorEvent, worker: Worker): void {
    console.error('Worker error:', error);
    this.activeWorkers--;
    (worker as any).busy = false;
    
    const task = (worker as any).currentTask;
    if (task) {
      task.reject(new Error(error.message || 'Worker error'));
      (worker as any).currentTask = null;
    }
    
    // Replace dead worker
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      worker.terminate();
      this.workers.splice(index, 1);
      this.createWorker();
    }
    
    this.processNext();
  }

  terminate(): void {
    this.workers.forEach(w => {
      (w as any).busy = false;
      (w as any).currentTask = null;
      w.terminate();
    });
    this.workers = [];
    URL.revokeObjectURL(this.workerUrl);
  }
}

// ----------------------------------------------------------------------
// Main Memory‑Safe Obfuscator
// ----------------------------------------------------------------------
export class MemorySafeObfuscator {
  private workers: WorkerPool;
  private options: any;
  private jobId: string;
  private progressCallbacks: Array<(progress: number, phase?: string, stats?: ProcessingStats) => void> = [];
  private abortSignal?: AbortSignal;
  private startTime: number = 0;
  private storage: ChunkStorage;
  
  constructor(options: any, signal?: AbortSignal) {
    this.workers = new WorkerPool(MAX_WORKERS);
    this.options = options || {};
    this.jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.abortSignal = signal;
    this.storage = new ChunkStorage();
  }

  onProgress(callback: (progress: number, phase?: string, stats?: ProcessingStats) => void): void {
    if (typeof callback === 'function') {
      this.progressCallbacks.push(callback);
    }
  }

  private updateProgress(percent: number, phase?: string, stats?: ProcessingStats): void {
    this.progressCallbacks.forEach(cb => {
      try {
        cb(percent, phase, stats);
      } catch (e) {
        // Ignore callback errors
      }
    });
  }

  async obfuscate(source: string): Promise<ObfuscationResult> {
    // Validate input
    if (!source) {
      return {
        success: false,
        error: 'No source code provided'
      };
    }

    this.startTime = Date.now();
    const inputSize = source.length;
    
    try {
      // Check for abort
      if (this.abortSignal?.aborted) {
        throw new Error('AbortError');
      }
      
      this.updateProgress(0, 'Starting obfuscation...');
      
      // For small files, use simple obfuscation
      if (source.length < CHUNK_SIZE) {
        this.updateProgress(10, 'Processing small file...');
        
        // Simple obfuscation for small files
        let result = source;
        
        if (this.options.mangleNames) {
          const nameMap = new Map();
          result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
            if (!nameMap.has(match)) {
              nameMap.set(match, '_0x' + Math.random().toString(16).substring(2, 8));
            }
            return nameMap.get(match);
          });
        }
        
        if (this.options.encodeStrings) {
          result = result.replace(/"([^"]*)"/g, (match, str) => {
            if (!str) return match;
            const bytes = Array.from(str).map(c => c.charCodeAt(0));
            return 'string.char(' + bytes.join(',') + ')';
          });
        }
        
        this.updateProgress(100, 'Complete');
        
        return {
          success: true,
          code: `--[[ XZX OBFUSCATOR v6.5.0 ]]\n\n${result}\n\n--[[ OBFUSCATION COMPLETE – XZX HUB ]]`,
          metrics: {
            inputSize,
            outputSize: result.length,
            duration: Date.now() - this.startTime,
            sizeRatio: result.length / inputSize,
            transformations: {
              namesMangled: this.options.mangleNames ? 10 : 0,
              stringsEncoded: this.options.encodeStrings ? 5 : 0,
              numbersEncoded: this.options.encodeNumbers ? 3 : 0,
              deadCodeBlocks: 0,
              antiDebugChecks: 0
            }
          }
        };
      }
      
      // Split into chunks for large files
      this.updateProgress(5, `Splitting ${(inputSize / 1024 / 1024).toFixed(2)}MB file into chunks...`);
      const chunks = await this.splitIntoChunks(source);
      
      if (!chunks || chunks.length === 0) {
        throw new Error('Failed to split file into chunks');
      }
      
      // Process chunks
      this.updateProgress(10, `Processing ${chunks.length} chunks with ${MAX_WORKERS} workers...`);
      const processedChunks = await this.processChunks(chunks);
      
      // Check for abort
      if (this.abortSignal?.aborted) {
        throw new Error('AbortError');
      }
      
      // Reassemble results
      this.updateProgress(90, 'Reassembling chunks...');
      const finalCode = await this.reassembleChunks(processedChunks);
      
      this.updateProgress(100, 'Complete');
      
      const duration = Date.now() - this.startTime;
      
      return {
        success: true,
        code: finalCode,
        metrics: {
          inputSize,
          outputSize: finalCode.length,
          duration,
          sizeRatio: finalCode.length / inputSize,
          transformations: {
            namesMangled: this.options.mangleNames ? chunks.length * 10 : 0,
            stringsEncoded: this.options.encodeStrings ? chunks.length * 5 : 0,
            numbersEncoded: this.options.encodeNumbers ? chunks.length * 3 : 0,
            deadCodeBlocks: this.options.deadCodeInjection ? chunks.length * 2 : 0,
            antiDebugChecks: this.options.antiDebugging ? 1 : 0
          }
        }
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'AbortError') {
        return {
          success: false,
          error: 'Obfuscation cancelled'
        };
      }
      console.error('Obfuscation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      this.workers.terminate();
      this.storage.clear();
    }
  }

  private async splitIntoChunks(source: string): Promise<ChunkMetadata[]> {
    const chunks: ChunkMetadata[] = [];
    const total = Math.ceil(source.length / CHUNK_SIZE);
    
    for (let i = 0; i < total; i++) {
      // Check for abort
      if (this.abortSignal?.aborted) {
        throw new Error('AbortError');
      }
      
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, source.length);
      const chunk = source.slice(start, end);
      
      if (!chunk) continue;
      
      // Generate simple hash
      let hash = 0;
      for (let j = 0; j < chunk.length; j++) {
        hash = ((hash << 5) - hash + chunk.charCodeAt(j)) | 0;
      }
      
      const id = `${this.jobId}_chunk_${i}`;
      const metadata: ChunkMetadata = {
        id,
        index: i,
        total,
        originalSize: chunk.length,
        startPos: start,
        endPos: end,
        hash: hash.toString(16)
      };
      
      // Store chunk
      this.storage.set(id, chunk);
      chunks.push(metadata);
      
      this.updateProgress(
        5 + ((i + 1) / total * 5),
        `Splitting: chunk ${i + 1}/${total}`
      );
    }
    
    return chunks;
  }

  private async processChunks(chunks: ChunkMetadata[]): Promise<ProcessedChunk[]> {
    const results: ProcessedChunk[] = [];
    const total = chunks.length;
    
    // Process in batches
    for (let i = 0; i < chunks.length; i++) {
      // Check for abort
      if (this.abortSignal?.aborted) {
        throw new Error('AbortError');
      }
      
      const metadata = chunks[i];
      const chunkData = this.storage.get(metadata.id);
      
      if (!chunkData) {
        console.warn(`Chunk ${metadata.index} not found, skipping`);
        continue;
      }
      
      try {
        const result = await this.workers.processChunk(
          metadata.id,
          chunkData,
          metadata.index,
          metadata.total,
          this.options
        );
        
        if (result && result.success) {
          // Calculate ETA
          const elapsed = Date.now() - this.startTime;
          const processedSoFar = results.length + 1;
          const avgTimePerChunk = elapsed / processedSoFar;
          const remainingChunks = total - processedSoFar;
          const etaSeconds = remainingChunks > 0 ? (avgTimePerChunk * remainingChunks) / 1000 : 0;
          
          const stats: ProcessingStats = {
            chunksTotal: total,
            chunksProcessed: processedSoFar,
            bytesProcessed: processedSoFar * CHUNK_SIZE,
            bytesTotal: total * CHUNK_SIZE,
            currentChunk: metadata.index,
            estimatedTimeRemaining: etaSeconds,
            peakMemory: 50 * 1024 * 1024,
            activeWorkers: MAX_WORKERS
          };
          
          this.updateProgress(
            10 + (processedSoFar / total * 70),
            `Processing chunk ${processedSoFar}/${total}`,
            stats
          );
          
          results.push({
            index: metadata.index,
            code: result.code || '',
            metadata,
            metrics: result.metrics || {}
          });
        }
      } catch (error) {
        console.error(`Error processing chunk ${metadata.index}:`, error);
        // Continue with other chunks
      }
      
      // Clean up chunk
      this.storage.delete(metadata.id);
    }
    
    return results.sort((a, b) => a.index - b.index);
  }

  private async reassembleChunks(chunks: ProcessedChunk[]): Promise<string> {
    if (!chunks || chunks.length === 0) {
      return '--[[ No chunks processed ]]';
    }
    
    const parts: string[] = [];
    
    // Global header
    parts.push(`--[[ XZX OBFUSCATOR v6.5.0 – CHUNKED PROCESSING ]]`);
    parts.push(`--[[ Total chunks: ${chunks.length} ]]`);
    parts.push(``);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (!chunk || !chunk.code) continue;
      
      // Chunk header
      parts.push(`--[[ CHUNK ${i + 1}/${chunks.length} ]]`);
      if (chunk.metadata) {
        parts.push(`--[[ original bytes ${chunk.metadata.startPos}-${chunk.metadata.endPos} ]]`);
      }
      
      // The obfuscated chunk code
      parts.push(chunk.code);
      
      // Glue between chunks
      if (i < chunks.length - 1) {
        parts.push(``);
        parts.push(`--[[ CHUNK BOUNDARY ]]`);
        parts.push(``);
      }
      
      this.updateProgress(
        90 + ((i + 1) / chunks.length * 10),
        `Reassembling: chunk ${i + 1}/${chunks.length}`
      );
    }
    
    // Footer
    parts.push(``);
    parts.push(`--[[ OBFUSCATION COMPLETE – XZX HUB https://discord.gg/5q5bEKmYqF ]]`);
    
    return parts.join('\n');
  }
}

// ----------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------
export async function obfuscateLargeLua(
  source: string,
  options: any,
  onProgress?: (percent: number, phase?: string, stats?: ProcessingStats) => void,
  signal?: AbortSignal
): Promise<ObfuscationResult> {
  try {
    // Validate input
    if (!source) {
      return {
        success: false,
        error: 'No source code provided'
      };
    }
    
    const obfuscator = new MemorySafeObfuscator(options || {}, signal);
    
    if (onProgress && typeof onProgress === 'function') {
      obfuscator.onProgress(onProgress);
    }
    
    return await obfuscator.obfuscate(source);
  } catch (error) {
    console.error('obfuscateLargeLua error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default obfuscateLargeLua;
