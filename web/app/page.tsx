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
  Upload,
  File,
  X,
  Shield,
  Zap,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Award,
  TrendingUp,
  MessageCircle,
  ExternalLink,
  Moon,
  Sun,
  WifiOff,
  Bug,
  Code,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sparkles,
  Skull,
  Flame,
  ZapOff,
  RefreshCw,
  DownloadCloud,
  UploadCloud,
  Layers,
  Box,
  Boxes,
  GitBranch,
  GitMerge,
  Workflow,
  PieChart,
  BarChart,
  LineChart,
  Activity,
  CheckCheck,
  XCircle,
  HelpCircle,
  Info,
  AlertOctagon,
} from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { obfuscateLua } from "@/lib/obfuscator";
import { XZXReverseEngineer } from "@/lib/reverse-engineer";

// Simple counter API without Firebase
const getTotalObfuscations = async (): Promise<number> => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('xzx-total-obfuscations');
      return stored ? parseInt(stored, 10) : 150;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
  }
  return 150;
};

const incrementTotalObfuscations = async (): Promise<number> => {
  if (typeof window !== 'undefined') {
    try {
      const current = await getTotalObfuscations();
      const newCount = current + 1;
      localStorage.setItem('xzx-total-obfuscations', newCount.toString());
      return newCount;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }
  return 151;
};

// Types
interface ObfuscationMetrics {
  inputSize: number;
  outputSize: number;
  duration: number;
  instructionCount: number;
  buildId: string;
  layersApplied: string[];
}

interface ObfuscationProgress {
  stage: string;
  percent: number;
  currentStep: number;
  totalSteps: number;
}

interface ObfuscatorSettings {
  mangleNames: boolean;
  encodeStrings: boolean;
  encodeNumbers: boolean;
  minify: boolean;
  compressionLevel: number;
  encryptionAlgorithm: string;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  antiDebugging: boolean;
  formattingStyle: string;
  targetVersion: string;
  optimizationLevel: number;
  useVM: boolean;
}

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

export default function Home() {
  const [inputCode, setInputCode] = useState(DEFAULT_LUA_CODE);
  const [outputCode, setOutputCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [metrics, setMetrics] = useState<ObfuscationMetrics | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [totalObfuscations, setTotalObfuscations] = useState(150);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<ObfuscationProgress | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reverse engineering mode
  const [reverseMode, setReverseMode] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [settings, setSettings] = useState<ObfuscatorSettings>({
    mangleNames: true,
    encodeStrings: true,
    encodeNumbers: true,
    minify: true,
    compressionLevel: 50,
    encryptionAlgorithm: "xor",
    controlFlowFlattening: false,
    deadCodeInjection: true,
    antiDebugging: false,
    formattingStyle: "minified",
    targetVersion: "5.1",
    optimizationLevel: 2,
    useVM: true,
  });

  // Load total obfuscations on mount
  useEffect(() => {
    const loadTotal = async () => {
      try {
        const total = await getTotalObfuscations();
        setTotalObfuscations(total);
      } catch (error) {
        console.error('Failed to load total:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTotal();
  }, []);

  // Timer for obfuscation
  useEffect(() => {
    if (isProcessing) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setElapsedTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isProcessing]);

  // Connection monitoring
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    document.title = reverseMode 
      ? "XZX Reverse Engineer - Advanced Code Analysis" 
      : "XZX Lua Obfuscator - Advanced Protection";
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMouseMove);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [reverseMode]);

  const handleInputChange = (newCode: string) => {
    setInputCode(newCode);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      setWarning(`File size: ${fileSizeMB.toFixed(2)}MB. Large files may take longer.`);
    }
    
    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setInputCode(content);
      
      if (content.length > 50000) {
        setWarning("Large file detected. Consider reducing protection level for better performance.");
      }
    };
    
    reader.readAsText(file);
  };

  const triggerFileUpload = () => fileInputRef.current?.click();

  const clearFile = () => {
    setFileName("");
    setInputCode(DEFAULT_LUA_CODE);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelObfuscation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setProgress(null);
    setElapsedTime(0);
  };

  const performObfuscation = async () => {
    abortControllerRef.current = new AbortController();
    
    try {
      const options = {
        mangleNames: settings.mangleNames,
        encodeStrings: settings.encodeStrings,
        encodeNumbers: settings.encodeNumbers,
        protectionLevel: settings.compressionLevel,
        deadCodeInjection: settings.deadCodeInjection,
        controlFlowFlattening: settings.controlFlowFlattening,
        targetVersion: settings.targetVersion,
        optimizationLevel: settings.optimizationLevel,
        encryptionAlgorithm: settings.encryptionAlgorithm,
        formattingStyle: settings.formattingStyle,
        useVM: settings.useVM,
      };
      
      const result = await obfuscateLua(inputCode, options);
      
      setProgress({ stage: "Finalizing", percent: 100, currentStep: 5, totalSteps: 5 });
      
      if (result.success && result.code) {
        const finalCode = OUTPUT_HEADER + result.code;
        setOutputCode(finalCode);
        setMetrics(result.metrics || null);
        
        try {
          const newTotal = await incrementTotalObfuscations();
          setTotalObfuscations(newTotal);
        } catch (error) {
          console.error('Failed to increment counter:', error);
        }
      } else {
        setError(result.error || "Failed to obfuscate code");
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Cancelled') {
        setError("Obfuscation cancelled");
      } else {
        setError(error instanceof Error ? error.message : "Unknown error occurred");
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  const obfuscateCode = async () => {
    if (isOffline) {
      setError("You are offline. Please check your internet connection.");
      return;
    }

    if (!inputCode || inputCode.trim().length === 0) {
      setError("Please enter some code to obfuscate");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCopySuccess(false);
    setMetrics(null);
    setWarning(null);
    setOutputCode("");
    
    setProgress({ stage: "Initializing", percent: 5, currentStep: 1, totalSteps: 5 });
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (!prev || prev.percent >= 90) return prev;
        return {
          ...prev,
          percent: Math.min(prev.percent + 5, 90),
          stage: prev.percent < 30 ? "Analyzing" : 
                 prev.percent < 60 ? "Obfuscating" : "Optimizing"
        };
      });
    }, 500);
    
    await performObfuscation();
    
    clearInterval(progressInterval);
  };

  const analyzeCode = async () => {
    if (!inputCode && !outputCode) {
      setError("No code to analyze");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const engineer = new XZXReverseEngineer();
      const codeToAnalyze = outputCode || inputCode;
      const result = await engineer.analyze(codeToAnalyze);
      
      setAnalysisResult(result);
      setShowAnalysis(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(outputCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  };

  const downloadCode = () => {
    const blob = new Blob([outputCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? `obfuscated_${fileName.replace(/\.lua$/, '')}.lua` : "obfuscated.lua";
    a.click();
    URL.revokeObjectURL(url);
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
    if (settings.controlFlowFlattening) count++;
    if (settings.deadCodeInjection) count++;
    if (settings.antiDebugging) count++;
    if (settings.useVM) count++;
    return count;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      <div className="flex items-center justify-between group hover:bg-gray-800/50 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
        <Label htmlFor={id} className="text-sm font-semibold text-gray-200 cursor-pointer flex-1">
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {badge && <span className={`text-[10px] ${badge === 'Advanced' ? 'text-purple-400 bg-purple-500/10' : 'text-yellow-400 bg-yellow-500/10'} px-1.5 py-0.5 rounded`}>{badge}</span>}
            {checked && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
          </div>
          <p className="text-xs text-gray-400 mt-1 font-normal leading-relaxed">{description}</p>
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-900 text-gray-100">
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
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10">
        <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-gray-800 bg-gray-900/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-50"></div>
                  <div className="relative w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    {reverseMode ? (
                      <Bug className="w-4 h-4 text-white" />
                    ) : (
                      <Shield className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  XZX
                </span>
                <span className="text-xs px-2 py-1 bg-purple-600/20 rounded-full text-purple-300 border border-purple-600/30 flex items-center gap-2">
                  {reverseMode ? "RE" : "V2"}
                  <Users className="w-3 h-3 text-purple-400" />
                  {totalObfuscations.toLocaleString()}+
                </span>
              </div>

              <div className="flex items-center gap-3">
                {isOffline && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 rounded-full">
                    <WifiOff className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs text-yellow-300">Offline</span>
                  </div>
                )}

                <button
                  onClick={() => setReverseMode(!reverseMode)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-sm",
                    reverseMode 
                      ? "bg-red-600 hover:bg-red-700 text-white" 
                      : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                  )}
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>{reverseMode ? "REVERSE MODE ON" : "REVERSE MODE"}</span>
                </button>

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
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
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
                {reverseMode ? "XZX Reverse Engineer" : "XZX Lua Obfuscator"}
              </h1>
              <p className="text-gray-400 mt-1">
                {reverseMode 
                  ? "Advanced code analysis and reverse engineering toolkit" 
                  : "Advanced protection for your Lua code"}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">{totalObfuscations.toLocaleString()}+ scripts processed</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700">
                {reverseMode ? (
                  <Bug className="w-4 h-4 text-red-400" />
                ) : (
                  <Award className="w-4 h-4 text-pink-400" />
                )}
                <span className="text-sm text-gray-300">
                  {reverseMode ? "Analysis Mode" : "Advanced protection"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Card className="overflow-hidden border border-gray-700 bg-gray-800/50 backdrop-blur-xl">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
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
                      className="border-gray-700 hover:bg-gray-700"
                      disabled={isProcessing}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {reverseMode ? (
                        <Button
                          onClick={analyzeCode}
                          disabled={!inputCode || isProcessing}
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg relative overflow-hidden group min-w-[120px]"
                        >
                          {isProcessing ? (
                            <div className="flex items-center justify-center">
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <Bug className="w-4 h-4 mr-2" />
                              Analyze
                            </div>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={obfuscateCode}
                          disabled={!inputCode || isProcessing || isOffline}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-4 py-2 rounded-lg relative overflow-hidden group min-w-[120px]"
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
                      )}
                      
                      {isProcessing && (
                        <Button
                          onClick={cancelObfuscation}
                          variant="outline"
                          size="sm"
                          className="border-gray-700 hover:bg-gray-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      )}
                    </div>

                    {fileName && (
                      <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full">
                        <File className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-purple-300 truncate max-w-[100px]">{fileName}</span>
                        <button onClick={clearFile} className="hover:text-white" disabled={isProcessing}>
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

              {isProcessing && progress && (
                <Card className="border border-gray-700 bg-gray-800/50 backdrop-blur-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {reverseMode ? "Analysis Progress" : "Obfuscation Progress"}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">{formatTime(elapsedTime)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">{progress.stage}</span>
                      <span className="text-sm font-semibold text-purple-400">{progress.percent}%</span>
                    </div>
                    
                    <Progress value={progress.percent} className="h-2 bg-gray-700" />
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Step {progress.currentStep} of {progress.totalSteps}</span>
                      <span>Estimated: {formatTime(Math.round((elapsedTime / progress.percent) * (100 - progress.percent)))}</span>
                    </div>
                  </div>
                </Card>
              )}

              {!reverseMode && outputCode && (
                <Card className="overflow-hidden border border-gray-700 bg-gray-800/50 backdrop-blur-xl">
                  <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                      <span className="text-sm text-gray-400">Output</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={copyToClipboard}
                        variant="outline"
                        size="sm"
                        className="border-gray-700 hover:bg-gray-700"
                        disabled={isProcessing}
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
                        className="border-gray-700 hover:bg-gray-700"
                        disabled={isProcessing}
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

              {!reverseMode && metrics && (
                <Card className="border border-gray-700 bg-gray-800/50 backdrop-blur-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Protection Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Input Size</div>
                      <div className="text-xl font-bold">{formatBytes(metrics.inputSize)}</div>
                    </div>
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Output Size</div>
                      <div className="text-xl font-bold">{formatBytes(metrics.outputSize)}</div>
                    </div>
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Ratio</div>
                      <div className="text-xl font-bold text-purple-400">{(metrics.outputSize / metrics.inputSize).toFixed(2)}x</div>
                    </div>
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <div className="text-sm text-gray-400 mb-1">Time</div>
                      <div className="text-xl font-bold">{metrics.duration.toFixed(1)}s</div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Applied Layers</h4>
                    <div className="flex flex-wrap gap-2">
                      {metrics.layersApplied.map((layer: string) => (
                        <span key={layer} className="px-2 py-1 bg-purple-500/20 rounded-full text-xs text-purple-300">
                          {layer}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <div className="lg:col-span-4">
              <Card className="sticky top-24 border border-gray-700 bg-gray-800/50 backdrop-blur-xl">
                <div className="p-6 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {reverseMode ? "Analysis Settings" : "Protection Settings"}
                    </h3>
                    {!reverseMode && (
                      <div className="px-3 py-1 bg-purple-600/20 rounded-full text-xs text-purple-300">
                        {getActiveAdvancedCount()} active
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {reverseMode ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-700/30 rounded-xl">
                        <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                          <Bug className="w-4 h-4" />
                          Analysis Features
                        </h4>
                        <ul className="space-y-2 text-sm text-gray-300">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            Function extraction
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            String decryption
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            Bytecode analysis
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            Control flow visualization
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            Metadata extraction
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            Complexity metrics
                          </li>
                        </ul>
                      </div>

                      <div className="p-4 bg-gray-700/30 rounded-xl">
                        <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Supported Obfuscators
                        </h4>
                        <ul className="space-y-1 text-sm text-gray-300">
                          <li>• XZX Obfuscator</li>
                          <li>• Luraph</li>
                          <li>• IronBrew</li>
                          <li>• Synapse</li>
                          <li>• MoonSec</li>
                          <li>• Custom VM-based</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 mb-8">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Basic</h4>
                        {renderSwitch(
                          "mangle-names",
                          "Mangle Names",
                          "Replace identifiers with random strings",
                          settings.mangleNames,
                          (checked) => setSettings({ ...settings, mangleNames: checked })
                        )}
                        {renderSwitch(
                          "encode-strings",
                          "Encode Strings",
                          "Convert strings to encrypted byte arrays",
                          settings.encodeStrings,
                          (checked) => setSettings({ ...settings, encodeStrings: checked }),
                          "pink"
                        )}
                        {renderSwitch(
                          "encode-numbers",
                          "Encode Numbers",
                          "Transform numbers into expressions",
                          settings.encodeNumbers,
                          (checked) => setSettings({ ...settings, encodeNumbers: checked })
                        )}
                        {renderSwitch(
                          "minify",
                          "Minify",
                          "Remove whitespace and comments",
                          settings.minify,
                          (checked) => setSettings({ ...settings, minify: checked })
                        )}
                      </div>

                      <div className="space-y-4 mb-8">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Advanced</h4>
                        {renderSwitch(
                          "dead-code",
                          "Dead Code Injection",
                          "Inject unreachable code blocks",
                          settings.deadCodeInjection,
                          (checked) => setSettings({ ...settings, deadCodeInjection: checked }),
                          "orange",
                          "Advanced"
                        )}
                        {renderSwitch(
                          "control-flow",
                          "Control Flow Flattening",
                          "Transform into state machine",
                          settings.controlFlowFlattening,
                          (checked) => setSettings({ ...settings, controlFlowFlattening: checked }),
                          "purple",
                          "Advanced"
                        )}
                        {renderSwitch(
                          "anti-debug",
                          "Anti-Debugging",
                          "Runtime debugger detection",
                          settings.antiDebugging,
                          (checked) => setSettings({ ...settings, antiDebugging: checked }),
                          "red",
                          "Advanced"
                        )}
                        {renderSwitch(
                          "use-vm",
                          "Virtual Machine",
                          "Wrap code in custom VM",
                          settings.useVM,
                          (checked) => setSettings({ ...settings, useVM: checked }),
                          "blue",
                          "Advanced"
                        )}
                      </div>

                      <div className="space-y-4 mb-8">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Target</h4>
                        <Select
                          value={settings.targetVersion}
                          onValueChange={(value: string) => setSettings({ ...settings, targetVersion: value })}
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="w-full bg-gray-700/50 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5.1">Lua 5.1</SelectItem>
                            <SelectItem value="5.2">Lua 5.2</SelectItem>
                            <SelectItem value="5.3">Lua 5.3</SelectItem>
                            <SelectItem value="5.4">Lua 5.4</SelectItem>
                            <SelectItem value="luajit">LuaJIT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-4 mb-8">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Optimization</h4>
                        <Select
                          value={settings.optimizationLevel.toString()}
                          onValueChange={(value: string) => setSettings({ ...settings, optimizationLevel: parseInt(value) as 0 | 1 | 2 | 3 })}
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="w-full bg-gray-700/50 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Level 0 (None)</SelectItem>
                            <SelectItem value="1">Level 1 (Basic)</SelectItem>
                            <SelectItem value="2">Level 2 (Aggressive)</SelectItem>
                            <SelectItem value="3">Level 3 (Maximum)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-4 mb-8">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Encryption</h4>
                        <Select
                          value={settings.encryptionAlgorithm}
                          onValueChange={(value: string) => setSettings({ ...settings, encryptionAlgorithm: value })}
                          disabled={!settings.encodeStrings || isProcessing}
                        >
                          <SelectTrigger className="w-full bg-gray-700/50 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="xor">XOR</SelectItem>
                            <SelectItem value="base64">Base64</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-8 pt-8 border-t border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium">Protection Level</span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium",
                            protectionStrength === "none" && "bg-gray-600/20 text-gray-300",
                            protectionStrength === "low" && "bg-purple-500/20 text-purple-300",
                            protectionStrength === "medium" && "bg-pink-500/20 text-pink-300",
                            protectionStrength === "high" && "bg-orange-500/20 text-orange-300",
                            protectionStrength === "maximum" && "bg-red-500/20 text-red-300 animate-pulse"
                          )}>
                            {settings.compressionLevel}%
                          </span>
                        </div>
                        <Slider
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
                              deadCodeInjection: level >= 65,
                              controlFlowFlattening: level >= 70,
                              antiDebugging: level >= 80,
                              useVM: level >= 85,
                              optimizationLevel: level >= 90 ? 3 : level >= 70 ? 2 : level >= 40 ? 1 : 0,
                            });
                          }}
                          max={100}
                          step={5}
                          className="w-full"
                          disabled={isProcessing}
                        />
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {warning && !error && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <p className="text-sm text-yellow-300">{warning}</p>
            </div>
          )}

          <footer className="mt-12 pt-8 border-t border-gray-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-400">
                © 2026 XZX HUB. All rights reserved.
              </div>
              
              <div className="text-sm text-gray-400">
                All modules built by Bill Chirico
              </div>
              
              <div className="flex items-center gap-4">
                <a
                  href="https://discord.gg/5q5bEKmYqF"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 rounded-lg transition-colors group"
                >
                  <MessageCircle className="w-4 h-4 text-[#5865F2]" />
                  <span className="text-sm">Join our Discord</span>
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Analysis Dialog */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-red-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              <Bug className="w-6 h-6 text-red-400" />
              Reverse Engineering Analysis
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Detailed analysis of the obfuscated code
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-6 mb-4 bg-gray-800">
              <TabsTrigger value="overview" className="data-[state=active]:bg-red-600">Overview</TabsTrigger>
              <TabsTrigger value="strings" className="data-[state=active]:bg-red-600">Strings</TabsTrigger>
              <TabsTrigger value="functions" className="data-[state=active]:bg-red-600">Functions</TabsTrigger>
              <TabsTrigger value="bytecode" className="data-[state=active]:bg-red-600">Bytecode</TabsTrigger>
              <TabsTrigger value="metadata" className="data-[state=active]:bg-red-600">Metadata</TabsTrigger>
              <TabsTrigger value="flow" className="data-[state=active]:bg-red-600">Control Flow</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px] pr-4">
              {analysisResult && (
                <>
                  <TabsContent value="overview" className="space-y-6">
                    {/* Metrics */}
                    {analysisResult.metrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-800/50 rounded-xl">
                          <div className="text-sm text-gray-400 mb-1">Duration</div>
                          <div className="text-xl font-bold text-red-400">{analysisResult.metrics.duration.toFixed(2)}s</div>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-xl">
                          <div className="text-sm text-gray-400 mb-1">Functions</div>
                          <div className="text-xl font-bold text-red-400">{analysisResult.metrics.functions}</div>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-xl">
                          <div className="text-sm text-gray-400 mb-1">Strings</div>
                          <div className="text-xl font-bold text-red-400">{analysisResult.metrics.strings}</div>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-xl">
                          <div className="text-sm text-gray-400 mb-1">Complexity</div>
                          <div className="text-xl font-bold text-red-400">{analysisResult.metrics.complexity}</div>
                        </div>
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-800/30 rounded-xl">
                        <div className="text-xs text-gray-500 mb-1">VM Detected</div>
                        <div className="text-lg font-semibold text-green-400">
                          {analysisResult.data?.vm?.data?.instructions?.length > 0 ? "Yes" : "No"}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-800/30 rounded-xl">
                        <div className="text-xs text-gray-500 mb-1">Encrypted Strings</div>
                        <div className="text-lg font-semibold text-yellow-400">
                          {analysisResult.data?.strings?.data?.matches?.length || 0}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-800/30 rounded-xl">
                        <div className="text-xs text-gray-500 mb-1">Decrypted Strings</div>
                        <div className="text-lg font-semibold text-green-400">
                          {analysisResult.data?.strings?.data?.decrypted?.length || 0}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="strings" className="space-y-4">
                    {analysisResult.data?.strings?.data?.decrypted && analysisResult.data.strings.data.decrypted.length > 0 ? (
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-red-400">Decrypted Strings</h3>
                        <div className="p-4 bg-gray-800/30 rounded-xl">
                          {analysisResult.data.strings.data.decrypted.map((str: string, i: number) => (
                            <div key={i} className="text-sm text-gray-300 mb-2 border-b border-gray-700 pb-2 font-mono">
                              "{str}"
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">No strings found</div>
                    )}
                  </TabsContent>

                  <TabsContent value="functions" className="space-y-4">
                    {analysisResult.data?.decompiled?.data?.functions && analysisResult.data.decompiled.data.functions.length > 0 ? (
                      <div className="space-y-4">
                        {analysisResult.data.decompiled.data.functions.map((fn: any, i: number) => (
                          <div key={i} className="p-4 bg-gray-800/30 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-lg font-semibold text-purple-400">{fn.name}</div>
                              <Badge variant="outline" className="border-red-500 text-red-400">
                                Complexity: {fn.complexity}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                              <div className="text-gray-400">Parameters:</div>
                              <div className="text-gray-300">{fn.params.join(', ') || 'none'}</div>
                              <div className="text-gray-400">Lines:</div>
                              <div className="text-gray-300">{fn.lines.start}-{fn.lines.end}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">No functions found</div>
                    )}
                  </TabsContent>

                  <TabsContent value="bytecode" className="space-y-4">
                    {analysisResult.data?.vm?.data?.instructions && analysisResult.data.vm.data.instructions.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {analysisResult.data.vm.data.instructions.slice(0, 20).map((instr: any) => (
                          <div key={instr.index} className="text-xs bg-gray-900/50 p-2 rounded border border-gray-700">
                            <span className="text-purple-400">[{instr.index}]</span>{' '}
                            <span className="text-red-400">{instr.decoded}</span>{' '}
                            <span className="text-gray-500">({instr.opcode})</span>
                          </div>
                        ))}
                        {analysisResult.data.vm.data.instructions.length > 20 && (
                          <div className="col-span-4 text-center text-gray-500 text-sm">
                            ... and {analysisResult.data.vm.data.instructions.length - 20} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">No bytecode found</div>
                    )}
                  </TabsContent>

                  <TabsContent value="metadata" className="space-y-4">
                    {analysisResult.data?.metadata?.data && (
                      <div className="p-4 bg-gray-800/30 rounded-xl">
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                          {JSON.stringify(analysisResult.data.metadata.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="flow" className="space-y-4">
                    <div className="p-4 bg-gray-800/30 rounded-xl">
                      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                        {analysisResult.data?.flow?.data?.nodes?.length > 0 
                          ? `Found ${analysisResult.data.flow.data.nodes.length} nodes and ${analysisResult.data.flow.data.edges?.length || 0} edges`
                          : "No control flow data available"}
                      </pre>
                    </div>
                  </TabsContent>
                </>
              )}
            </ScrollArea>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAnalysis(false)}
              className="border-gray-700 hover:bg-gray-800"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2));
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Copy Results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
