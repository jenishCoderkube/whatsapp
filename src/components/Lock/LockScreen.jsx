"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, Unlock, ArrowLeft, Delete, RotateCcw } from "lucide-react";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";

export function LockScreen({
  mode = "unlock", // 'unlock' | 'setup'
  lockType = "pin", // 'pin' | 'pattern'
  savedCode = null, // The PIN or Pattern to validate against (if unlocking)
  onSuccess, // Callback on successful entry
  onCancel, // Callback for cancel (if available)
  title = "", // Optional custom title
  layout = "full", // 'full' | 'modal'
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [pattern, setPattern] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [errorState, setErrorState] = useState(false);
  const [setupStep, setSetupStep] = useState(1); // 1 = Enter code, 2 = Confirm code
  const [firstCode, setFirstCode] = useState(null); // To store first code during setup

  const patternGridRef = useRef(null);
  const dotsRefs = useRef([]);

  // Reset states
  useEffect(() => {
    setPin("");
    setPattern([]);
    setErrorState(false);
  }, [lockType, mode, setupStep]);

  // Handle PIN input
  const handlePinKeyPress = (num) => {
    if (errorState) setErrorState(false);
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-submit if we reach 4 digits (if savedCode is 4 digits) or 6 digits
      const targetLength = savedCode ? savedCode.length : 6;
      if (newPin.length === targetLength && mode === "unlock") {
        verifyPin(newPin);
      }
    }
  };

  const handlePinDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handlePinClear = () => {
    setPin("");
  };

  const verifyPin = (enteredPin) => {
    if (enteredPin === savedCode) {
      onSuccess(enteredPin);
    } else {
      setErrorState(true);
      setPin("");
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const handlePinSubmit = () => {
    if (mode === "setup") {
      if (pin.length < 4) {
        setErrorState(true);
        return;
      }
      if (setupStep === 1) {
        setFirstCode(pin);
        setSetupStep(2);
      } else {
        if (pin === firstCode) {
          onSuccess(pin);
        } else {
          setErrorState(true);
          setPin("");
          alert(t("lock.codes_do_not_match") || "Codes do not match. Start over.");
          setSetupStep(1);
          setFirstCode(null);
        }
      }
    } else {
      verifyPin(pin);
    }
  };

  // Pattern unlock helpers
  const getRelativeCoords = (e) => {
    if (!patternGridRef.current) return { x: 0, y: 0 };
    const rect = patternGridRef.current.getBoundingClientRect();
    
    // Support Touch and Mouse events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const getDotIndexFromCoords = (coords) => {
    if (!patternGridRef.current) return -1;
    const rect = patternGridRef.current.getBoundingClientRect();
    const cellSize = rect.width / 3;
    
    const col = Math.floor(coords.x / cellSize);
    const row = Math.floor(coords.y / cellSize);
    
    if (col >= 0 && col < 3 && row >= 0 && row < 3) {
      const idx = row * 3 + col;
      // Check distance from dot center to coordinates to verify user clicked within a threshold
      const dotEl = dotsRefs.current[idx];
      if (dotEl) {
        const dotRect = dotEl.getBoundingClientRect();
        const dotCenterX = dotRect.left - rect.left + dotRect.width / 2;
        const dotCenterY = dotRect.top - rect.top + dotRect.height / 2;
        const dist = Math.hypot(coords.x - dotCenterX, coords.y - dotCenterY);
        // Only trigger if closer than cell size / 2
        if (dist < cellSize * 0.45) {
          return idx;
        }
      }
    }
    return -1;
  };

  const handlePatternStart = (e) => {
    e.preventDefault();
    if (errorState) setErrorState(false);
    
    const coords = getRelativeCoords(e);
    const dotIdx = getDotIndexFromCoords(coords);
    
    setIsDrawing(true);
    setMousePos(coords);
    
    if (dotIdx !== -1) {
      setPattern([dotIdx]);
      if (navigator.vibrate) navigator.vibrate(40);
    }
  };

  const handlePatternMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const coords = getRelativeCoords(e);
    setMousePos(coords);
    
    const dotIdx = getDotIndexFromCoords(coords);
    if (dotIdx !== -1 && !pattern.includes(dotIdx)) {
      setPattern((prev) => {
        const newPattern = [...prev, dotIdx];
        if (navigator.vibrate) navigator.vibrate(30);
        return newPattern;
      });
    }
  };

  const handlePatternEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (pattern.length < 3) {
      setPattern([]);
      return;
    }

    const patternString = pattern.join("-");

    if (mode === "unlock") {
      if (patternString === savedCode) {
        onSuccess(patternString);
      } else {
        setErrorState(true);
        if (navigator.vibrate) navigator.vibrate(200);
        setTimeout(() => {
          setPattern([]);
          setErrorState(false);
        }, 1000);
      }
    } else {
      // Setup Mode
      if (setupStep === 1) {
        setFirstCode(patternString);
        setSetupStep(2);
      } else {
        if (patternString === firstCode) {
          onSuccess(patternString);
        } else {
          setErrorState(true);
          setPattern([]);
          alert(t("lock.patterns_do_not_match") || "Patterns do not match. Start over.");
          setSetupStep(1);
          setFirstCode(null);
          setTimeout(() => setErrorState(false), 1000);
        }
      }
    }
  };

  // Get dot center coordinates relative to grid container for drawing SVG lines
  const getDotCenter = (idx) => {
    const dotEl = dotsRefs.current[idx];
    const gridEl = patternGridRef.current;
    if (!dotEl || !gridEl) return { x: 0, y: 0 };
    
    const dotRect = dotEl.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();
    
    return {
      x: dotRect.left - gridRect.left + dotRect.width / 2,
      y: dotRect.top - gridRect.top + dotRect.height / 2,
    };
  };

  return (
    <div className={cn(
      "flex flex-col select-none animate-fade-in transition-colors duration-200 text-wa-text w-full",
      layout === "modal" ? "p-1" : "min-h-screen bg-wa-bg justify-center items-center p-6"
    )}>
      <div className={cn(
        "w-full flex flex-col",
        layout === "modal"
          ? "max-w-3xl md:flex md:flex-row md:gap-8 md:items-stretch"
          : "max-w-md items-center"
      )}>
        {/* Left Section: Back button + Icon + Title + Description */}
        <div className={cn(
          "flex flex-col flex-1",
          layout === "modal" ? "md:justify-center md:pr-6 md:border-r md:border-wa-border/50" : "items-center"
        )}>
          {onCancel && (
            <button
              onClick={onCancel}
              className="self-start mb-4 p-2 rounded-full hover:bg-wa-hover text-wa-muted transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">{t("common.back")}</span>
            </button>
          )}

          <div className={cn(
            "flex flex-col items-center text-center mb-6 md:mb-0",
            layout === "modal" && "md:py-8"
          )}>
            <div className={cn(
              "h-16 w-16 rounded-full bg-wa-primary/10 flex items-center justify-center text-wa-primary mb-4 border border-wa-primary/20",
              errorState && "bg-red-500/10 text-red-500 border-red-500/20 animate-shake"
            )}>
              {mode === "unlock" ? (
                <Lock className="h-7 w-7" />
              ) : (
                <Unlock className="h-7 w-7" />
              )}
            </div>
            <h2 className="text-xl font-semibold mb-1">
              {title || (mode === "unlock" ? (t("lock.enter_code") || "Screen Locked") : (t("lock.setup_lock") || "Setup Protection"))}
            </h2>
            <p className="text-sm text-wa-muted px-4 leading-relaxed max-w-xs">
              {mode === "unlock"
                ? (lockType === "pin" ? (t("lock.enter_pin_desc") || "Enter your PIN to access WhatsApp") : (t("lock.draw_pattern_desc") || "Draw your pattern to access WhatsApp"))
                : (setupStep === 1
                    ? (lockType === "pin" ? (t("lock.create_pin") || "Enter a 4-6 digit PIN") : (t("lock.create_pattern") || "Draw your unlock pattern"))
                    : (lockType === "pin" ? (t("lock.confirm_pin") || "Re-enter your PIN to confirm") : (t("lock.confirm_pattern") || "Draw pattern again to confirm")))}
            </p>
          </div>
        </div>

        {/* Right Section: Keypad / Pattern pad */}
        <div className={cn(
          "flex flex-col flex-1 items-center justify-center",
          layout === "modal" ? "mt-4 md:mt-0 md:pl-6" : "w-full"
        )}>
          {/* 1. PIN LOCK INTERFACE */}
          {lockType === "pin" && (
            <div className="w-full flex flex-col items-center gap-4">
              {/* PIN Dots Display */}
              <div className="flex justify-center gap-3 py-2">
                {Array.from({ length: mode === "setup" ? 6 : (savedCode?.length || 4) }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-3 w-3 rounded-full border-2 border-wa-muted/40 transition-all duration-150",
                      i < pin.length && "bg-wa-primary border-wa-primary scale-110",
                      errorState && "border-red-500 bg-red-500 animate-shake"
                    )}
                  />
                ))}
              </div>

              {/* PIN Keypad Grid */}
              <div className="grid grid-cols-3 gap-y-3 gap-x-5 w-10/12 max-w-[240px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinKeyPress(num.toString())}
                    className="aspect-square rounded-full bg-wa-header hover:bg-wa-hover text-lg font-medium flex items-center justify-center border border-wa-border/40 transition-all active:scale-95 text-wa-text shadow-sm"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Reset/Clear Button */}
                <button
                  onClick={handlePinClear}
                  className="aspect-square rounded-full flex items-center justify-center text-sm font-semibold text-wa-muted hover:bg-wa-hover transition-colors"
                  title={t("lock.clear") || "Clear"}
                >
                  <RotateCcw className="h-4.5 w-4.5" />
                </button>

                {/* Number 0 */}
                <button
                  onClick={() => handlePinKeyPress("0")}
                  className="aspect-square rounded-full bg-wa-header hover:bg-wa-hover text-lg font-medium flex items-center justify-center border border-wa-border/40 transition-all active:scale-95 text-wa-text shadow-sm"
                >
                  0
                </button>

                {/* Delete / Backspace */}
                <button
                  onClick={handlePinDelete}
                  className="aspect-square rounded-full flex items-center justify-center text-sm font-semibold text-wa-muted hover:bg-wa-hover transition-colors"
                  title={t("lock.delete") || "Delete"}
                >
                  <Delete className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Setup Mode Action Button */}
              {mode === "setup" && (
                <button
                  onClick={handlePinSubmit}
                  disabled={pin.length < 4}
                  className="mt-3 px-6 py-2.5 rounded-full bg-wa-primary hover:bg-wa-primary-hover disabled:bg-wa-muted/30 disabled:text-wa-muted text-white text-xs font-semibold shadow-md transition-colors"
                >
                  {setupStep === 1 ? (t("common.next") || "Next") : (t("common.confirm") || "Confirm")}
                </button>
              )}
            </div>
          )}

          {/* 2. PATTERN LOCK INTERFACE */}
          {lockType === "pattern" && (
            <div className="w-full flex flex-col items-center gap-4">
              {/* Pattern Drawing Pad Container */}
              <div
                ref={patternGridRef}
                onMouseDown={handlePatternStart}
                onMouseMove={handlePatternMove}
                onMouseUp={handlePatternEnd}
                onTouchStart={handlePatternStart}
                onTouchMove={handlePatternMove}
                onTouchEnd={handlePatternEnd}
                className={cn(
                  "relative aspect-square w-full max-w-[240px] bg-wa-header border border-wa-border/50 rounded-2xl p-4 shadow-inner select-none cursor-crosshair touch-none overflow-hidden",
                  errorState && "border-red-500/40"
                )}
              >
                {/* Grid of 3x3 Dots */}
                <div className="grid grid-cols-3 grid-rows-3 h-full w-full">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-center"
                    >
                      <div
                        ref={(el) => (dotsRefs.current[idx] = el)}
                        className={cn(
                          "h-3.5 w-3.5 rounded-full bg-wa-muted/40 transition-all duration-150 z-20",
                          pattern.includes(idx) && "bg-wa-primary scale-125 ring-6 ring-wa-primary/15",
                          errorState && pattern.includes(idx) && "bg-red-500 ring-red-500/15"
                        )}
                      />
                    </div>
                  ))}
                </div>

                {/* Connecting Lines Layer */}
                <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
                  {pattern.map((dotIdx, index) => {
                    if (index === 0) return null;
                    const prevDot = getDotCenter(pattern[index - 1]);
                    const currentDot = getDotCenter(dotIdx);
                    return (
                      <line
                        key={index}
                        x1={prevDot.x}
                        y1={prevDot.y}
                        x2={currentDot.x}
                        y2={currentDot.y}
                        className={cn(
                          "stroke-[2.5] stroke-wa-primary linecap-round",
                          errorState && "stroke-red-500"
                        )}
                      />
                    );
                  })}

                  {isDrawing && pattern.length > 0 && (
                    <line
                      x1={getDotCenter(pattern[pattern.length - 1]).x}
                      y1={getDotCenter(pattern[pattern.length - 1]).y}
                      x2={mousePos.x}
                      y2={mousePos.y}
                      className="stroke-[2.5] stroke-wa-primary/60 linecap-round dash-array-[4,4] animate-dash"
                    />
                  )}
                </svg>
              </div>

              {/* Pattern Dots Feedback Summary */}
              <div className="h-4 flex items-center justify-center">
                {pattern.length > 0 && (
                  <span className="text-[10px] text-wa-muted tracking-wide animate-pulse">
                    {t("lock.connecting") || "Connecting dots..."} ({pattern.length}/9)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shake Animations and Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
        .linecap-round {
          stroke-linecap: round;
        }
      `}} />
    </div>
  );
}
