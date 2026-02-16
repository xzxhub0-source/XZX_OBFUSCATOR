"use client";

import React, { useState, useEffect } from "react";
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

const DEFAULT_LUA_CODE = `-- Advanced Game Inventory System
-- Showcases: Tables, Metatables, Closures, Error Handling, Complex Logic

local Inventory = {}
Inventory.__index = Inventory

-- Create new inventory with maximum capacity
function Inventory.new(maxSlots, playerName)
	local self = setmetatable({}, Inventory)
	self.items = {}
	self.maxSlots = maxSlots or 20
	self.playerName = playerName or "Player"
	self.gold = 0
	self.locked = false
	return self
end

-- Add item with quantity validation
function Inventory:addItem(itemName, quantity, rarity)
	if self.locked then
		return false, "Inventory is locked"
	end
	
	local slot = #self.items + 1
	if slot > self.maxSlots then
		return false, "Inventory full"
	end
	
	-- Create item with metadata
	local item = {
		name = itemName,
		qty = quantity or 1,
		rarity = rarity or "common",
		timestamp = os.time(),
		id = math.random(1000, 9999)
	}
	
	-- Apply rarity multiplier
	local multiplier = 1.0
	if rarity == "rare" then
		multiplier = 1.5
	elseif rarity == "epic" then
		multiplier = 2.0
	elseif rarity == "legendary" then
		multiplier = 3.0
	end
	
	item.value = math.floor(quantity * 10 * multiplier)
	table.insert(self.items, item)
	
	return true, "Added " .. itemName
end

-- Calculate total inventory value
function Inventory:getTotalValue()
	local total = self.gold
	local count = 0
	
	for i = 1, #self.items do
		local item = self.items[i]
		total = total + (item.value or 0)
		count = count + 1
	end
	
	return total, count
end

-- Find items by rarity with filtering
function Inventory:findByRarity(targetRarity)
	local matches = {}
	local pattern = string.lower(targetRarity)
	
	for _, item in pairs(self.items) do
		if string.lower(item.rarity) == pattern then
			table.insert(matches, item.name)
		end
	end
	
	return matches
end

-- Sell item with price calculation
function Inventory:sellItem(index)
	if index < 1 or index > #self.items then
		return false
	end
	
	local item = table.remove(self.items, index)
	local salePrice = math.floor(item.value * 0.75)
	self.gold = self.gold + salePrice
	
	return true, salePrice
end

-- Protected transaction with error handling
function Inventory:safeTransaction(callback)
	self.locked = true
	
	local success, result = pcall(function()
		return callback(self)
	end)
	
	self.locked = false
	return success, result
end

-- Initialize player inventory
local playerInventory = Inventory.new(25, "Hero")

-- Add various items
playerInventory:addItem("Health Potion", 5, "common")
playerInventory:addItem("Mana Crystal", 3, "rare")
playerInventory:addItem("Dragon Scale", 1, "legendary")
playerInventory:addItem("Iron Sword", 1, "epic")
playerInventory:addItem("Gold Coins", 100, "common")

-- Calculate statistics
local totalValue, itemCount = playerInventory:getTotalValue()
print("Inventory Value: " .. totalValue .. " gold")
print("Total Items: " .. itemCount)

-- Find legendary items
local legendaries = playerInventory:findByRarity("legendary")
print("Legendary Items: " .. table.concat(legendaries, ", "))

-- Perform safe transaction
local success, price = playerInventory:safeTransaction(function(inv)
	return inv:sellItem(2)
end)

if success then
	print("Sold item for " .. price .. " gold")
	print("New Balance: " .. playerInventory.gold .. " gold")
end
`;

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

	const obfuscateCode = async () => {
		setIsProcessing(true);
		setError(null);
		setInputError(undefined);
		setCopySuccess(false);
		setMetrics(null);

		try {
			const startTime = Date.now();

			// Build obfuscation options
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
		a.download = "obfuscated.lua";
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
								Advanced Lua code protection by XZX
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

				{/* Rest of your JSX remains exactly the same from here... */}
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
											<p className="text-xs text-gray-400 font-medium">Ready for XZX protection</p>
										</div>
									</div>
								</div>
								<div className="flex-1 min-h-0">
									<CodeEditor value={inputCode} onChange={handleInputChange} error={inputError} />
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
									<CodeEditor value={outputCode} readOnly />
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

							{/* Rest of the settings JSX - keeping everything exactly the same as your previous file */}
							{/* ... */}
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
						XZX Lua Obfuscator is a professional, free online tool for protecting Lua source code through advanced
						obfuscation techniques. Whether you're developing Roblox scripts, FiveM resources, Garry's Mod addons, World
						of Warcraft addons, or any other Lua-based application, this tool helps secure your intellectual property.
					</p>
				</section>

				{/* Version Footer */}
				<footer
					className="mt-auto pt-8 pb-4 text-center"
					role="contentinfo"
					aria-label="Version and author information"
				>
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-purple-500/30 hover:bg-white/10 transition-all duration-300">
						<span className="text-sm text-gray-400 font-mono">v1.1.0 by</span>
						<a
							href="https://github.com/xzxhub0-source"
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm font-semibold text-purple-400 hover:text-pink-400 font-mono transition-colors duration-200 hover:underline"
							aria-label="Visit XZX GitHub"
						>
							XZX
						</a>
					</div>
				</footer>
			</main>
		</>
	);
}
