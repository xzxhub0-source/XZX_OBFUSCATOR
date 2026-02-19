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
  Rocket,
  Orbit,
  Satellite,
  Star,
  Moon,
  Sun,
  Telescope,
  Space,
  StarsIcon,
  Globe2,
  OrbitIcon,
  SatelliteIcon,
  RocketIcon,
  StarIcon,
  MoonIcon,
  SunIcon,
  TelescopeIcon,
} from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";
import { BackgroundGradientAnimation } from "@/components/BackgroundGradient";
import { obfuscateLua } from "@/lib/obfuscator";
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

const DEFAULT_LUA_CODE = "-- Your Lua code here\nprint('Hello World!')";

interface ObfuscatorSettings {
  mangleNames: boolean;
  encodeStrings: boolean;
  encodeNumbers: boolean;
  controlFlow: boolean;
  minify: boolean;
  compressionLevel: number;
  encryptionAlgorithm: EncryptionAlgorithm;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  antiDebugging: boolean;
  formattingStyle: FormattingStyle;
  intenseVM: boolean;
  gcFixes: boolean;
  targetVersion: "5.1" | "5.2" | "5.3" | "5.4" | "luajit";
  hardcodeGlobals: boolean;
  optimizationLevel: 0 | 1 | 2 | 3;
  staticEnvironment: boolean;
  vmCompression: boolean;
  disableLineInfo: boolean;
  useDebugLibrary: boolean;
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [stars, setStars] = useState<{ x: number; y: number; size: number; speed: number }[]>([]);

  const [settings, setSettings] = useState<ObfuscatorSettings>({
    mangleNames: true,
    encodeStrings: true,
    encodeNumbers: true,
    controlFlow: true,
    minify: false,
    compressionLevel: 50,
    encryptionAlgorithm: "xor",
    controlFlowFlattening: true,
    deadCodeInjection: true,
    antiDebugging: true,
    formattingStyle: "minified",
    intenseVM: false,
    gcFixes: false,
    targetVersion: "5.1",
    hardcodeGlobals: false,
    optimizationLevel: 2,
    staticEnvironment: false,
    vmCompression: false,
    disableLineInfo: false,
    useDebugLibrary: false,
    opaquePredicates: true,
    virtualization: false,
    bytecodeEncryption: false,
    antiTamper: true,
    selfModifying: false,
    mutation: false,
    codeSplitting: false,
    environmentLock: false,
    integrityChecks: true,
  });

  const [obfuscationCount, setObfuscationCount] = useState(0);
  const [pageStartTime] = useState(Date.now());

  // Generate stars on mount
  useEffect(() => {
    const newStars = [];
    for (let i = 0; i < 200; i++) {
      newStars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.5 + 0.1,
      });
    }
    setStars(newStars);
  }, []);

  // Star animation
  useEffect(() => {
    if (stars.length === 0) return;
    
    const interval = setInterval(() => {
      setStars(prev => prev.map(star => ({
        ...star,
        y: star.y - star.speed < 0 ? 100 : star.y - star.speed
      })));
    }, 50);
    
    return () => clearInterval(interval);
  }, [stars]);

  useEffect(() => {
    trackSessionStart().catch(err => console.error("Analytics tracking failed:", err));
    return () => {
      const timeOnPage = Math.floor((Date.now() - pageStartTime) / 1000);
      trackTimeOnPage(timeOnPage).catch(err => console.error("Analytics tracking failed:", err));
    };
  }, [pageStartTime]);

  useEffect(() => {
    if (outputCode && !error) {
      setShowSuccessAnimation(true);
      const timer = setTimeout(() => setShowSuccessAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [outputCode, error]);

  const handleInputChange = (newCode: string) => {
    setInputCode(newCode);
    if (inputError) setInputError(undefined);
    setWarning(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) setWarning(`File size: ${fileSizeMB.toFixed(2)}MB. Large files may take longer.`);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setInputCode(e.target?.result as string);
    reader.readAsText(file);
  };

  const triggerFileUpload = () => fileInputRef.current?.click();
  const clearFile = () => {
    setFileName("");
    setInputCode(DEFAULT_LUA_CODE);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelObfuscation = () => {
    abortControllerRef.current?.abort();
    setIsProcessing(false);
  };

  const obfuscateCode = async () => {
    setIsProcessing(true);
    setError(null);
    setInputError(undefined);
    setCopySuccess(false);
    setMetrics(null);
    setWarning(null);
    setOutputCode("");

    abortControllerRef.current = new AbortController();

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
        targetVersion: settings.targetVersion,
        optimizationLevel: settings.optimizationLevel,
      };

      const result = await new Promise<any>((resolve) => {
        setTimeout(() => resolve(obfuscateLua(inputCode, options)), 100);
      });

      const duration = Date.now() - startTime;

      if (result.success && result.code) {
        setOutputCode(result.code);
        const transformedMetrics: ObfuscationMetrics = {
          inputSize: result.metrics?.inputSize || inputCode.length,
          outputSize: result.metrics?.outputSize || result.code.length,
          duration: duration,
          sizeRatio: (result.metrics?.outputSize || result.code.length) / inputCode.length,
          transformations: {
            namesMangled: settings.mangleNames ? 50 : 0,
            stringsEncoded: settings.encodeStrings ? 25 : 0,
            numbersEncoded: settings.encodeNumbers ? 15 : 0,
            deadCodeBlocks: settings.deadCodeInjection ? 30 : 0,
            antiDebugChecks: settings.antiDebugging ? 5 : 0
          }
        };
        setMetrics(transformedMetrics);
        setError(null);
        setInputError(undefined);

        const newCount = obfuscationCount + 1;
        setObfuscationCount(newCount);

        trackObfuscation({
          obfuscationType: settings.controlFlowFlattening ? "advanced" : "standard",
          codeSize: inputCode.length,
          protectionLevel: settings.compressionLevel,
        }).catch(err => console.error("Analytics tracking failed:", err));

        trackObfuscationPerformance({
          inputSize: inputCode.length,
          outputSize: result.code.length,
          duration: duration,
          sizeRatio: result.code.length / inputCode.length,
        }).catch(err => console.error("Analytics tracking failed:", err));

        trackFeatureCombination({
          mangleNames: settings.mangleNames,
          encodeStrings: settings.encodeStrings,
          encodeNumbers: settings.encodeNumbers,
          controlFlow: settings.controlFlow,
          minify: settings.minify,
          protectionLevel: settings.compressionLevel,
        }).catch(err => console.error("Analytics tracking failed:", err));

        if ([1, 5, 10, 25, 50].includes(newCount)) {
          trackObfuscationMilestone(newCount).catch(err => console.error("Analytics tracking failed:", err));
        }
      } else {
        setError(result.error || "Failed to obfuscate code");
        setOutputCode("");
        setMetrics(null);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError("Obfuscation cancelled");
      } else {
        setError(error instanceof Error ? error.message : "An unexpected error occurred");
      }
      setOutputCode("");
      setMetrics(null);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
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

  const getProtectionStrength = () => {
    if (settings.compressionLevel === 0) return "none";
    if (settings.compressionLevel < 40) return "low";
    if (settings.compressionLevel < 70) return "medium";
    if (settings.compressionLevel < 90) return "high";
    return "maximum";
  };

  const protectionStrength = getProtectionStrength();

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

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const renderSwitch = (
    id: string,
    label: string,
    description: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    color: string = "purple",
    badge?: string
  ) => {
    const colors = {
      purple: "data-[state=checked]:bg-purple-600",
      pink: "data-[state=checked]:bg-pink-600",
      blue: "data-[state=checked]:bg-blue-600",
      red: "data-[state=checked]:bg-red-600",
      orange: "data-[state=checked]:bg-orange-600",
      green: "data-[state=checked]:bg-green-600",
      yellow: "data-[state=checked]:bg-yellow-600",
    };

    return (
      <div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
        <Label htmlFor={id} className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {badge && <span className={`text-[10px] ${badge === 'Advanced' ? 'text-purple-400 bg-purple-500/10' : 'text-yellow-400 bg-yellow-500/10'} px-1.5 py-0.5 rounded`}>{badge}</span>}
            {checked && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
          </div>
          <p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">{description}</p>
        </Label>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={isProcessing}
          className={colors[color as keyof typeof colors]}
        />
      </div>
    );
  };

  return (
    <>
      {/* Animated stars background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0a2a] via-[#1a1a4a] to-[#0a0a2a] overflow-hidden">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: Math.random() * 0.7 + 0.3,
              animation: `twinkle ${Math.random() * 3 + 2}s infinite`
            }}
          />
        ))}
        
        {/* Planets */}
        <div className="absolute top-20 right-20 w-32 h-32 rounded-full bg-gradient-to-br from-orange-500/30 to-red-500/30 blur-3xl animate-pulse" />
        <div className="absolute bottom-40 left-20 w-48 h-48 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl animate-pulse" />
        
        {/* Shooting stars */}
        <div className="absolute top-1/4 left-0 w-2 h-2 bg-white rounded-full animate-shooting-star" />
        <div className="absolute top-3/4 right-0 w-2 h-2 bg-white rounded-full animate-shooting-star-delayed" />
      </div>

      {/* Main content */}
      <main className="relative z-10 flex flex-col p-4 sm:p-6 gap-4 lg:gap-6 min-h-screen">
        {/* Header with Space Theme */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-700">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-blue-600 to-pink-600 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-blue-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 ring-2 ring-white/20 backdrop-blur-sm transform group-hover:scale-105 transition-all duration-300"
                aria-hidden="true"
              >
                <Rocket className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-md group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400">
                  XZX
                </span>
                <span className="text-white ml-2">Space Obfuscator</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs sm:text-sm text-gray-300/90 font-medium">
                  v19.0.0 | Galactic Protection
                </p>
                {getActiveAdvancedCount() > 0 && (
                  <div className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] text-purple-300">
                    <Orbit className="w-3 h-3 inline mr-1" />
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
            {isProcessing ? (
              <Button
                onClick={cancelObfuscation}
                className="group relative bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 active:scale-[0.98] text-white shadow-xl hover:shadow-2xl shadow-red-500/40 flex-1 sm:flex-none transition-all duration-300 font-semibold hover:scale-[1.02] overflow-hidden"
              >
                <X className="w-4 h-4 mr-2 relative z-10" />
                <span className="relative z-10">Cancel</span>
              </Button>
            ) : (
              <Button
                onClick={obfuscateCode}
                disabled={!inputCode || isProcessing}
                className="group relative bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 hover:from-purple-700 hover:via-blue-700 hover:to-pink-700 active:scale-[0.98] text-white shadow-xl hover:shadow-2xl shadow-purple-500/40 flex-1 sm:flex-none transition-all duration-300 font-semibold hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <Rocket className="w-4 h-4 mr-2 relative z-10 group-hover:rotate-12 transition-transform duration-500" />
                <span className="relative z-10">{isProcessing ? "Launching..." : "Launch Obfuscation"}</span>
              </Button>
            )}
          </nav>
        </header>

        {/* Success Animation Overlay */}
        {showSuccessAnimation && (
          <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top fade-in duration-300">
            <div className="bg-gradient-to-r from-purple-500/90 via-blue-500/90 to-pink-500/90 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-2xl border border-purple-400/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <StarsIcon className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Obfuscation Complete!</p>
                <p className="text-purple-50 text-xs">Your code is now protected in space</p>
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
              <Card className="flex-1 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-pink-900/30 backdrop-blur-xl border-purple-500/30 shadow-2xl shadow-black/30 overflow-hidden flex flex-col h-full p-0 gap-0 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500 hover:shadow-purple-500/20">
                <div className="p-4 border-b border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg blur-md opacity-50"></div>
                      <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                        <Globe2 className="w-4.5 h-4.5 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <h2 id="input-code-heading" className="text-sm font-bold text-white tracking-wide">
                        Earth Code (Input)
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
              <Card className="flex-1 bg-gradient-to-br from-blue-900/30 via-pink-900/20 to-purple-900/30 backdrop-blur-xl border-blue-500/30 shadow-2xl shadow-black/30 overflow-hidden flex flex-col h-full p-0 gap-0 ring-1 ring-blue-500/20 hover:ring-blue-500/40 transition-all duration-500 hover:shadow-blue-500/20">
                <div className="p-4 border-b border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-pink-500/20 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-pink-600 rounded-lg blur-md opacity-50"></div>
                        <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-pink-600 flex items-center justify-center shadow-lg">
                          <Space className="w-4.5 h-4.5 text-white" aria-hidden="true" />
                        </div>
                      </div>
                      <div>
                        <h2 id="output-code-heading" className="text-sm font-bold text-white tracking-wide">
                          Space Code (Output)
                        </h2>
                        <p className="text-xs text-gray-400 font-medium">
                          {outputCode ? formatBytes(outputCode.length) : "Protected in space"}
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
                <Card className="bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-pink-900/30 backdrop-blur-xl border-purple-500/30 shadow-2xl shadow-black/30 p-6 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-purple-500/30">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg blur-md opacity-50"></div>
                      <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                        <Telescope className="w-4.5 h-4.5 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <h2 id="metrics-heading" className="text-sm font-bold text-white tracking-wide">
                        Galactic Metrics
                      </h2>
                      <p className="text-xs text-gray-400 font-medium">Space protection statistics</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Earth Size (Input)</span>
                        <span className="text-sm font-semibold text-white">{formatBytes(metrics.inputSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Space Size (Output)</span>
                        <span className="text-sm font-semibold text-white">{formatBytes(metrics.outputSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Space-Time Ratio</span>
                        <span className={cn("text-sm font-bold", metrics.sizeRatio > 3 ? "text-pink-400" : "text-purple-400")}>
                          {metrics.sizeRatio.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Light Years (Time)</span>
                        <span className="text-sm font-semibold text-white">{(metrics.duration / 1000).toFixed(2)}s</span>
                      </div>
                    </div>

                    <div className="border-t border-purple-500/30 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Galactic Transformations</span>
                      </div>
                      <div className="space-y-2">
                        {metrics.transformations.namesMangled > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Stars Renamed</span>
                            <span className="text-sm font-semibold text-purple-400">{metrics.transformations.namesMangled}</span>
                          </div>
                        )}
                        {metrics.transformations.stringsEncoded > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Nebulas Encrypted</span>
                            <span className="text-sm font-semibold text-pink-400">{metrics.transformations.stringsEncoded}</span>
                          </div>
                        )}
                        {metrics.transformations.numbersEncoded > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Planets Encoded</span>
                            <span className="text-sm font-semibold text-green-400">{metrics.transformations.numbersEncoded}</span>
                          </div>
                        )}
                        {metrics.transformations.deadCodeBlocks > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Black Holes</span>
                            <span className="text-sm font-semibold text-orange-400">{metrics.transformations.deadCodeBlocks}</span>
                          </div>
                        )}
                        {metrics.transformations.antiDebugChecks > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Space Shields</span>
                            <span className="text-sm font-semibold text-red-400">{metrics.transformations.antiDebugChecks}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </section>
            )}
          </div>

          {/* Settings Panel */}
          <aside className="lg:col-span-4 lg:overflow-auto" aria-labelledby="settings-heading">
            <Card className="bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-pink-900/30 backdrop-blur-xl border-purple-500/30 shadow-2xl shadow-black/30 p-6 sm:p-7 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500">
              <div className="flex items-center gap-3 mb-6 sm:mb-8 pb-5 border-b border-purple-500/30">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl blur-lg opacity-50"></div>
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                    <Orbit className="w-5.5 h-5.5 text-white" aria-hidden="true" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 id="settings-heading" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Space Controls
                  </h2>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Configure galactic protection
                  </p>
                </div>
              </div>

              <div className="space-y-7 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {/* Basic Obfuscation */}
                <div className="space-y-4">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <Star className="w-4 h-4 mr-1" /> Basic Space Operations
                  </Label>

                  {renderSwitch(
                    "mangle-names",
                    "Rename Stars",
                    "Replace variable and function names with constellation codes",
                    settings.mangleNames,
                    (checked) => {
                      setSettings({ ...settings, mangleNames: checked });
                      trackSettingsChange({ setting: "mangleNames", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "purple"
                  )}

                  {renderSwitch(
                    "encode-strings",
                    "Encrypt Nebulas",
                    "Convert strings to byte arrays using string.char()",
                    settings.encodeStrings,
                    (checked) => {
                      setSettings({ ...settings, encodeStrings: checked });
                      trackSettingsChange({ setting: "encodeStrings", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "pink"
                  )}

                  {renderSwitch(
                    "encode-numbers",
                    "Encode Planets",
                    "Transform numeric literals into mathematical expressions",
                    settings.encodeNumbers,
                    (checked) => {
                      setSettings({ ...settings, encodeNumbers: checked });
                      trackSettingsChange({ setting: "encodeNumbers", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "purple"
                  )}

                  {renderSwitch(
                    "minify",
                    "Compress Space",
                    "Remove comments and whitespace",
                    settings.minify,
                    (checked) => {
                      setSettings({ ...settings, minify: checked });
                      trackSettingsChange({ setting: "minify", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "purple"
                  )}
                </div>

                {/* Target Version */}
                <div className="space-y-4 pt-6 border-t border-purple-500/30">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <Globe className="w-4 h-4 mr-1" /> Target Galaxy
                  </Label>

                  <div className="space-y-3">
                    <Select
                      value={settings.targetVersion}
                      onValueChange={(value: any) => {
                        setSettings({ ...settings, targetVersion: value });
                      }}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50">
                        <SelectValue placeholder="Select Lua galaxy" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/20">
                        <SelectItem value="5.1">Galaxy 5.1 (Milky Way)</SelectItem>
                        <SelectItem value="5.2">Galaxy 5.2 (Andromeda)</SelectItem>
                        <SelectItem value="5.3">Galaxy 5.3 (Triangulum)</SelectItem>
                        <SelectItem value="5.4">Galaxy 5.4 (Whirlpool)</SelectItem>
                        <SelectItem value="luajit">LuaJIT (Black Hole)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400/90">Galaxy lock for compatibility</p>
                  </div>
                </div>

                {/* VM & Core Features */}
                <div className="space-y-4 pt-6 border-t border-purple-500/30">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <Cpu className="w-4 h-4 mr-1" /> Space-Time Continuum
                  </Label>

                  {renderSwitch(
                    "control-flow-flattening",
                    "Warp Space-Time",
                    "Transform code into wormhole patterns (CPU intensive)",
                    settings.controlFlowFlattening,
                    (checked) => {
                      setSettings({ ...settings, controlFlowFlattening: checked });
                      trackSettingsChange({ setting: "controlFlowFlattening", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "orange",
                    "Advanced"
                  )}

                  {renderSwitch(
                    "opaque-predicates",
                    "Black Hole Logic",
                    "Insert complex always-true/false conditions",
                    settings.opaquePredicates,
                    (checked) => {
                      setSettings({ ...settings, opaquePredicates: checked });
                      trackSettingsChange({ setting: "opaquePredicates", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "purple",
                    "Advanced"
                  )}

                  {renderSwitch(
                    "dead-code-injection",
                    "Dark Matter",
                    "Inject unreachable code blocks",
                    settings.deadCodeInjection,
                    (checked) => {
                      setSettings({ ...settings, deadCodeInjection: checked });
                      trackSettingsChange({ setting: "deadCodeInjection", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "orange",
                    "Advanced"
                  )}

                  {renderSwitch(
                    "intense-vm",
                    "Wormhole VM",
                    "Adds extra layers of processing to the VM",
                    settings.intenseVM,
                    (checked) => {
                      setSettings({ ...settings, intenseVM: checked });
                      trackSettingsChange({ setting: "intenseVM", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "purple",
                    "Advanced"
                  )}
                </div>

                {/* Anti-Analysis Features */}
                <div className="space-y-4 pt-6 border-t border-purple-500/30">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <Bug className="w-4 h-4 mr-1" /> Alien Defense
                  </Label>

                  {renderSwitch(
                    "anti-debugging",
                    "Radar Jamming",
                    "Runtime checks to detect alien debuggers",
                    settings.antiDebugging,
                    (checked) => {
                      setSettings({ ...settings, antiDebugging: checked });
                      trackSettingsChange({ setting: "antiDebugging", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "red",
                    "Advanced"
                  )}

                  {renderSwitch(
                    "anti-tamper",
                    "Force Field",
                    "Detects code modification and integrity violations",
                    settings.antiTamper,
                    (checked) => {
                      setSettings({ ...settings, antiTamper: checked });
                      trackSettingsChange({ setting: "antiTamper", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "red",
                    "Advanced"
                  )}

                  {renderSwitch(
                    "integrity-checks",
                    "Quantum Entanglement",
                    "Cryptographic hash verification of code sections",
                    settings.integrityChecks,
                    (checked) => {
                      setSettings({ ...settings, integrityChecks: checked });
                      trackSettingsChange({ setting: "integrityChecks", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "red",
                    "Advanced"
                  )}
                </div>

                {/* Environment & Optimization */}
                <div className="space-y-4 pt-6 border-t border-purple-500/30">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <HardDrive className="w-4 h-4 mr-1" /> Space Environment
                  </Label>

                  {renderSwitch(
                    "static-environment",
                    "Static Universe",
                    "Optimizes assuming environment never changes",
                    settings.staticEnvironment,
                    (checked) => {
                      setSettings({ ...settings, staticEnvironment: checked });
                      trackSettingsChange({ setting: "staticEnvironment", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "purple"
                  )}

                  {renderSwitch(
                    "disable-line-info",
                    "Hide Coordinates",
                    "Removes line information for better performance",
                    settings.disableLineInfo,
                    (checked) => {
                      setSettings({ ...settings, disableLineInfo: checked });
                      trackSettingsChange({ setting: "disableLineInfo", value: checked }).catch(err =>
                        console.error("Analytics tracking failed:", err)
                      );
                    },
                    "purple"
                  )}
                </div>

                {/* Encryption Algorithm */}
                <div className="space-y-4 pt-6 border-t border-purple-500/30">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <Key className="w-4 h-4 mr-1" /> Encryption Method
                  </Label>

                  <div className="space-y-3">
                    <Select
                      value={settings.encryptionAlgorithm}
                      onValueChange={(value: EncryptionAlgorithm) => {
                        setSettings({ ...settings, encryptionAlgorithm: value });
                      }}
                      disabled={!settings.encodeStrings || isProcessing}
                    >
                      <SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/20">
                        <SelectItem value="none">None (Basic)</SelectItem>
                        <SelectItem value="xor">XOR Cipher</SelectItem>
                        <SelectItem value="base64">Base64</SelectItem>
                        <SelectItem value="huffman">Huffman</SelectItem>
                        <SelectItem value="chunked">Chunked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Optimization Level */}
                <div className="space-y-4 pt-6 border-t border-purple-500/30">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <Hash className="w-4 h-4 mr-1" /> Warp Speed
                  </Label>

                  <div className="space-y-3">
                    <Select
                      value={settings.optimizationLevel.toString()}
                      onValueChange={(value: string) => {
                        setSettings({ ...settings, optimizationLevel: parseInt(value) as 0 | 1 | 2 | 3 });
                      }}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50">
                        <SelectValue placeholder="Select warp factor" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/20">
                        <SelectItem value="0">Warp 0 (No optimization)</SelectItem>
                        <SelectItem value="1">Warp 1 (Basic)</SelectItem>
                        <SelectItem value="2">Warp 2 (Aggressive)</SelectItem>
                        <SelectItem value="3">Warp 3 (Maximum)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Output Formatting */}
                <div className="space-y-4 pt-6 border-t border-purple-500/30">
                  <Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                    <Eye className="w-4 h-4 mr-1" /> Viewing Angle
                  </Label>

                  <div className="space-y-3">
                    <Select
                      value={settings.formattingStyle}
                      onValueChange={(value: FormattingStyle) => {
                        setSettings({ ...settings, formattingStyle: value });
                      }}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/20">
                        <SelectItem value="minified">Minified (Compact Star)</SelectItem>
                        <SelectItem value="pretty">Pretty (Nebula)</SelectItem>
                        <SelectItem value="obfuscated">Obfuscated (Black Hole)</SelectItem>
                        <SelectItem value="single-line">Single Line (Wormhole)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Protection Level Slider */}
                <div className="space-y-5 pt-6 border-t border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="compression"
                      className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5"
                    >
                      <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                      Galactic Protection Level
                    </Label>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-bold text-xs backdrop-blur-sm border transition-all duration-300",
                          protectionStrength === "none" && "bg-gray-500/20 border-gray-500/30 text-gray-300",
                          protectionStrength === "low" && "bg-purple-500/20 border-purple-500/30 text-purple-300",
                          protectionStrength === "medium" && "bg-blue-500/20 border-blue-500/30 text-blue-300",
                          protectionStrength === "high" && "bg-orange-500/20 border-orange-500/30 text-orange-300",
                          protectionStrength === "maximum" && "bg-red-500/20 border-red-500/30 text-red-300 animate-pulse"
                        )}
                      >
                        {settings.compressionLevel}%
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <Slider
                      id="compression"
                      value={[settings.compressionLevel]}
                      onValueChange={value => {
                        const level = value[0];
                        setSettings({
                          ...settings,
                          compressionLevel: level,
                          minify: level >= 10,
                          mangleNames: level >= 20,
                          encodeStrings: level >= 30,
                          encodeNumbers: level >= 40,
                          controlFlow: level >= 50,
                          encryptionAlgorithm: level >= 60 ? "xor" : "none",
                          deadCodeInjection: level >= 65,
                          controlFlowFlattening: level >= 70,
                          intenseVM: level >= 75,
                          antiDebugging: level >= 80,
                          opaquePredicates: level >= 80,
                          virtualization: level >= 85,
                          bytecodeEncryption: level >= 85,
                          antiTamper: level >= 90,
                          selfModifying: level >= 90,
                          mutation: level >= 90,
                          codeSplitting: level >= 90,
                          environmentLock: level >= 90,
                          integrityChecks: level >= 95,
                          optimizationLevel: level >= 90 ? 3 : level >= 70 ? 2 : level >= 40 ? 1 : 0,
                        });
                      }}
                      max={100}
                      step={5}
                      disabled={isProcessing}
                      className="w-full"
                    />
                  </div>
                  <div
                    className={cn(
                      "text-xs rounded-xl p-4 backdrop-blur-sm border transition-all duration-300",
                      protectionStrength === "none" && "bg-gray-500/10 border-gray-500/20 text-gray-300",
                      protectionStrength === "low" && "bg-purple-500/10 border-purple-500/20 text-purple-200",
                      protectionStrength === "medium" && "bg-blue-500/10 border-blue-500/20 text-blue-200",
                      protectionStrength === "high" && "bg-orange-500/10 border-orange-500/20 text-orange-200",
                      protectionStrength === "maximum" && "bg-red-500/10 border-red-500/20 text-red-200"
                    )}
                  >
                    {settings.compressionLevel < 30 && "Standard Star"}
                    {settings.compressionLevel >= 30 && settings.compressionLevel < 60 && "Enhanced Nebula"}
                    {settings.compressionLevel >= 60 && settings.compressionLevel < 80 && "Advanced Galaxy"}
                    {settings.compressionLevel >= 80 && settings.compressionLevel < 95 && "Maximum Wormhole"}
                    {settings.compressionLevel >= 95 && "Ultimate Black Hole"}
                  </div>
                </div>

                {/* Warnings */}
                {settings.gcFixes && (
                  <div className="pt-2">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                      <p className="text-xs text-yellow-200/90">
                        <strong className="font-bold block mb-1">⚠️ Space-Time Warning</strong>
                        GC Fixes enabled - Heavy gravity cost
                      </p>
                    </div>
                  </div>
                )}

                {settings.hardcodeGlobals && (
                  <div className="pt-2">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                      <p className="text-xs text-yellow-200/90">
                        <strong className="font-bold block mb-1">⚠️ Cosmic Warning</strong>
                        Hardcode Globals exposes star names
                      </p>
                    </div>
                  </div>
                )}

                {(settings.virtualization || settings.intenseVM) && (
                  <div className="pt-2">
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                      <p className="text-xs text-purple-200/90">
                        <strong className="font-bold block mb-1">⚡ Wormhole Active</strong>
                        Maximum protection enabled - code is warped
                      </p>
                    </div>
                  </div>
                )}

                {/* Large file warning */}
                {inputCode.length > 1000000 && (
                  <div className="pt-2">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-blue-200">
                        <Database className="w-4 h-4" />
                        <p className="text-xs">
                          <strong className="font-bold block mb-1">📡 Large Galaxy Detected</strong>
                          File size: {formatBytes(inputCode.length)}. Processing may take longer.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
                Space Disturbance
                <span className="px-2 py-0.5 bg-red-500/20 rounded-md text-xs">Critical</span>
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
                Space Weather Alert
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
            <span className="text-sm text-gray-400 font-mono">v19.0.0</span>
            <span className="text-sm text-gray-400">Launched by</span>
            <a
              href="https://discord.gg/5q5bEKmYqF"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-purple-400 hover:text-pink-400 font-mono transition-colors duration-200 hover:underline"
            >
              XZX Space Command
            </a>
            <span className="text-sm text-gray-400">x</span>
            <a
              href="https://billchirico.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-pink-400 hover:text-purple-400 font-mono transition-colors duration-200 hover:underline"
            >
              Mission Control
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
          background: linear-gradient(135deg, #8b5cf6, #3b82f6, #ec4899);
          border-radius: 10px;
        }
        
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        
        @keyframes shooting-star {
          0% {
            transform: translateX(-100px) translateY(0) rotate(45deg);
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 100px)) translateY(calc(100vh + 100px)) rotate(45deg);
            opacity: 0;
          }
        }
        
        .animate-shooting-star {
          animation: shooting-star 3s linear infinite;
        }
        
        .animate-shooting-star-delayed {
          animation: shooting-star 4s linear infinite;
          animation-delay: 2s;
        }
      `}</style>
    </>
  );
}
