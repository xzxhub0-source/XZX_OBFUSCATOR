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

const DEFAULT_LUA_CODE = "";
const OUTPUT_HEADER = "--[[ PROTECTED BY v2.0.0 XZX HUB OBFUSCATOR https://discord.gg/5q5bEKmYqF ]]\n\n";

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
			const timer = setTimeout(() => setShowSuccessAnimation(false), 1500);
			return () => clearTimeout(timer);
		}
	}, [outputCode, error]);

	const handleInputChange = (newCode: string) => {
		setInputCode(newCode);
		if (inputError) {
			setInputError(undefined);
		}
	};

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
				intenseVM: settings.intenseVM,
				gcFixes: settings.gcFixes,
				targetVersion: settings.targetVersion,
				hardcodeGlobals: settings.hardcodeGlobals,
				optimizationLevel: settings.optimizationLevel,
				staticEnvironment: settings.staticEnvironment,
				vmCompression: settings.vmCompression,
				disableLineInfo: settings.disableLineInfo,
				useDebugLibrary: settings.useDebugLibrary,
				opaquePredicates: settings.opaquePredicates,
				virtualization: settings.virtualization,
				bytecodeEncryption: settings.bytecodeEncryption,
				antiTamper: settings.antiTamper,
				selfModifying: settings.selfModifying,
				mutation: settings.mutation,
				codeSplitting: settings.codeSplitting,
				environmentLock: settings.environmentLock,
				integrityChecks: settings.integrityChecks,
			};

			const result: ObfuscationResult = await new Promise(resolve => {
				setTimeout(() => {
					resolve(obfuscateLua(inputCode, options));
				}, 10);
			});

			const duration = Date.now() - startTime;

			if (result.success && result.code) {
				// Prepend the header comment
				const finalCode = OUTPUT_HEADER + result.code;
				setOutputCode(finalCode);
				setError(null);
				setInputError(undefined);
				setMetrics(result.metrics || null);

				const newCount = obfuscationCount + 1;
				setObfuscationCount(newCount);

				trackObfuscation({
					obfuscationType: settings.intenseVM ? "advanced" : "standard",
					codeSize: inputCode.length,
					protectionLevel: settings.compressionLevel,
				}).catch(err => console.error("Analytics tracking failed:", err));

				const sizeRatio = result.code.length / inputCode.length;
				trackObfuscationPerformance({
					inputSize: inputCode.length,
					outputSize: result.code.length,
					duration: duration,
					sizeRatio: sizeRatio,
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
				setInputError(result.errorDetails);
				setOutputCode("");
				setMetrics(null);

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
							<div className="flex items-center gap-2 mt-1">
								<p className="text-xs sm:text-sm text-gray-300/90 font-medium">
									v2.0.0 | Advanced Protection
								</p>
							</div>
						</div>
					</div>
					<nav className="flex flex-wrap gap-3 w-full sm:w-auto" aria-label="Main actions">
						<Button
							onClick={copyToClipboard}
							disabled={!outputCode}
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
							disabled={!outputCode}
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

				{showSuccessAnimation && (
					<div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top fade-in duration-300">
						<div className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-2xl border border-purple-400/30 flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
								<Shield className="w-5 h-5 text-white animate-pulse" />
							</div>
							<div>
								<p className="text-white font-bold text-sm">Obfuscation Complete!</p>
								<p className="text-purple-50 text-xs">Your code is now protected</p>
							</div>
						</div>
					</div>
				)}

				<section
					className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 overflow-y-auto animate-in fade-in slide-in-from-bottom duration-700"
					aria-label="Code editor workspace"
				>
					<div className="lg:col-span-8 flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:min-h-0">
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
											<p className="text-xs text-gray-400 font-medium">Paste code or upload a file</p>
										</div>
									</div>
									
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

						{metrics && (
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
											<p className="text-xs text-gray-400 font-medium">Transformation statistics</p>
										</div>
									</div>

									<div className="space-y-4">
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

					<aside className="lg:col-span-4 lg:overflow-auto" aria-labelledby="settings-heading">
						<Card className="bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-pink-900/20 backdrop-blur-2xl border-purple-500/30 shadow-2xl shadow-black/30 p-6 sm:p-7 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all duration-500">
							<div className="flex items-center gap-3 mb-6 sm:mb-8 pb-5 border-b border-purple-500/30">
								<div className="relative">
									<div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] rounded-xl blur-lg opacity-50"></div>
									<div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center shadow-lg">
										<Layers className="w-5.5 h-5.5 text-white" aria-hidden="true" />
									</div>
								</div>
								<div className="flex-1">
									<h2 id="settings-heading" className="text-lg sm:text-xl font-bold text-white tracking-tight">
										Obfuscation Settings
									</h2>
									<p className="text-xs text-gray-400 font-medium mt-0.5">Configure protection level</p>
								</div>
							</div>

							<div className="space-y-7 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
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

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Globe className="w-4 h-4 mr-1" /> Target Version
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

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Cpu className="w-4 h-4 mr-1" /> VM & Core Features
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="intenseVM" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Intense VM Structure</span>
												{settings.intenseVM && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Adds extra layers of processing to the VM for maximum security
											</p>
										</Label>
										<Switch
											id="intenseVM"
											checked={settings.intenseVM}
											onCheckedChange={checked => {
												setSettings({ ...settings, intenseVM: checked });
												trackSettingsChange({ setting: "intenseVM", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="virtualization" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Virtualization</span>
												{settings.virtualization && <Zap className="w-3.5 h-3.5 text-pink-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Complete code virtualization - runs in custom VM
											</p>
										</Label>
										<Switch
											id="virtualization"
											checked={settings.virtualization}
											onCheckedChange={checked => {
												setSettings({ ...settings, virtualization: checked });
												trackSettingsChange({ setting: "virtualization", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-pink-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="bytecodeEncryption" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Bytecode Encryption</span>
												{settings.bytecodeEncryption && <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Encrypts the VM bytecode with AES-256
											</p>
										</Label>
										<Switch
											id="bytecodeEncryption"
											checked={settings.bytecodeEncryption}
											onCheckedChange={checked => {
												setSettings({ ...settings, bytecodeEncryption: checked });
												trackSettingsChange({ setting: "bytecodeEncryption", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-blue-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="vmCompression" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>VM Compression</span>
												{settings.vmCompression && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Strong compression for smaller file size (requires loadstring)
											</p>
										</Label>
										<Switch
											id="vmCompression"
											checked={settings.vmCompression}
											onCheckedChange={checked => {
												setSettings({ ...settings, vmCompression: checked });
												trackSettingsChange({ setting: "vmCompression", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="gcFixes" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>GC Fixes</span>
												<span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">Heavy</span>
												{settings.gcFixes && <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Fixes garbage collection issues (heavy performance cost)
											</p>
										</Label>
										<Switch
											id="gcFixes"
											checked={settings.gcFixes}
											onCheckedChange={checked => {
												setSettings({ ...settings, gcFixes: checked });
												trackSettingsChange({ setting: "gcFixes", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-yellow-600"
										/>
									</div>
								</div>

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Bug className="w-4 h-4 mr-1" /> Anti-Analysis
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="antiDebugging" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Anti-Debugging</span>
												{settings.antiDebugging && <Zap className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Runtime checks to detect debuggers
											</p>
										</Label>
										<Switch
											id="antiDebugging"
											checked={settings.antiDebugging}
											onCheckedChange={checked => {
												setSettings({ ...settings, antiDebugging: checked });
												trackSettingsChange({ setting: "antiDebugging", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-red-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="antiTamper" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Anti-Tamper</span>
												{settings.antiTamper && <Zap className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Detects code modification and integrity violations
											</p>
										</Label>
										<Switch
											id="antiTamper"
											checked={settings.antiTamper}
											onCheckedChange={checked => {
												setSettings({ ...settings, antiTamper: checked });
												trackSettingsChange({ setting: "antiTamper", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-red-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="selfModifying" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Self-Modifying Code</span>
												{settings.selfModifying && <Zap className="w-3.5 h-3.5 text-orange-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Code that modifies itself at runtime
											</p>
										</Label>
										<Switch
											id="selfModifying"
											checked={settings.selfModifying}
											onCheckedChange={checked => {
												setSettings({ ...settings, selfModifying: checked });
												trackSettingsChange({ setting: "selfModifying", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-orange-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="integrityChecks" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Integrity Checks</span>
												{settings.integrityChecks && <Zap className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Cryptographic hash verification of code sections
											</p>
										</Label>
										<Switch
											id="integrityChecks"
											checked={settings.integrityChecks}
											onCheckedChange={checked => {
												setSettings({ ...settings, integrityChecks: checked });
												trackSettingsChange({ setting: "integrityChecks", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-red-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="useDebugLibrary" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Use Debug Library</span>
												{settings.useDebugLibrary && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Extra security using Lua's debug library
											</p>
										</Label>
										<Switch
											id="useDebugLibrary"
											checked={settings.useDebugLibrary}
											onCheckedChange={checked => {
												setSettings({ ...settings, useDebugLibrary: checked });
												trackSettingsChange({ setting: "useDebugLibrary", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>
								</div>

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Shuffle className="w-4 h-4 mr-1" /> Control Flow
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="controlFlowFlattening" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Control Flow Flattening</span>
												{settings.controlFlowFlattening && <Zap className="w-3.5 h-3.5 text-orange-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Transform code into state machine patterns (CPU intensive)
											</p>
										</Label>
										<Switch
											id="controlFlowFlattening"
											checked={settings.controlFlowFlattening}
											onCheckedChange={checked => {
												setSettings({ ...settings, controlFlowFlattening: checked });
												trackSettingsChange({ setting: "controlFlowFlattening", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-orange-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="opaquePredicates" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Opaque Predicates</span>
												{settings.opaquePredicates && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Insert complex always-true/false conditions
											</p>
										</Label>
										<Switch
											id="opaquePredicates"
											checked={settings.opaquePredicates}
											onCheckedChange={checked => {
												setSettings({ ...settings, opaquePredicates: checked });
												trackSettingsChange({ setting: "opaquePredicates", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="mutation" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Mutation</span>
												{settings.mutation && <Zap className="w-3.5 h-3.5 text-green-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Constant code structure mutation
											</p>
										</Label>
										<Switch
											id="mutation"
											checked={settings.mutation}
											onCheckedChange={checked => {
												setSettings({ ...settings, mutation: checked });
												trackSettingsChange({ setting: "mutation", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-green-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="codeSplitting" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Code Splitting</span>
												{settings.codeSplitting && <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Split code into many small fragments
											</p>
										</Label>
										<Switch
											id="codeSplitting"
											checked={settings.codeSplitting}
											onCheckedChange={checked => {
												setSettings({ ...settings, codeSplitting: checked });
												trackSettingsChange({ setting: "codeSplitting", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-blue-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="controlFlow" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Control Flow (Basic)</span>
												{settings.controlFlow && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Add opaque predicates to complicate analysis
											</p>
										</Label>
										<Switch
											id="controlFlow"
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
								</div>

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Code className="w-4 h-4 mr-1" /> Code Obfuscation
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="deadCodeInjection" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Dead Code Injection</span>
												{settings.deadCodeInjection && <Zap className="w-3.5 h-3.5 text-orange-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Inject unreachable code blocks
											</p>
										</Label>
										<Switch
											id="deadCodeInjection"
											checked={settings.deadCodeInjection}
											onCheckedChange={checked => {
												setSettings({ ...settings, deadCodeInjection: checked });
												trackSettingsChange({ setting: "deadCodeInjection", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-orange-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="encodeNumbers" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Encode Numbers</span>
												{settings.encodeNumbers && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Transform numeric literals into mathematical expressions
											</p>
										</Label>
										<Switch
											id="encodeNumbers"
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
										<Label htmlFor="hardcodeGlobals" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Hardcode Globals</span>
												<span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">Exposes Names</span>
												{settings.hardcodeGlobals && <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Hardcodes global accesses for performance (exposes global names)
											</p>
										</Label>
										<Switch
											id="hardcodeGlobals"
											checked={settings.hardcodeGlobals}
											onCheckedChange={checked => {
												setSettings({ ...settings, hardcodeGlobals: checked });
												trackSettingsChange({ setting: "hardcodeGlobals", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-yellow-600"
										/>
									</div>
								</div>

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<HardDrive className="w-4 h-4 mr-1" /> Environment & Optimization
									</Label>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="staticEnvironment" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Static Environment</span>
												{settings.staticEnvironment && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Optimizes assuming environment never changes
											</p>
										</Label>
										<Switch
											id="staticEnvironment"
											checked={settings.staticEnvironment}
											onCheckedChange={checked => {
												setSettings({ ...settings, staticEnvironment: checked });
												trackSettingsChange({ setting: "staticEnvironment", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="environmentLock" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Environment Lock</span>
												{settings.environmentLock && <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Locks script to specific environment
											</p>
										</Label>
										<Switch
											id="environmentLock"
											checked={settings.environmentLock}
											onCheckedChange={checked => {
												setSettings({ ...settings, environmentLock: checked });
												trackSettingsChange({ setting: "environmentLock", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-blue-600"
										/>
									</div>

									<div className="flex items-center justify-between group hover:bg-white/5 p-3.5 rounded-xl -mx-3.5 transition-all duration-200 cursor-pointer">
										<Label htmlFor="disableLineInfo" className="text-sm font-semibold text-gray-100 cursor-pointer flex-1">
											<div className="flex items-center gap-2">
												<span>Disable Line Info</span>
												{settings.disableLineInfo && <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
											</div>
											<p className="text-xs text-gray-400/90 mt-1 font-normal leading-relaxed">
												Removes line information for better performance
											</p>
										</Label>
										<Switch
											id="disableLineInfo"
											checked={settings.disableLineInfo}
											onCheckedChange={checked => {
												setSettings({ ...settings, disableLineInfo: checked });
												trackSettingsChange({ setting: "disableLineInfo", value: checked }).catch(err =>
													console.error("Analytics tracking failed:", err)
												);
											}}
											className="data-[state=checked]:bg-purple-600"
										/>
									</div>
								</div>

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Lock className="w-4 h-4 mr-1" /> String Encryption
									</Label>

									<div className="space-y-3">
										<Select
											value={settings.encryptionAlgorithm}
											onValueChange={(value: EncryptionAlgorithm) => {
												setSettings({ ...settings, encryptionAlgorithm: value });
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

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Zap className="w-4 h-4 mr-1" /> Optimization Level
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
												<SelectItem value="3">Level 3 (Maximum)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="space-y-4 pt-6 border-t border-purple-500/30">
									<Label className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
										<div className="w-1 h-5 bg-gradient-to-b from-[#8b5cf6] to-[#ec4899] rounded-full shadow-lg shadow-purple-500/50"></div>
										<Eye className="w-4 h-4 mr-1" /> Output Format
									</Label>

									<div className="space-y-3">
										<Select
											value={settings.formattingStyle}
											onValueChange={(value: FormattingStyle) => {
												setSettings({ ...settings, formattingStyle: value });
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
											className="w-full"
										/>
									</div>
									<div
										className={cn(
											"text-xs rounded-xl p-4 backdrop-blur-sm border transition-all duration-300",
											protectionStrength === "none" && "bg-gray-500/10 border-gray-500/20 text-gray-300",
											protectionStrength === "low" && "bg-purple-500/10 border-purple-500/20 text-purple-200",
											protectionStrength === "medium" && "bg-pink-500/10 border-pink-500/20 text-pink-200",
											protectionStrength === "high" && "bg-orange-500/10 border-orange-500/20 text-orange-200",
											protectionStrength === "maximum" && "bg-red-500/10 border-red-500/20 text-red-200"
										)}
									>
										{settings.compressionLevel < 30 && "Standard Protection"}
										{settings.compressionLevel >= 30 && settings.compressionLevel < 60 && "Enhanced Protection"}
										{settings.compressionLevel >= 60 && settings.compressionLevel < 80 && "Advanced Protection"}
										{settings.compressionLevel >= 80 && settings.compressionLevel < 95 && "Maximum Protection"}
										{settings.compressionLevel >= 95 && "Extreme Protection - May Impact Performance"}
									</div>
								</div>

								{settings.gcFixes && (
									<div className="pt-2">
										<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
											<p className="text-xs text-yellow-200/90">
												<strong className="font-bold block mb-1">⚠️ Performance Warning</strong>
												GC Fixes enabled - Heavy performance cost
											</p>
										</div>
									</div>
								)}

								{settings.hardcodeGlobals && (
									<div className="pt-2">
										<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
											<p className="text-xs text-yellow-200/90">
												<strong className="font-bold block mb-1">⚠️ Security Warning</strong>
												Hardcode Globals exposes global names
											</p>
										</div>
									</div>
								)}
							</div>
						</Card>
					</aside>
				</section>

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

				<section className="sr-only">
					<h2>About XZX Lua Obfuscator</h2>
					<p>
						XZX Lua Obfuscator v2.0.0 is a professional, free online tool for protecting Lua source code through advanced
						obfuscation techniques.
					</p>
				</section>

				<footer
					className="mt-auto pt-8 pb-4 text-center"
					role="contentinfo"
					aria-label="Version and author information"
				>
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-purple-500/30 hover:bg-white/10 transition-all duration-300">
						<span className="text-sm text-gray-400 font-mono">v2.0.0</span>
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
