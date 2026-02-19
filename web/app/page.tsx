"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Copy,
  Download,
  Settings,
  Code,
  Lock,
  Shuffle,
  CheckCircle,
  AlertCircle,
  Zap,
  Shield,
  Sparkles,
  Upload,
  File,
  X,
  Cpu,
  Globe,
  HardDrive,
  Eye,
  Bug,
  Layers,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  Info,
  Clock,
  Database,
  CpuIcon,
  Hash,
  Key,
  ZapOff,
  BrainCircuit,
  FileWarning,
  CheckCheck,
} from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";
import { BackgroundGradientAnimation } from "@/components/BackgroundGradient";
import { obfuscateLua } from "@/lib/luraph-obfuscator";
import {
  trackObfuscation,
  trackCopy,
  trackDownload,
  trackSessionStart,
  trackProtectionLevelChange,
  trackFeatureCombination,
  trackObfuscationPerformance,
  trackObfuscationMilestone,
  trackTimeOnPage,
  trackError,
  trackSettingsChange,
} from "@/lib/analytics-client";
import type { ParseError } from "@/lib/parser";
import type { EncryptionAlgorithm } from "@/lib/encryption";
import type { FormattingStyle } from "@/lib/formatter";
import type { ObfuscationMetrics } from "@/lib/metrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const DEFAULT_LUA_CODE = "";

interface ObfuscatorSettings {
  // Basic options (v1.0)
  mangleNames: boolean;
  encodeStrings: boolean;
  encodeNumbers: boolean;
  controlFlow: boolean;
  minify: boolean;
  compressionLevel: number;

  // Advanced options (v1.1)
  encryptionAlgorithm: EncryptionAlgorithm;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  antiDebugging: boolean;
  formattingStyle: FormattingStyle;

  // XZX advanced features
  intenseVM: boolean;
  gcFixes: boolean;
  targetVersion: "5.1" | "5.2" | "5.3" | "5.4" | "luajit";
  hardcodeGlobals: boolean;
  optimizationLevel: 0 | 1 | 2 | 3;
  staticEnvironment: boolean;
  vmCompression: boolean;
  disableLineInfo: boolean;
  useDebugLibrary: boolean;

  // Additional XZX features
  opaquePredicates: boolean;
  virtualization: boolean;
  bytecodeEncryption: boolean;
  antiTamper: boolean;
  selfModifying: boolean;
  mutation: boolean;
  codeSplitting: boolean;
  environmentLock: boolean;
  integrityChecks: boolean;
}

export default function Home() {
  const [inputCode, setInputCode] = useState(DEFAULT_LUA_CODE);
  const [outputCode, setOutputCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [inputError, setInputError] = useState<ParseError | undefined>(undefined);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [metrics, setMetrics] = useState<ObfuscationMetrics | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<ObfuscatorSettings>({
    mangleNames: false,
    encodeStrings: false,
    encodeNumbers: false,
    controlFlow: false,
    minify: false,
    compressionLevel: 0,
    encryptionAlgorithm: "none",
    controlFlowFlattening: false,
    deadCodeInjection: false,
    antiDebugging: false,
    formattingStyle: "minified",
    intenseVM: false,
    gcFixes: false,
    targetVersion: "5.1",
    hardcodeGlobals: false,
    optimizationLevel: 1,
    staticEnvironment: false,
    vmCompression: false,
    disableLineInfo: false,
    useDebugLibrary: false,
    opaquePredicates: false,
    virtualization: false,
    bytecodeEncryption: false,
    antiTamper: false,
    selfModifying: false,
    mutation: false,
    codeSplitting: false,
    environmentLock: false,
    integrityChecks: false,
  });

  const [obfuscationCount, setObfuscationCount] = useState(0);
  const [pageStartTime] = useState(Date.now());

  // Track session start on mount
  useEffect(() => {
    trackSessionStart().catch(err => console.error("Analytics tracking failed:", err));

    // Track time on page on unmount
    return () => {
      const timeOnPage = Math.floor((Date.now() - pageStartTime) / 1000);
      trackTimeOnPage(timeOnPage).catch(err => console.error("Analytics tracking failed:", err));
    };
  }, [pageStartTime]);

  // Success animation effect
  useEffect(() => {
    if (outputCode && !error) {
      setShowSuccessAnimation(true);
      const timer = setTimeout(() => setShowSuccessAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [outputCode, error]);

  // Clear input error when user starts typing
  const handleInputChange = (newCode: string) => {
    setInputCode(newCode);
    if (inputError) {
      setInputError(undefined);
    }
    setWarning(null);
  };

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      setWarning(`File size: ${fileSizeMB.toFixed(2)}MB. Large files may take longer to process.`);
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInputCode(content);
    };
    reader.readAsText(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setFileName("");
    setInputCode("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const obfuscateCode = async () => {
    setIsProcessing(true);
    setError(null);
    setInputError(undefined);
    setCopySuccess(false);
    setMetrics(null);
    setWarning(null);
    setOutputCode("");

    try {
      const startTime = Date.now();

      const options = {
        mangleNames: settings.mangleNames,
        encodeStrings: settings.encodeStrings,
        encodeNumbers: settings.encodeNumbers,
        controlFlow: settings.controlFlowFlattening,
        antiDebugging: settings.antiDebugging,
        protectionLevel: settings.compressionLevel,
        deadCodeInjection: settings.deadCodeInjection,
        opaquePredicates: settings.opaquePredicates,
        controlFlowFlattening: settings.controlFlowFlattening,
      };

      // Use the new Luraph-style obfuscator
      const result = obfuscateLua(inputCode, options);

      const duration = Date.now() - startTime;

      if (result.success && result.code) {
        setOutputCode(result.code);
        
        // Transform metrics to match expected format
        const transformedMetrics: ObfuscationMetrics = {
          inputSize: result.metrics?.inputSize || 0,
          outputSize: result.metrics?.outputSize || 0,
          duration: duration,
          sizeRatio: (result.metrics?.outputSize || 0) / (result.metrics?.inputSize || 1),
          transformations: {
            namesMangled: result.metrics?.transformations?.namesMangled || 0,
            stringsEncoded: result.metrics?.transformations?.stringsEncoded || 0,
            numbersEncoded: result.metrics?.transformations?.numbersEncoded || 0,
            deadCodeBlocks: result.metrics?.transformations?.deadCodeBlocks || 0,
            antiDebugChecks: result.metrics?.transformations?.antiDebugChecks || 0
          }
        };
        
        setMetrics(transformedMetrics);
        setError(null);
        setInputError(undefined);

        // Update obfuscation count
        const newCount = obfuscationCount + 1;
        setObfuscationCount(newCount);

        // Track obfuscation event
        trackObfuscation({
          obfuscationType: settings.controlFlowFlattening ? "advanced" : "standard",
          codeSize: inputCode.length,
          protectionLevel: settings.compressionLevel,
        }).catch(err => console.error("Analytics tracking failed:", err));

        // Track performance metrics
        trackObfuscationPerformance({
          inputSize: inputCode.length,
          outputSize: result.metrics?.outputSize || 0,
          duration: duration,
          sizeRatio: (result.metrics?.outputSize || 0) / inputCode.length,
        }).catch(err => console.error("Analytics tracking failed:", err));

        // Track feature combination
        trackFeatureCombination({
          mangleNames: settings.mangleNames,
          encodeStrings: settings.encodeStrings,
          encodeNumbers: settings.encodeNumbers,
          controlFlow: settings.controlFlow,
          minify: settings.minify,
          protectionLevel: settings.compressionLevel,
        }).catch(err => console.error("Analytics tracking failed:", err));

        // Track milestones
        if ([1, 5, 10, 25, 50].includes(newCount)) {
          trackObfuscationMilestone(newCount).catch(err => console.error("Analytics tracking failed:", err));
        }

      } else {
        setError(result.error || "Failed to obfuscate code");
        setOutputCode("");
        setMetrics(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      setOutputCode("");
      setMetrics(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(outputCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      trackCopy(outputCode.length).catch(err => console.error("Analytics tracking failed:", err));
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  };

  const downloadCode = () => {
    const blob = new Blob([outputCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? `obfuscated_${fileName}` : "obfuscated.lua";
    a.click();
    URL.revokeObjectURL(url);
    trackDownload(outputCode.length).catch(err => console.error("Analytics tracking failed:", err));
  };

  // Calculate protection strength for visual feedback
  const getProtectionStrength = () => {
    if (settings.compressionLevel === 0) return "none";
    if (settings.compressionLevel < 40) return "low";
    if (settings.compressionLevel < 70) return "medium";
    if (settings.compressionLevel < 90) return "high";
    return "maximum";
  };

  const protectionStrength = getProtectionStrength();

  // Count active advanced features
  const getActiveAdvancedCount = () => {
    let count = 0;
    if (settings.intenseVM) count++;
    if (settings.opaquePredicates) count++;
    if (settings.virtualization) count++;
    if (settings.bytecodeEncryption) count++;
    if (settings.antiTamper) count++;
    if (settings.selfModifying) count++;
    if (settings.mutation) count++;
    if (settings.codeSplitting) count++;
    if (settings.environmentLock) count++;
    if (settings.integrityChecks) count++;
    if (settings.controlFlowFlattening) count++;
    if (settings.deadCodeInjection) count++;
    if (settings.antiDebugging) count++;
    return count;
  };

  // Format bytes to human-readable
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <>
      <BackgroundGradientAnimation
        gradientBackgroundStart="rgb(5, 5, 8)"
        gradientBackgroundEnd="rgb(10, 10, 15)"
        firstColor="139, 92, 246"
        secondColor="168, 85, 247"
        thirdColor="192, 38, 211"
        fourthColor="236, 72, 153"
        fifthColor="219, 39, 119"
        pointerColor="139, 92, 246"
      />

      <main className="relative z-10 flex flex-col p-4 sm:p-6 gap-4 lg:gap-6 min-h-screen">
        {/* Header with XZX Theme */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-700">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6] via-[#a855f7] to-[#ec4899] rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#8b5cf6] via-[#a855f7] to-[#ec4899] flex items-center justify-center shadow-2xl shadow-purple-500/30 ring-2 ring-white/20 backdrop-blur-sm transform group-hover:scale-105 transition-all duration-300"
                aria-hidden="true"
              >
                <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-md group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400">
                  XZX
                </span>
                <span className="text-white ml-2">Obfuscator</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs sm:text-sm text-gray-300/90 font-medium">
                  v8.0.0 | Luraph‑Style Protection
                </p>
                {getActiveAdvancedCount() > 0 && (
                  <div className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] text-purple-300">
                    {getActiveAdvancedCount()} Active
                  </div>
                )}
              </div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-3 w-full sm:w-auto" aria-label="Main actions">
            <Button
              onClick={copyToClipboard}
              disabled={!outputCode || isProcessing}
              className="group bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/20 hover:border-white/40 flex-1 sm:flex-none transition-all duration-300 shadow-lg hover:shadow-2xl backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400 animate-in zoom-in duration-200" />
                  <span className="animate-in fade-in duration-200">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
                  Copy
                </>
              )}
            </Button>
            <Button
              onClick={downloadCode}
              disabled={!outputCode || isProcessing}
              className="group bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/20 hover:border-white/40 flex-1 sm:flex-none transition-all duration-300 shadow-lg hover:shadow-2xl backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            >
              <Download className="w-4 h-4 mr-2 group-hover:translate-y-0.5 transition-transform duration-200" />
              Download
            </Button>
            <Button
              onClick={obfuscateCode}
              disabled={!inputCode || isProcessing}
              className="group relative bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] hover:from-[#9b6cf6] hover:via-[#b865f7] hover:to-[#fc59a9] active:scale-[0.98] text-white shadow-xl hover:shadow-2xl shadow-purple-500/40 flex-1 sm:flex-none transition-all duration-300 font-semibold hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              <Shuffle className="w-4 h-4 mr-2 relative z-10 group-hover:rotate-180 transition-transform duration-500" />
              <span className="relative z-10">{isProcessing ? "Processing..." : "Obfuscate"}</span>
            </Button>
          </nav>
        </header>

        {/* Success Animation Overlay */}
        {showSuccessAnimation && (
          <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top fade-in duration-300">
            <div className="bg-gradient-to-r from-green-500/90 to-emerald-500/90 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-2xl border border-green-400/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCheck className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Obfuscation Complete!</p>
                <p className="text-green-50 text-xs">Luraph‑style protection applied</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <section
          className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 overflow-y-auto animate-in fade-in slide-in-from-bottom duration-700"
          aria-label="Code editor workspace"
        >
          {/* Code Editors */}
          <div className="lg:col-span-8 flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:min-h-0">
            {/* Input Editor */}
            <section
              aria-labelledby="input-code-heading"
              className="flex flex-col h-[300px] lg:h-auto lg:min-h-0 group"
            >
              <Card className="flex-1 bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-pink-900/20 backdrop-blur-2xl border-purple-500/30 shadow-2xl shadow-black/30 overflow-hidden flex flex-col h-full p-0 gap-0 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500 hover:shadow-purple-500/20">
                <div className="p-4 border-b border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] rounded-lg blur-md opacity-50"></div>
                      <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center shadow-lg">
                        <Code className="w-4.5 h-4.5 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <h2 id="input-code-heading" className="text-sm font-bold text-white tracking-wide">
                        Original Lua Code
                      </h2>
                      <p className="text-xs text-gray-400 font-medium">
                        {inputCode.length > 0 ? `${formatBytes(inputCode.length)}` : "Paste code or upload a file"}
                      </p>
                    </div>
                  </div>

                  {/* File Upload Controls */}
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".lua,.txt"
                      className="hidden"
                    />
                    <Button
                      onClick={triggerFileUpload}
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                      className="bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/30 text-white disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </Button>
                    {fileName && (
                      <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full">
                        <File className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-purple-300 max-w-[150px] truncate">{fileName}</span>
                        <button onClick={clearFile} className="hover:text-white" disabled={isProcessing}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-h-0 relative">
                  {isProcessing && (
                    <div className="absolute inset-0 bg-purple-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
                    </div>
                  )}
                  <CodeEditor
                    value={inputCode}
                    onChange={handleInputChange}
                    error={inputError}
                    options={{
                      readOnly: isProcessing,
                      automaticLayout: true,
                      wordWrap: "on",
                      lineNumbers: "on",
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </Card>
            </section>

            {/* Output Editor */}
            <section
              aria-labelledby="output-code-heading"
              className="flex flex-col h-[300px] lg:h-auto lg:min-h-0 group"
            >
              <Card className="flex-1 bg-gradient-to-br from-pink-900/20 via-purple-800/10 to-purple-900/20 backdrop-blur-2xl border-pink-500/30 shadow-2xl shadow-black/30 overflow-hidden flex flex-col h-full p-0 gap-0 ring-1 ring-pink-500/20 hover:ring-pink-500/40 transition-all duration-500 hover:shadow-pink-500/20">
                <div className="p-4 border-b border-pink-500/30 bg-gradient-to-r from-pink-500/20 to-purple-500/20 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] rounded-lg blur-md opacity-50"></div>
                        <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] flex items-center justify-center shadow-lg">
                          <Shield className="w-4.5 h-4.5 text-white" aria-hidden="true" />
                        </div>
                      </div>
                      <div>
                        <h2 id="output-code-heading" className="text-sm font-bold text-white tracking-wide">
                          Protected Output
                        </h2>
                        <p className="text-xs text-gray-400 font-medium">
                          {outputCode ? formatBytes(outputCode.length) : "Luraph‑style output"}
                        </p>
                      </div>
                    </div>
                    {outputCode && !isProcessing && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 backdrop-blur-sm animate-in fade-in zoom-in duration-500">
                        <Zap className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs font-bold text-green-300">Ready</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <CodeEditor
                    value={outputCode}
                    readOnly
                    options={{
                      readOnly: true,
                      automaticLayout: true,
                      wordWrap: "on",
                      lineNumbers: "on",
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </Card>
            </section>

            {/* Metrics Display */}
            {metrics && !isProcessing && (
              <section aria-labelledby="metrics-heading" className="lg:col-span-2">
                <Card className="bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-pink-900/20 backdrop-blur-2xl border-purple-500/30 shadow-2xl shadow-black/30 p-6 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-purple-500/30">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] rounded-lg blur-md opacity-50"></div>
                      <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center shadow-lg">
                        <Cpu className="w-4.5 h-4.5 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <h2 id="metrics-heading" className="text-sm font-bold text-white tracking-wide">
                        Protection Metrics
                      </h2>
                      <p className="text-xs text-gray-400 font-medium">Luraph‑style transformations</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Size metrics */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Input Size</span>
                        <span className="text-sm font-semibold text-white">
                          {formatBytes(metrics.inputSize)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Output Size</span>
                        <span className="text-sm font-semibold text-white">
                          {formatBytes(metrics.outputSize)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Protection Ratio</span>
                        <span
                          className={cn(
                            "text-sm font-bold",
                            metrics.sizeRatio > 3 ? "text-pink-400" : "text-purple-400"
                          )}
                        >
                          {metrics.sizeRatio.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Processing Time</span>
                        <span className="text-sm font-semibold text-white">
                          {(metrics.duration / 1000).toFixed(2)}s
                        </span>
                      </div>
                    </div>

                    {/* Transformations */}
                    <div className="border-t border-purple-500/30 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Transformations
                        </span>
                      </div>
                      <div className="space-y-2">
                        {metrics.transformations.namesMangled > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Names Mangled</span>
                            <span className="text-sm font-semibold text-purple-400">
                              {metrics.transformations.namesMangled}
                            </span>
                          </div>
                        )}
                        {metrics.transformations.stringsEncoded > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Strings Encrypted</span>
                            <span className="text-sm font-semibold text-pink-400">
                              {metrics.transformations.stringsEncoded}
                            </span>
                          </div>
                        )}
                        {metrics.transformations.numbersEncoded > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Numbers Encoded</span>
                            <span className="text-sm font-semibold text-green-400">
                              {metrics.transformations.numbersEncoded}
                            </span>
                          </div>
                        )}
                        {metrics.transformations.deadCodeBlocks > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Dead Code Blocks</span>
                            <span className="text-sm font-semibold text-orange-400">
                              {metrics.transformations.deadCodeBlocks}
                            </span>
                          </div>
                        )}
                        {metrics.transformations.antiDebugChecks > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Anti-Debug Checks</span>
                            <span className="text-sm font-semibold text-red-400">
                              {metrics.transformations.antiDebugChecks}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </section>
            )}
          </div>

          {/* Settings Panel - Keep your existing settings panel here */}
          <aside className="lg:col-span-4 lg:overflow-auto" aria-labelledby="settings-heading">
            <Card className="bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-pink-900/20 backdrop-blur-2xl border-purple-500/30 shadow-2xl shadow-black/30 p-6 sm:p-7 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500">
              <div className="flex items-center gap-3 mb-6 sm:mb-8 pb-5 border-b border-purple-500/30">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] rounded-xl blur-lg opacity-50"></div>
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center shadow-lg">
                    <Settings className="w-5.5 h-5.5 text-white" aria-hidden="true" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 id="settings-heading" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Protection Settings
                  </h2>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Luraph‑style configuration
                  </p>
                </div>
              </div>

              {/* Your existing settings panel content - keep as is */}
              <div className="space-y-7 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {/* All your existing switch components */}
              </div>
            </Card>
          </aside>
        </section>

        {/* Error Display */}
        {error && (
          <aside
            role="alert"
            aria-live="assertive"
            className="relative overflow-hidden bg-gradient-to-r from-red-900/40 via-red-800/30 to-red-900/40 border-2 border-red-500/60 rounded-2xl p-6 flex items-start gap-4 shadow-2xl shadow-red-500/30 backdrop-blur-xl ring-1 ring-red-500/30 animate-in slide-in-from-bottom fade-in duration-500"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-500/20 to-transparent rounded-full blur-3xl"></div>
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/30 to-red-600/30 flex items-center justify-center flex-shrink-0 shadow-lg backdrop-blur-sm border border-red-500/40">
              <AlertCircle className="w-6 h-6 text-red-300 animate-pulse" aria-hidden="true" />
            </div>
            <div className="flex-1 relative">
              <h3 className="text-red-200 font-bold mb-2 text-base flex items-center gap-2">
                Obfuscation Error
                <span className="px-2 py-0.5 bg-red-500/20 rounded-md text-xs">Failed</span>
              </h3>
              <p className="text-red-100/90 text-sm leading-relaxed">{error}</p>
            </div>
          </aside>
        )}

        {/* Warning Display */}
        {warning && !error && (
          <aside
            role="alert"
            className="relative overflow-hidden bg-gradient-to-r from-yellow-900/40 via-yellow-800/30 to-yellow-900/40 border-2 border-yellow-500/60 rounded-2xl p-6 flex items-start gap-4 shadow-2xl shadow-yellow-500/30 backdrop-blur-xl ring-1 ring-yellow-500/30 animate-in slide-in-from-bottom fade-in duration-500"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-500/20 to-transparent rounded-full blur-3xl"></div>
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/30 to-yellow-600/30 flex items-center justify-center flex-shrink-0 shadow-lg backdrop-blur-sm border border-yellow-500/40">
              <AlertTriangle className="w-6 h-6 text-yellow-300 animate-pulse" aria-hidden="true" />
            </div>
            <div className="flex-1 relative">
              <h3 className="text-yellow-200 font-bold mb-2 text-base flex items-center gap-2">
                Notice
                <span className="px-2 py-0.5 bg-yellow-500/20 rounded-md text-xs">Info</span>
              </h3>
              <p className="text-yellow-100/90 text-sm leading-relaxed">{warning}</p>
            </div>
          </aside>
        )}

        {/* Footer */}
        <footer
          className="mt-auto pt-8 pb-4 text-center"
          role="contentinfo"
          aria-label="Version and author information"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-purple-500/30 hover:bg-white/10 transition-all duration-300">
            <span className="text-sm text-gray-400 font-mono">v8.0.0</span>
            <span className="text-sm text-gray-400">Made by</span>
            <a
              href="https://discord.gg/5q5bEKmYqF"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-purple-400 hover:text-pink-400 font-mono transition-colors duration-200 hover:underline"
            >
              XZX HUB
            </a>
            <span className="text-sm text-gray-400">x</span>
            <a
              href="https://billchirico.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-pink-400 hover:text-purple-400 font-mono transition-colors duration-200 hover:underline"
            >
              BillChirico
            </a>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(139, 92, 246, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          border-radius: 10px;
        }
      `}</style>
    </>
  );
}
