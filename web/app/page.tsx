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
  MessageCircle,
  Award,
  Users,
  ExternalLink,
  Moon,
  Sun,
  TrendingUp,
} from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";
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

// Import the counter API
import { getTotalObfuscations, incrementTotalObfuscations } from "@/lib/counter-api";

const DEFAULT_LUA_CODE = `-- Welcome to XZX Obfuscator
-- Paste your Lua code below
-- Example:

local function calculateScore(basePoints, multiplier)
  local maxScore = 1000
  local result = basePoints * multiplier
  
  if result > maxScore then
    result = maxScore
  end
  
  return result
end

print("Score: " .. calculateScore(100, 5))`;

const OUTPUT_HEADER = "-- PROTECTED USING XZX OBFUSCATOR V2 [https://discord.gg/5q5bEKmYqF]\n\n";

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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [obfuscationCount, setObfuscationCount] = useState(0);
  const [totalObfuscations, setTotalObfuscations] = useState(150); // Start at 150
  const [pageStartTime] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);

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

  // Fetch total obfuscations on mount
  useEffect(() => {
    const fetchTotal = async () => {
      try {
        const count = await getTotalObfuscations();
        setTotalObfuscations(count);
      } catch (error) {
        console.error('Failed to fetch total obfuscations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTotal();
  }, []);

  useEffect(() => {
    document.title = "XZX Lua Obfuscator - Advanced Protection";
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

      // Use setTimeout to prevent UI blocking
      const result = await new Promise<any>((resolve) => {
        setTimeout(() => {
          try {
            resolve(obfuscateLua(inputCode, options));
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        }, 100);
      });

      const duration = Date.now() - startTime;

      if (result.success && result.code) {
        const finalCode = OUTPUT_HEADER + result.code;
        setOutputCode(finalCode);
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

        // Increment local count
        setObfuscationCount(prev => prev + 1);
        
        // Increment global count
        try {
          const newTotal = await incrementTotalObfuscations();
          setTotalObfuscations(newTotal);
        } catch (error) {
          console.error('Failed to increment global count:', error);
          // Fallback: increment locally
          setTotalObfuscations(prev => prev + 1);
        }

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

        const newCount = obfuscationCount + 1;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
            <div className="relative w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">XZX Obfuscator</h2>
          <p className="text-gray-400">Loading advanced protection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.15),transparent_50%)]"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
          }}
        />
        <div 
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(236,72,153,0.1),transparent_50%)]"
          style={{
            transform: `translate(${mousePosition.x * -0.01}px, ${mousePosition.y * -0.01}px)`,
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="fixed inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
      }} />

      <div className="relative z-10">
        <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-50"></div>
                  <div className="relative w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  XZX
                </span>
                <span className="text-xs px-2 py-1 bg-purple-600/20 rounded-full text-purple-300 border border-purple-600/30 flex items-center gap-2">
                  V2
                  <Users className="w-3 h-3 text-purple-400" />
                  {totalObfuscations.toLocaleString()}+
                </span>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="https://discord.gg/5q5bEKmYqF"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] rounded-md transition-colors group text-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Discord</span>
                  <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </a>

                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                XZX Lua Obfuscator
              </h1>
              <p className="text-gray-400 mt-1">Advanced protection for your Lua code</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">{totalObfuscations.toLocaleString()}+ scripts protected</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <Award className="w-4 h-4 text-pink-400" />
                <span className="text-sm text-gray-300">Advanced protection</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-400">Input</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                      className="border-white/10 hover:bg-white/5"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                    <Button
                      onClick={obfuscateCode}
                      disabled={!inputCode || isProcessing}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-4 py-2 rounded-lg relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      {isProcessing ? (
                        <div className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Shield className="w-4 h-4 mr-2" />
                          Obfuscate
                        </div>
                      )}
                    </Button>
                    {fileName && (
                      <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full">
                        <File className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-purple-300">{fileName}</span>
                        <button onClick={clearFile} className="hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-[400px]">
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

              {outputCode && (
                <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                      <span className="text-sm text-gray-400">Output</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={copyToClipboard}
                        variant="outline"
                        size="sm"
                        className="border-white/10 hover:bg-white/5"
                      >
                        {copySuccess ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={downloadCode}
                        variant="outline"
                        size="sm"
                        className="border-white/10 hover:bg-white/5"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="h-[400px]">
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
              )}

              {metrics && (
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Protection Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Input Size</div>
                      <div className="text-xl font-bold">{formatBytes(metrics.inputSize)}</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Output Size</div>
                      <div className="text-xl font-bold">{formatBytes(metrics.outputSize)}</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Ratio</div>
                      <div className="text-xl font-bold text-purple-400">{metrics.sizeRatio.toFixed(2)}x</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Time</div>
                      <div className="text-xl font-bold">{(metrics.duration / 1000).toFixed(2)}s</div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {Object.entries(metrics.transformations).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <span className="text-sm text-gray-400 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-sm font-semibold text-purple-400">{value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div className="lg:col-span-4">
              <Card className="sticky top-24 border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Settings</h3>
                    <div className="px-3 py-1 bg-purple-600/20 rounded-full text-xs text-purple-300">
                      {getActiveAdvancedCount()} active
                    </div>
                  </div>
                </div>

                <div className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
                  <div className="space-y-4 mb-8">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Basic</h4>
                    {renderSwitch(
                      "mangle-names",
                      "Mangle Names",
                      "Replace identifiers with random hex strings",
                      settings.mangleNames,
                      (checked) => {
                        setSettings({ ...settings, mangleNames: checked });
                        trackSettingsChange({ setting: "mangleNames", value: checked }).catch(err =>
                          console.error("Analytics tracking failed:", err)
                        );
                      }
                    )}
                    {renderSwitch(
                      "encode-strings",
                      "Encode Strings",
                      "Convert strings to encrypted byte arrays",
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
                      "Encode Numbers",
                      "Transform numbers into complex expressions",
                      settings.encodeNumbers,
                      (checked) => {
                        setSettings({ ...settings, encodeNumbers: checked });
                        trackSettingsChange({ setting: "encodeNumbers", value: checked }).catch(err =>
                          console.error("Analytics tracking failed:", err)
                        );
                      }
                    )}
                    {renderSwitch(
                      "minify",
                      "Minify",
                      "Remove whitespace and comments",
                      settings.minify,
                      (checked) => {
                        setSettings({ ...settings, minify: checked });
                        trackSettingsChange({ setting: "minify", value: checked }).catch(err =>
                          console.error("Analytics tracking failed:", err)
                        );
                      }
                    )}
                  </div>

                  <div className="space-y-
