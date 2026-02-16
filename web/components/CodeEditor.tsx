"use client";

import React, { useRef, useEffect } from "react";
import Editor, { type OnMount, type EditorProps } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { ParseError } from "@/lib/parser";
import { Loader2 } from "lucide-react";

interface CodeEditorProps {
	value: string;
	onChange?: (value: string) => void;
	error?: ParseError;
	readOnly?: boolean;
	height?: string;
	options?: editor.IStandaloneEditorConstructionOptions; // Add this line
}

export function CodeEditor({ 
	value, 
	onChange, 
	error, 
	readOnly = false, 
	height = "100%",
	options = {} // Add default empty object
}: CodeEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const monacoRef = useRef<any>(null);

	const handleEditorDidMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;
		monacoRef.current = monaco;

		// Configure Lua language
		monaco.languages.register({ id: "lua" });

		// Set Lua syntax highlighting
		monaco.languages.setMonarchTokensProvider("lua", {
			defaultToken: "",
			keywords: [
				"and", "break", "do", "else", "elseif", "end", "false", "for", "function",
				"goto", "if", "in", "local", "nil", "not", "or", "repeat", "return",
				"then", "true", "until", "while"
			],
			builtinFunctions: [
				"print", "require", "module", "package", "string", "table", "math",
				"io", "os", "debug", "coroutine", "bit32", "utf8"
			],
			tokenizer: {
				root: [
					[/--.*$/, "comment"],
					[/\[\[/, { token: "comment", next: "@comment" }],
					[/".*?"/, "string"],
					[/'.*?'/, "string"],
					[/\[(=*)\[.*?\]\1\]/, "string"],
					[/\d*\.?\d+/, "number"],
					[/true|false|nil/, "keyword"],
					[/\b[a-zA-Z_][a-zA-Z0-9_]*\b/, {
						cases: {
							"@keywords": "keyword",
							"@builtinFunctions": "function",
							"@default": "identifier"
						}
					}]
				],
				comment: [
					[/\]\]/, { token: "comment", next: "@pop" }],
					[/.*/, "comment"]
				]
			}
		});

		// Set theme
		monaco.editor.defineTheme("xzx-dark", {
			base: "vs-dark",
			inherit: true,
			rules: [
				{ token: "keyword", foreground: "8b5cf6", fontStyle: "bold" },
				{ token: "function", foreground: "ec4899" },
				{ token: "string", foreground: "a855f7" },
				{ token: "number", foreground: "f59e0b" },
				{ token: "comment", foreground: "6b7280", fontStyle: "italic" },
			],
			colors: {
				"editor.background": "#0a0a0f",
				"editor.foreground": "#e5e7eb",
				"editor.lineHighlightBackground": "#1a1a24",
				"editor.selectionBackground": "#8b5cf633",
				"editor.inactiveSelectionBackground": "#8b5cf622",
				"editorCursor.foreground": "#8b5cf6",
				"editor.lineNumber.foreground": "#4b5563",
				"editor.lineNumber.activeForeground": "#8b5cf6",
				"editorIndentGuide.background": "#374151",
				"editorIndentGuide.activeBackground": "#8b5cf6",
			}
		});

		monaco.editor.setTheme("xzx-dark");
	};

	// Handle error highlighting
	useEffect(() => {
		if (editorRef.current && error) {
			const monaco = monacoRef.current;
			if (!monaco) return;

			const model = editorRef.current.getModel();
			if (!model) return;

			const decorations = [{
				range: new monaco.Range(
					error.line || 1,
					error.column || 1,
					error.line || 1,
					(error.column || 1) + 1
				),
				options: {
					inlineClassName: "error-line",
					hoverMessage: { value: `**Error**: ${error.message}` }
				}
			}];

			editorRef.current.deltaDecorations([], decorations);
		}
	}, [error]);

	// Default editor options
	const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
		readOnly,
		automaticLayout: true,
		wordWrap: "on",
		lineNumbers: "on",
		fontSize: 14,
		scrollBeyondLastLine: false,
		minimap: { enabled: false },
		fontFamily: "JetBrains Mono, Fira Code, monospace",
		fontLigatures: true,
		tabSize: 4,
		insertSpaces: true,
		detectIndentation: true,
		renderWhitespace: "selection",
		lineHeight: 21,
		padding: { top: 10, bottom: 10 },
		renderLineHighlight: "all",
		hideCursorInOverviewRuler: true,
		overviewRulerBorder: false,
		...options // Merge with passed options
	};

	return (
		<div className="relative w-full h-full">
			<Editor
				height={height}
				defaultLanguage="lua"
				value={value}
				onChange={onChange}
				onMount={handleEditorDidMount}
				options={defaultOptions}
				loading={
					<div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
						<Loader2 className="w-8 h-8 animate-spin text-purple-500" />
					</div>
				}
			/>
			<style jsx>{`
				.error-line {
					background: rgba(239, 68, 68, 0.2);
					border-bottom: 2px solid rgb(239, 68, 68);
					position: relative;
				}
			`}</style>
		</div>
	);
}
