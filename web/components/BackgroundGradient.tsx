"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * BackgroundGradientAnimation component creates an animated gradient background
 * with interactive mouse tracking and smooth color transitions.
 *
 * @param gradientBackgroundStart - Starting gradient color
 * @param gradientBackgroundEnd - Ending gradient color
 * @param firstColor - First animated gradient blob color (RGB format)
 * @param secondColor - Second animated gradient blob color (RGB format)
 * @param thirdColor - Third animated gradient blob color (RGB format)
 * @param fourthColor - Fourth animated gradient blob color (RGB format)
 * @param fifthColor - Fifth animated gradient blob color (RGB format)
 * @param pointerColor - Interactive pointer gradient color (RGB format)
 * @param size - Size of gradient blobs
 * @param blendingValue - CSS blend mode for gradient mixing
 * @param interactive - Enable/disable mouse interaction
 * @param children - Child components to render on top
 * @param className - Additional CSS classes for children wrapper
 * @param containerClassName - Additional CSS classes for container
 */
export const BackgroundGradientAnimation = ({
	gradientBackgroundStart = "rgb(5, 5, 8)", // XZX dark
	gradientBackgroundEnd = "rgb(10, 10, 15)", // XZX darker
	firstColor = "139, 92, 246", // XZX purple
	secondColor = "168, 85, 247", // Medium purple
	thirdColor = "192, 38, 211", // Fuchsia
	fourthColor = "236, 72, 153", // XZX pink
	fifthColor = "219, 39, 119", // Dark pink
	pointerColor = "139, 92, 246", // XZX purple
	size = "80%",
	blendingValue = "hard-light",
	children,
	className,
	interactive = true,
	containerClassName,
}: {
	gradientBackgroundStart?: string;
	gradientBackgroundEnd?: string;
	firstColor?: string;
	secondColor?: string;
	thirdColor?: string;
	fourthColor?: string;
	fifthColor?: string;
	pointerColor?: string;
	size?: string;
	blendingValue?: string;
	children?: React.ReactNode;
	className?: string;
	interactive?: boolean;
	containerClassName?: string;
}) => {
	const interactiveRef = useRef<HTMLDivElement>(null);
	const [curX, setCurX] = useState(0);
	const [curY, setCurY] = useState(0);
	const [tgX, setTgX] = useState(0);
	const [tgY, setTgY] = useState(0);

	useEffect(() => {
		document.body.style.setProperty("--gradient-background-start", gradientBackgroundStart);
		document.body.style.setProperty("--gradient-background-end", gradientBackgroundEnd);
		document.body.style.setProperty("--first-color", firstColor);
		document.body.style.setProperty("--second-color", secondColor);
		document.body.style.setProperty("--third-color", thirdColor);
		document.body.style.setProperty("--fourth-color", fourthColor);
		document.body.style.setProperty("--fifth-color", fifthColor);
		document.body.style.setProperty("--pointer-color", pointerColor);
		document.body.style.setProperty("--size", size);
		document.body.style.setProperty("--blending-value", blendingValue);
	}, [
		gradientBackgroundStart,
		gradientBackgroundEnd,
		firstColor,
		secondColor,
		thirdColor,
		fourthColor,
		fifthColor,
		pointerColor,
		size,
		blendingValue,
	]);

	useEffect(() => {
		function move() {
			if (!interactiveRef.current) return;
			setCurX(curX + (tgX - curX) / 20);
			setCurY(curY + (tgY - curY) / 20);
			interactiveRef.current.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
		}
		move();
	}, [tgX, tgY, curX, curY]);

	const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
		if (interactiveRef.current) {
			const rect = interactiveRef.current.getBoundingClientRect();
			setTgX(event.clientX - rect.left);
			setTgY(event.clientY - rect.top);
		}
	};

	const [isSafari, setIsSafari] = useState(false);
	useEffect(() => {
		setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
	}, []);

	return (
		<div
			className={cn(
				"h-screen w-screen fixed top-0 left-0 -z-10 bg-[linear-gradient(40deg,var(--gradient-background-start),var(--gradient-background-end))]",
				containerClassName
			)}
		>
			<svg className="hidden">
				<defs>
					<filter id="blurMe">
						<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
						<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
						<feBlend in="SourceGraphic" in2="goo" />
					</filter>
				</defs>
			</svg>
			<div className={cn("relative z-10", className)}>{children}</div>
			<div
				className={cn(
					"gradients-container h-full w-full blur-lg",
					isSafari ? "blur-2xl" : "[filter:url(#blurMe)_blur(40px)]"
				)}
			>
				<div
					className={cn(
						`absolute [background:radial-gradient(circle_at_center,_rgba(var(--first-color),_0.9)_0,_rgba(var(--first-color),_0)_50%)_no-repeat]`,
						`[mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
						`[transform-origin:center_center]`,
						`animate-first`,
						`opacity-100`,
						`will-change-transform`
					)}
				></div>
				<div
					className={cn(
						`absolute [background:radial-gradient(circle_at_center,_rgba(var(--second-color),_0.9)_0,_rgba(var(--second-color),_0)_50%)_no-repeat]`,
						`[mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
						`[transform-origin:calc(50%-400px)]`,
						`animate-second`,
						`opacity-100`,
						`will-change-transform`
					)}
				></div>
				<div
					className={cn(
						`absolute [background:radial-gradient(circle_at_center,_rgba(var(--third-color),_0.9)_0,_rgba(var(--third-color),_0)_50%)_no-repeat]`,
						`[mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
						`[transform-origin:calc(50%+400px)]`,
						`animate-third`,
						`opacity-100`,
						`will-change-transform`
					)}
				></div>
				<div
					className={cn(
						`absolute [background:radial-gradient(circle_at_center,_rgba(var(--fourth-color),_0.85)_0,_rgba(var(--fourth-color),_0)_50%)_no-repeat]`,
						`[mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
						`[transform-origin:calc(50%-200px)]`,
						`animate-fourth`,
						`opacity-80`,
						`will-change-transform`
					)}
				></div>
				<div
					className={cn(
						`absolute [background:radial-gradient(circle_at_center,_rgba(var(--fifth-color),_0.9)_0,_rgba(var(--fifth-color),_0)_50%)_no-repeat]`,
						`[mix-blend-mode:var(--blending-value)] w-[var(--size)] h-[var(--size)] top-[calc(50%-var(--size)/2)] left-[calc(50%-var(--size)/2)]`,
						`[transform-origin:calc(50%-800px)_calc(50%+800px)]`,
						`animate-fifth`,
						`opacity-100`,
						`will-change-transform`
					)}
				></div>
				{interactive && (
					<div
						ref={interactiveRef}
						onMouseMove={handleMouseMove}
						className={cn(
							`absolute [background:radial-gradient(circle_at_center,_rgba(var(--pointer-color),_0.9)_0,_rgba(var(--pointer-color),_0)_50%)_no-repeat]`,
							`[mix-blend-mode:var(--blending-value)] w-full h-full -top-1/2 -left-1/2`,
							`opacity-80`,
							`transition-opacity duration-300 ease-out`,
							`will-change-transform`
						)}
					></div>
				)}
			</div>
		</div>
	);
};
