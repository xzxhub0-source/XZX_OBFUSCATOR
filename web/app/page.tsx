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
} from "lucide-react";
import { CodeEditor } from "@/components/CodeEditor";
import { obfuscateLua, type ObfuscationResult } from "@/lib/obfuscator-simple";
import { BackgroundGradientAnimation } from "@/components/BackgroundGradient";
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

// Empty default - no pre-loaded code
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

	// New Luraph-style features
	intenseVM: boolean;
	gcFixes: boolean;
	targetVersion: "5.1" | "5.2" | "5.3" | "5.4" | "luajit";
	hardcodeGlobals: boolean;
	optimizationLevel: 0 | 1 | 2 | 3;
	staticEnvironment: boolean;
	vmCompression: boolean;
	disableLineInfo: boolean;
	useDebugLibrary: boolean;
}

export default function Home() {
	const [inputCode, setInputCode] = useState(DEFAULT_LUA_CODE);
	const [outputCode, setOutputCode] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [inputError, setInputError] = useState<ParseError | undefined>(undefined);
	const [copySuccess, setCopySuccess] = useState(false);
	const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
	const [metrics, setMetrics] = useState<ObfuscationMetrics | null>(null);
	const [fileName, setFileName] = useState<string>("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [settings, setSettings] = useState<ObfuscatorSettings>({
		// Basic options (v1.0)
		mangleNames: false,
		encodeStrings: false,
		encodeNumbers: false,
		controlFlow: false,
		minify: false,
		compressionLevel: 0,

		// Advanced options (v1.1)
		encryptionAlgorithm: "none",
		controlFlowFlattening: false,
		deadCodeInjection: false,
		antiDebugging: false,
		formattingStyle: "minified",

		// New Luraph-style features
		intenseVM: false,
		gcFixes: false,
		targetVersion: "5.1",
		hardcodeGlobals: false,
		optimizationLevel: 1,
		staticEnvironment: false,
		vmCompression: false,
		disableLineInfo: false,
		useDebugLibrary: false,
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
			const timer = setTimeout(() => setShowSuccessAnimation(false), 1500);
			return () => clearTimeout(timer);
		}
	}, [outputCode, error]);

	// Clear input error when user starts typing to fix it
	const handleInputChange = (newCode: string) => {
		setInputCode(newCode);
		if (inputError) {
			setInputError(undefined);
		}
	};

	// File upload handler
	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

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

		try {
			const startTime = Date.now();

			// Build obfuscation options with all new features
			const options = {
				mangleNames: settings.mangleNames,
				encodeStrings: settings.encodeStrings,
				encodeNumbers: settings.encodeNumbers,
				controlFlow: settings.controlFlow,
				minify: !settings.formattingStyle || settings.formattingStyle === "minified",
				protectionLevel: settings.compressionLevel,
				encryptionAlgorithm: settings.encryptionAlgorithm,
				controlFlowFlattening: settings.controlFlowFlattening,
				deadCodeInjection: settings.deadCodeInjection,
				antiDebugging: settings.antiDebugging,
				formattingStyle: settings.formattingStyle,
				
				// New Luraph-style features
				intenseVM: settings.intenseVM,
				gcFixes: settings.gcFixes,
				targetVersion: settings.targetVersion,
				hardcodeGlobals: settings.hardcodeGlobals,
				optimizationLevel: settings.optimizationLevel,
				staticEnvironment: settings.staticEnvironment,
				vmCompression: settings.vmCompression,
				disableLineInfo: settings.disableLineInfo,
				useDebugLibrary: settings.useDebugLibrary,
			};

			// Perform client-side obfuscation (wrapped in setTimeout to prevent UI blocking)
			const result: ObfuscationResult = await new Promise(resolve => {
				setTimeout(() => {
					resolve(obfuscateLua(inputCode, options));
				}, 10);
			});

			const duration = Date.now() - startTime;

			if (result.success && result.code) {
				setOutputCode(result.code);
				setError(null);
				setInputError(undefined);
				setMetrics(result.metrics || null);

				// Update obfuscation count
				const newCount = obfuscationCount + 1;
				setObfuscationCount(newCount);

				// Track obfuscation event
				const obfuscationType =
					settings.mangleNames && settings.encodeStrings && settings.minify
						? "full"
						: settings.mangleNames && settings.encodeStrings
							? "mangle_encode"
							: settings.mangleNames
								? "mangle"
								: settings.encodeStrings
									? "encode"
									: "minify";

				trackObfuscation({
					obfuscationType,
					codeSize: inputCode.length,
					protectionLevel: settings.compressionLevel,
				}).catch(err => console.error("Analytics tracking failed:", err));

				// Track performance metrics
				const sizeRatio = result.code.length / inputCode.length;
				trackObfuscationPerformance({
					inputSize: inputCode.length,
					outputSize: result.code.length,
					duration: duration,
					sizeRatio: sizeRatio,
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

				// Track milestones (1st, 5th, 10th, 25th, 50th obfuscation)
				if ([1, 5, 10, 25, 50].includes(newCount)) {
					trackObfuscationMilestone(newCount).catch(err => console.error("Analytics tracking failed:", err));
				}
			} else {
				setError(result.error || "Failed to obfuscate code");
				setInputError(result.errorDetails);
				setOutputCode("");
				setMetrics(null);

				// Track error event
				trackError({
					errorType: result.errorDetails ? "parse_error" : "obfuscation_error",
					errorMessage: result.error,
				}).catch(err => console.error("Analytics tracking failed:", err));
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

			// Track copy event
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

		// Track download event
		trackDownload(outputCode.length).catch(err => console.error("Analytics tracking failed:", err));
	};

	// Calculate protection strength for visual feedback
	const getProtectionStrength = () => {
		if (settings.compressionLevel === 0) return "none";
		if (settings.compressionLevel < 40) return "low";
		if (settings.compressionLevel < 70) return "medium";
		return "high";
	};

	const protectionStrength = getProtectionStrength();

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
								<Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-md group-hover:rotate-12 transition-transform duration-300" />
							</div>
						</div>
						<div>
							<h1 className="text-xl sm:text-3xl font-bold tracking-tight">
								<span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-purple-400">
									XZX
								</span>
								<span className="text-white ml-2">Obfuscator</span>
							</h1>
							<p className="text-xs sm:text-sm text-gray-300/90 hidden sm:block font-medium">
								v1.0.0 | Advanced Lua code protection
							</p>
						</div>
					</div>
					<nav className="flex flex-wrap gap-3 w-full sm:w-auto" aria-label="Main actions">
						<Button
							onClick={copyToClipboard}
							disabled={!outputCode}
							className="group bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/20 hover:border-white/40 flex-1 sm:flex-none transition-all duration-300 shadow-lg hover:shadow-2xl backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
							aria-label={copySuccess ? "Copied to clipboard" : "Copy obfuscated code to clipboard"}
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
							disabled={!outputCode}
							className="group bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/20 hover:border-white/40 flex-1 sm:flex-none transition-all duration-300 shadow-lg hover:shadow-2xl backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
							aria-label="Download obfuscated code as .lua file"
						>
							<Download className="w-4 h-4 mr-2 group-hover:translate-y-0.5 transition-transform duration-200" />
							Download
						</Button>
						<Button
							onClick={obfuscateCode}
							disabled={!inputCode || isProcessing}
							className="group relative bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] hover:from-[#9b6cf6] hover:via-[#b865f7] hover:to-[#fc59a9] active:scale-[0.98] text-white shadow-xl hover:shadow-2xl shadow-purple-500/40 flex-1 sm:flex-none transition-all duration-300 font-semibold hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
							aria-label="Obfuscate Lua code"
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
						<div className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-2xl border border-purple-400/30 flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
								<Sparkles className="w-5 h-5 text-white animate-pulse" />
							</div>
							<div>
								<p className="text-white font-bold text-sm">Obfuscation Complete!</p>
								<p className="text-purple-50 text-xs">Your code is now XZX protected</p>
							</div>
						</div>
					</div>
				)}

				{/* Main Content */}
				<section
					className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 overflow-y-auto animate-in fade-in slide-in-from-bottom duration-700"
					aria-label="Code editor workspace"
				>
					{/* Code Editors - Side by Side on Desktop, Stacked on Mobile */}
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
											<p className="text-xs text-gray-400 font-medium">Paste your Lua code or upload a file</p>
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
											className="bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/30 text-white"
										>
											<Upload className="w-4 h-4 mr-2" />
											Upload File
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
								<div className="flex-1 min-h-0">
									<CodeEditor 
										value={inputCode} 
										onChange={handleInputChange} 
										error={inputError}
										options={{
											readOnly: false,
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
													Obfuscated Output
												</h2>
												<p className="text-xs text-gray-400 font-medium">Protected by XZX</p>
											</div>
										</div>
										{outputCode && (
											<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 backdrop-blur-sm animate-in fade-in zoom-in duration-500">
												<Zap className="w-3.5 h-3.5 text-purple-400" />
												<span className="text-xs font-bold text-purple-300">Secured</span>
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
						{metrics && (
							<section aria-labelledby="metrics-heading" className="lg:col-span-2">
								<Card className="bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-pink-900/20 backdrop-blur-2xl border-purple-500/30 shadow-2xl shadow-black/30 p-6 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500">
									<div className="flex items-center gap-3 mb-5 pb-4 border-b border-purple-500/30">
										<div className="relative">
											<div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] rounded-lg blur-md opacity-50"></div>
											<div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center shadow-lg">
												<Sparkles className="w-4.5 h-4.5 text-white" aria-hidden="true" />
											</div>
										</div>
										<div>
											<h2 id="metrics-heading" className="text-sm font-bold text-white tracking-wide">
												XZX Metrics
											</h2>
											<p className="text-xs text-gray-400 font-medium">Protection statistics</p>
										</div>
									</div>

									<div className="space-y-4">
										{/* Size metrics */}
										<div className="space-y-2">
											<div className="flex justify-between items-center">
												<span className="text-xs text-gray-400">Input Size</span>
												<span className="text-sm font-semibold text-white">
													{(metrics.inputSize / 1024).toFixed(2)} KB
												</span>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-xs text-gray-400">Output Size</span>
												<span className="text-sm font-semibold text-white">
													{(metrics.outputSize / 1024).toFixed(2)} KB
												</span>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-xs text-gray-400">Size Ratio</span>
												<span
													className={cn(
														"text-sm font-bold",
														metrics.sizeRatio > 2 ? "text-pink-400" : "text-purple-400"
													)}
												>
													{metrics.sizeRatio.toFixed(2)}x
												</span>
											</div>
										</div>

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
														<span className="text-xs text-gray-400">
															Strings Encrypted{" "}
															{metrics.encryptionAlgorithm && metrics.encryptionAlgorithm !== "none" && (
																<span className="text-[10px] text-pink-400">({metrics.encryptionAlgorithm})</span>
															)}
														</span>
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

										<div className="border-t border-purple-500/30 pt-4">
											<div className="flex justify-between items-center">
												<span className="text-xs text-gray-400">Processing Time</span>
												<span className="text-sm font-semibold text-white">{metrics.duration}ms</span>
											</div>
										</div>
									</div>
								</Card>
							</section>
						)}
					</div>

					{/* Settings Panel */}
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
										XZX Settings
									</h2>
									<p className="text-xs text-gray-400 font-medium mt-0.5">Configure protection level</p>
								</div>
							</div>

							<div className="space-y-7 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
								{/* Basic Toggle Settings */}
								<div className="space-y-4">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										Basic Obfuscation
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="mangle-names" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Mangle Names</span>
												{settings.mangleNames && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Replace variable and function names with hexadecimal identifiers
											</p>
										</Label>
										<Switch
											id="mangle-names"
											checked={settings.mangleNames}
											onCheckedChange={checked => {
												setSettings({ ...settings, mangleNames: checked });
												trackSettingsChange({ setting: "mangleNames", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label
											htmlFor="encode-strings"
											className="text-sm font-semibold text-gray-100 cursor-pointer flex-1"
										>
											<div className="flex items-center gap-2">
												<span>Encode Strings</span>
												{settings.encodeStrings && <Zap className="w-3.5 h-3.5 text-pink-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Convert strings to byte arrays using string.char()
											</p>
										</Label>
										<Switch
											id="encode-strings"
											checked={settings.encodeStrings}
											onCheckedChange={checked => {
												setSettings({ ...settings, encodeStrings: checked });
												trackSettingsChange({ setting: "encodeStrings", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-pink-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="minify" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Minify Code</span>
												{settings.minify && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Remove comments and whitespace
											</p>
										</Label>
										<Switch
											id="minify"
											checked={settings.minify}
											onCheckedChange={checked => {
												setSettings({ ...settings, minify: checked });
												trackSettingsChange({ setting: "minify", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>
								</div>

								{/* Target Version */}
								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										Target Version
									</Label>

									<div className="space-y-3">
										<Select
											value={settings.targetVersion}
											onValueChange={(value: any) => {
												setSettings({ ...settings, targetVersion: value });
											}}
										>
											<SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
												<SelectValue placeholder="Select Lua version" />
											</SelectTrigger>
											<SelectContent className="bg-slate-900 border-white/20">
												<SelectItem value="5.1">Lua 5.1 (Recommended)</SelectItem>
												<SelectItem value="5.2">Lua 5.2</SelectItem>
												<SelectItem value="5.3">Lua 5.3</SelectItem>
												<SelectItem value="5.4">Lua 5.4</SelectItem>
												<SelectItem value="luajit">LuaJIT</SelectItem>
											</SelectContent>
										</Select>
										<p className="text-xs text-gray-400/90">Platform/version lock for compatibility</p>
									</div>
								</div>

								{/* Luraph-style Advanced Features */}
								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										Advanced VM Features
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="intense-vm" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Intense VM Structure</span>
												{settings.intenseVM && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Adds extra layers of processing to the VM for extra security
											</p>
										</Label>
										<Switch
											id="intense-vm"
											checked={settings.intenseVM}
											onCheckedChange={checked => {
												setSettings({ ...settings, intenseVM: checked });
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="gc-fixes" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>GC Fixes</span>
												{settings.gcFixes && <span className="text-[10px] text-yellow-400">(Heavy)</span>}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Fixes garbage collection issues for __gc metamethod (heavy performance cost)
											</p>
										</Label>
										<Switch
											id="gc-fixes"
											checked={settings.gcFixes}
											onCheckedChange={checked => {
												setSettings({ ...settings, gcFixes: checked });
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="hardcode-globals" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Hardcode Globals</span>
												{settings.hardcodeGlobals && <span className="text-[10px] text-yellow-400">(Exposes names)</span>}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Hardcodes global accesses for performance (exposes global names)
											</p>
										</Label>
										<Switch
											id="hardcode-globals"
											checked={settings.hardcodeGlobals}
											onCheckedChange={checked => {
												setSettings({ ...settings, hardcodeGlobals: checked });
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="static-env" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Static Environment</span>
												{settings.staticEnvironment && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Optimizes assuming environment never changes via getfenv/setfenv
											</p>
										</Label>
										<Switch
											id="static-env"
											checked={settings.staticEnvironment}
											onCheckedChange={checked => {
												setSettings({ ...settings, staticEnvironment: checked });
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="vm-compression" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>VM Compression</span>
												{settings.vmCompression && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Strong compression for smaller file size (requires loadstring)
											</p>
										</Label>
										<Switch
											id="vm-compression"
											checked={settings.vmCompression}
											onCheckedChange={checked => {
												setSettings({ ...settings, vmCompression: checked });
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="disable-lineinfo" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Disable Line Info</span>
												{settings.disableLineInfo && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Removes line information for better performance (no error line numbers)
											</p>
										</Label>
										<Switch
											id="disable-lineinfo"
											checked={settings.disableLineInfo}
											onCheckedChange={checked => {
												setSettings({ ...settings, disableLineInfo: checked });
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="use-debug" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Use Debug Library</span>
												{settings.useDebugLibrary && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Adds extra security using Lua's debug library
											</p>
										</Label>
										<Switch
											id="use-debug"
											checked={settings.useDebugLibrary}
											onCheckedChange={checked => {
												setSettings({ ...settings, useDebugLibrary: checked });
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>
								</div>

								{/* Optimization Level */}
								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										Optimization Level
									</Label>

									<div className="space-y-3">
										<Select
											value={settings.optimizationLevel.toString()}
											onValueChange={(value: string) => {
												setSettings({ ...settings, optimizationLevel: parseInt(value) as 0 | 1 | 2 | 3 });
											}}
										>
											<SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
												<SelectValue placeholder="Select optimization level" />
											</SelectTrigger>
											<SelectContent className="bg-slate-900 border-white/20">
												<SelectItem value="0">Level 0 (No optimization)</SelectItem>
												<SelectItem value="1">Level 1 (Basic)</SelectItem>
												<SelectItem value="2">Level 2 (Aggressive)</SelectItem>
												<SelectItem value="3">Level 3 (Maximum - may change metamethod order)</SelectItem>
											</SelectContent>
										</Select>
										<p className="text-xs text-gray-400/90">
											{settings.optimizationLevel === 0 && "No optimizations applied"}
											{settings.optimizationLevel === 1 && "Basic optimizations (constant folding, dead code elimination)"}
											{settings.optimizationLevel === 2 && "Aggressive optimizations with minimal risk"}
											{settings.optimizationLevel === 3 && "Maximum optimizations - may change metamethod execution order"}
										</p>
									</div>
								</div>

								{/* Encryption Algorithm Selector */}
								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										String Encryption
									</Label>

									<div className="space-y-3">
										<Label htmlFor="encryption-algorithm" className="text-sm font-semibold text-gray-100">
											Encryption Algorithm
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Choose how strings are encrypted (requires Encode Strings)
											</p>
										</Label>
										<Select
											value={settings.encryptionAlgorithm}
											onValueChange={(value: EncryptionAlgorithm) => {
												setSettings({ ...settings, encryptionAlgorithm: value });
												trackSettingsChange({ setting: "encryptionAlgorithm", value }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											disabled={!settings.encodeStrings}
										>
											<SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
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

								{/* Advanced Obfuscation Techniques */}
								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										Advanced Techniques
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label
											htmlFor="encode-numbers"
											className="text-sm font-semibold text-gray-100 cursor-pointer flex-1"
										>
											<div className="flex items-center gap-2">
												<span>Encode Numbers</span>
												{settings.encodeNumbers && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Transform numeric literals into mathematical expressions
											</p>
										</Label>
										<Switch
											id="encode-numbers"
											checked={settings.encodeNumbers}
											onCheckedChange={checked => {
												setSettings({ ...settings, encodeNumbers: checked });
												trackSettingsChange({ setting: "encodeNumbers", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="control-flow" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Control Flow</span>
												{settings.controlFlow && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Add opaque predicates to complicate control flow analysis
											</p>
										</Label>
										<Switch
											id="control-flow"
											checked={settings.controlFlow}
											onCheckedChange={checked => {
												setSettings({ ...settings, controlFlow: checked });
												trackSettingsChange({ setting: "controlFlow", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label
											htmlFor="control-flow-flattening"
											className="text-sm font-semibold text-gray-100 cursor-pointer flex-1"
										>
											<div className="flex items-center gap-2">
												<span>Control Flow Flattening</span>
												{settings.controlFlowFlattening && (
													<Zap className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
												)}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Transform code into state machine patterns (CPU intensive)
											</p>
										</Label>
										<Switch
											id="control-flow-flattening"
											checked={settings.controlFlowFlattening}
											onCheckedChange={checked => {
												setSettings({ ...settings, controlFlowFlattening: checked });
												trackSettingsChange({ setting: "controlFlowFlattening", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label
											htmlFor="dead-code-injection"
											className="text-sm font-semibold text-gray-100 cursor-pointer flex-1"
										>
											<div className="flex items-center gap-2">
												<span>Dead Code Injection</span>
												{settings.deadCodeInjection && <Zap className="w-3.5 h-3.5 text-orange-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Inject unreachable code blocks to confuse analysis
											</p>
										</Label>
										<Switch
											id="dead-code-injection"
											checked={settings.deadCodeInjection}
											onCheckedChange={checked => {
												setSettings({ ...settings, deadCodeInjection: checked });
												trackSettingsChange({ setting: "deadCodeInjection", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label
											htmlFor="anti-debugging"
											className="text-sm font-semibold text-gray-100 cursor-pointer flex-1"
										>
											<div className="flex items-center gap-2">
												<span>Anti-Debugging</span>
												{settings.antiDebugging && <Zap className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Add runtime checks to detect debuggers and modified environments
											</p>
										</Label>
										<Switch
											id="anti-debugging"
											checked={settings.antiDebugging}
											onCheckedChange={checked => {
												setSettings({ ...settings, antiDebugging: checked });
												trackSettingsChange({ setting: "antiDebugging", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>
								</div>

								{/* Output Formatting */}
								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										Output Format
									</Label>

									<div className="space-y-3">
										<Select
											value={settings.formattingStyle}
											onValueChange={(value: FormattingStyle) => {
												setSettings({ ...settings, formattingStyle: value });
												trackSettingsChange({ setting: "formattingStyle", value }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
										>
											<SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
												<SelectValue />
											</SelectTrigger>
											<SelectContent className="bg-slate-900 border-white/20">
												<SelectItem value="minified">Minified (Compact)</SelectItem>
												<SelectItem value="pretty">Pretty (Readable)</SelectItem>
												<SelectItem value="obfuscated">Obfuscated (Random)</SelectItem>
												<SelectItem value="single-line">Single Line</SelectItem>
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
											<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
											Protection Level
										</Label>
										<div className="flex items-center gap-2">
											<div
												className={cn(
													"px-3 py-1.5 rounded-lg font-bold text-xs backdrop-blur-sm border transition-all duration-300",
													protectionStrength === "none" && "bg-gray-500/20 border-gray-500/30 text-gray-300",
													protectionStrength === "low" && "bg-purple-500/20 border-purple-500/30 text-purple-300",
													protectionStrength === "medium" && "bg-pink-500/20 border-pink-500/30 text-pink-300",
													protectionStrength === "high" &&
														"bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300"
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
												const oldLevel = settings.compressionLevel;

												setSettings({
													...settings,
													compressionLevel: level,
													// Basic obfuscation (v1.0)
													minify: level >= 10,
													mangleNames: level >= 20,
													encodeStrings: level >= 30,
													encodeNumbers: level >= 50,
													controlFlow: level >= 60,
													// Advanced obfuscation (v1.1)
													encryptionAlgorithm: level >= 70 ? "xor" : level >= 30 ? "none" : "none",
													deadCodeInjection: level >= 75,
													controlFlowFlattening: level >= 85,
													antiDebugging: level >= 90,
													formattingStyle: level >= 10 ? "minified" : "pretty",
													// New Luraph-style features
													intenseVM: level >= 80,
													staticEnvironment: level >= 60,
													vmCompression: level >= 70,
													disableLineInfo: level >= 40,
													useDebugLibrary: level >= 85,
													optimizationLevel: level >= 80 ? 3 : level >= 60 ? 2 : level >= 30 ? 1 : 0,
												});

												// Track protection level change
												if (oldLevel !== level) {
													trackProtectionLevelChange({
														oldLevel,
														newLevel: level,
														changeType: "slider",
													}).catch(err => console.error("Analytics tracking failed:", err));
												}
											}}
											max={100}
											step={10}
											className="w-full"
										/>
									</div>
									<div
										className={cn(
											"text-xs rounded-xl p-4 backdrop-blur-sm border transition-all duration-300",
											protectionStrength === "none" && "bg-gray-500/10 border-gray-500/20 text-gray-300",
											protectionStrength === "low" && "bg-purple-500/10 border-purple-500/20 text-purple-200",
											protectionStrength === "medium" && "bg-pink-500/10 border-pink-500/20 text-pink-200",
											protectionStrength === "high" &&
												"bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 text-purple-200"
										)}
									>
										{settings.compressionLevel === 0 && (
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 rounded-full bg-gray-400"></div>
												<p>No automatic obfuscation enabled</p>
											</div>
										)}
										{settings.compressionLevel >= 10 && settings.compressionLevel < 20 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Active:</strong> Minify
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 20 && settings.compressionLevel < 30 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Active:</strong> Minify, Mangle Names
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 30 && settings.compressionLevel < 40 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Active:</strong> Minify, Mangle Names, Encode Strings, Opt Level 1
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 40 && settings.compressionLevel < 50 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Active:</strong> + Disable Line Info
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 50 && settings.compressionLevel < 60 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Active:</strong> + Encode Numbers
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 60 && settings.compressionLevel < 70 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Active:</strong> + Control Flow, Static Environment, Opt Level 2
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 70 && settings.compressionLevel < 75 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Advanced:</strong> + XOR Encryption, VM Compression
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 75 && settings.compressionLevel < 80 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Advanced:</strong> + Dead Code Injection
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 80 && settings.compressionLevel < 85 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Advanced:</strong> + Intense VM, Opt Level 3
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 85 && settings.compressionLevel < 90 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
													<p>
														<strong className="font-bold">Maximum:</strong> + Control Flow Flattening, Use Debug Library
													</p>
												</div>
											</div>
										)}
										{settings.compressionLevel >= 90 && (
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
													<p>
														<strong className="font-bold">Maximum Protection:</strong> All Techniques
													</p>
												</div>
												<p className="text-[10px] text-gray-400 pl-4">
													Every protection feature enabled (strongest security)
												</p>
											</div>
										)}
									</div>
								</div>

								{/* GC Fixes Warning */}
								{settings.gcFixes && (
									<div className="pt-2">
										<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
											<p className="text-xs text-yellow-200/90">
												<strong className="font-bold block mb-1">⚠️ Performance Warning</strong>
												GC Fixes enabled - This option has a heavy performance cost. Only use if your script depends on __gc metamethods.
											</p>
										</div>
									</div>
								)}

								{/* Hardcode Globals Warning */}
								{settings.hardcodeGlobals && (
									<div className="pt-2">
										<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
											<p className="text-xs text-yellow-200/90">
												<strong className="font-bold block mb-1">⚠️ Security Warning</strong>
												Hardcode Globals exposes the names of all globals used in your script. Do not use if any globals are sensitive!
											</p>
										</div>
									</div>
								)}

								{/* VM Compression Warning */}
								{settings.vmCompression && (
									<div className="pt-2">
										<div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
											<p className="text-xs text-blue-200/90">
												<strong className="font-bold block mb-1">ℹ️ Requirement</strong>
												VM Compression requires loadstring or load to be available in your environment.
											</p>
										</div>
									</div>
								)}

								{/* Enhanced Info Box */}
								<div className="pt-6 border-t border-purple-500/30">
									<div className="relative overflow-hidden bg-gradient-to-br from-[#8b5cf6]/20 via-[#ec4899]/15 to-[#8b5cf6]/10 border border-[#8b5cf6]/40 rounded-2xl p-5 shadow-2xl backdrop-blur-sm">
										<div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-2xl"></div>
										<div className="relative flex items-start gap-3">
											<div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8b5cf6]/30 to-[#ec4899]/30 flex items-center justify-center flex-shrink-0 shadow-lg backdrop-blur-sm border border-purple-400/30">
												<Sparkles className="w-4 h-4 text-purple-300" />
											</div>
											<div>
												<p className="text-xs text-purple-100 leading-relaxed">
													<strong className="font-bold text-sm block mb-1">💡 XZX Pro Tip</strong>
													Use the Protection Level slider for quick presets, or manually toggle individual techniques
													for fine-grained control. Higher protection levels provide stronger obfuscation but may impact
													performance.
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						</Card>
					</aside>
				</section>

				{/* Enhanced Error Display */}
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

				{/* SEO-Optimized Content Section - Screen reader accessible */}
				<section className="sr-only">
					<h2>About XZX Lua Obfuscator</h2>
					<p>
						XZX Lua Obfuscator v1.0.0 is a professional, free online tool for protecting Lua source code through advanced
						obfuscation techniques. Whether you're developing Roblox scripts, FiveM resources, Garry's Mod addons, World
						of Warcraft addons, or any other Lua-based application, this tool helps secure your intellectual property.
					</p>

					<h3>Key Features</h3>
					<ul>
						<li>Variable and Function Name Mangling - Replace identifiers with hexadecimal codes</li>
						<li>String Encoding - Convert string literals to byte arrays using string.char()</li>
						<li>Number Encoding - Transform numeric literals into mathematical expressions</li>
						<li>Control Flow Obfuscation - Add opaque predicates to complicate reverse engineering</li>
						<li>Code Minification - Remove comments and whitespace for smaller file sizes</li>
						<li>Intense VM Structure - Extra processing layers for maximum security</li>
						<li>GC Fixes - Garbage collection bugfixes for __gc metamethod</li>
						<li>Multiple Lua Version Support - 5.1, 5.2, 5.3, 5.4, LuaJIT</li>
						<li>Hardcode Globals - Performance optimization (exposes global names)</li>
						<li>3-Level Optimization - From basic to aggressive optimizations</li>
						<li>Static Environment - Optimizations for unchanging environments</li>
						<li>VM Compression - Strong compression for smaller file size</li>
						<li>Disable Line Information - Better performance, no error line numbers</li>
						<li>Debug Library Integration - Extra security features</li>
						<li>Real-time Processing - Instant obfuscation in your browser</li>
						<li>Configurable Protection Levels - Adjust security vs performance (0-100%)</li>
						<li>File Upload Support - Load .lua files directly</li>
					</ul>
				</section>

				{/* Version Footer */}
				<footer
					className="mt-auto pt-8 pb-4 text-center"
					role="contentinfo"
					aria-label="Version and author information"
				>
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-purple-500/30 hover:bg-white/10 transition-all duration-300">
						<span className="text-sm text-gray-400 font-mono">v1.0.0</span>
						<span className="text-sm text-gray-400">Made by</span>
						<a
							href="https://github.com/xzxhub0-source"
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
				.custom-scrollbar::-webkit-scrollbar-thumb:hover {
					opacity: 0.8;
				}
			`}</style>
		</>
	);
}
