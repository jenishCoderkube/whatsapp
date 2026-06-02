"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  MoreVertical,
} from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

export function MediaViewer({ isOpen, onClose, mediaList = [], initialIndex = 0 }) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const containerRef = useRef(null);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close more menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Reset zoom and rotation on media change
  useEffect(() => {
    setScale(1);
    setRotation(0);
    setIsImageLoaded(false);
    setShowMoreMenu(false);
  }, [currentIndex]);

  const activeMedia = mediaList[currentIndex];

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < mediaList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, mediaList.length]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = () => {
    if (activeMedia?.mediaUrl) {
      const link = document.createElement("a");
      link.href = activeMedia.mediaUrl;
      link.download = activeMedia.fileName || `image-${Date.now()}.png`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Error enabling fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "r" || e.key === "R") {
        handleRotate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  // Track fullscreen changes from outside (e.g. Esc key or browser UI)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (!activeMedia || !mounted) return null;

  const displayTime = activeMedia.createdAt
    ? new Date(activeMedia.createdAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : activeMedia.timestamp;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] bg-neutral-950/98 text-white select-none flex flex-col font-sans"
        >
          {/* Top Bar / Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 bg-neutral-900/80 backdrop-blur-md z-10 shrink-0">
            {/* Info details */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/10 rounded-full shrink-0">
                <User className="h-5 w-5 text-neutral-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-100 truncate flex items-center gap-1.5 whitespace-nowrap">
                  {activeMedia.isForwarded && (
                    <span className="text-[10px] bg-white/10 text-neutral-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-normal whitespace-nowrap">
                      <svg viewBox="0 0 24 24" width="10" height="10" className="fill-neutral-300 inline shrink-0 rotate-[-45deg]">
                        <path d="M15 5l-1.41 1.41L18.17 11H2V13h16.17l-4.59 4.59L15 19l7-7-7-7z" />
                      </svg>
                      {t("chat.forwarded")}
                    </span>
                  )}
                  <span className="truncate">{activeMedia.senderName || t("chat.shared_image") || "Shared Photo"}</span>
                </p>
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{displayTime}</span>
                </div>
              </div>
            </div>

            {/* Slide counter */}
            {mediaList.length > 1 && (
              <span className="hidden sm:inline text-sm font-medium text-neutral-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                {currentIndex + 1} / {mediaList.length}
              </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2 border-none">
              <button
                onClick={handleZoomOut}
                disabled={scale <= 1}
                className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                title={t("chat.zoom_out") || "Zoom Out"}
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                onClick={handleZoomIn}
                disabled={scale >= 4}
                className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                title={t("chat.zoom_in") || "Zoom In"}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={handleRotate}
                className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title={t("chat.rotate") || "Rotate"}
              >
                <RotateCw className="h-5 w-5" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title={t("chat.download") || "Download"}
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title={isFullscreen ? t("chat.exit_fullscreen") || "Exit Fullscreen" : t("chat.fullscreen") || "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>

              {/* More Actions Dropdown (Mobile only) */}
              <div className="relative sm:hidden" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  title="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 top-10 w-48 bg-neutral-900 border border-white/10 rounded-lg shadow-xl py-1 z-30 text-neutral-200 text-sm">
                    <button
                      onClick={() => {
                        handleZoomIn();
                        setShowMoreMenu(false);
                      }}
                      disabled={scale >= 4}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ZoomIn className="h-4 w-4" />
                      <span>{t("chat.zoom_in") || "Zoom In"}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleZoomOut();
                        setShowMoreMenu(false);
                      }}
                      disabled={scale <= 1}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ZoomOut className="h-4 w-4" />
                      <span>{t("chat.zoom_out") || "Zoom Out"}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleRotate();
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-white/5"
                    >
                      <RotateCw className="h-4 w-4" />
                      <span>{t("chat.rotate") || "Rotate"}</span>
                    </button>
                    <button
                      onClick={() => {
                        toggleFullscreen();
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-white/5"
                    >
                      {isFullscreen ? (
                        <>
                          <Minimize2 className="h-4 w-4" />
                          <span>{t("chat.exit_fullscreen") || "Exit Fullscreen"}</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-4 w-4" />
                          <span>{t("chat.fullscreen") || "Fullscreen"}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="hidden sm:block w-[1px] h-6 bg-white/15 mx-1" />
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white transition-all cursor-pointer"
                title={t("common.close") || "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
            {/* Left Navigation Arrow */}
            {mediaList.length > 1 && currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-neutral-900/60 hover:bg-neutral-900 border border-white/10 rounded-full text-white/80 hover:text-white hover:scale-105 transition-all z-20 shadow-lg cursor-pointer"
                title={t("common.previous") || "Previous"}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Right Navigation Arrow */}
            {mediaList.length > 1 && currentIndex < mediaList.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-neutral-900/60 hover:bg-neutral-900 border border-white/10 rounded-full text-white/80 hover:text-white hover:scale-105 transition-all z-20 shadow-lg cursor-pointer"
                title={t("common.next") || "Next"}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Image Container with Loading State */}
            <div className="relative max-h-full max-w-full flex items-center justify-center">
              {!isImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center z-0">
                  <div className="w-12 h-12 border-4 border-wa-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <motion.div
                key={currentIndex}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="relative overflow-visible"
              >
                <motion.img
                  src={activeMedia.mediaUrl}
                  alt="Fullscreen Media"
                  className="max-h-[75vh] max-w-full object-contain rounded-md shadow-2xl pointer-events-auto"
                  style={{
                    scale,
                    rotate: `${rotation}deg`,
                  }}
                  drag={scale > 1}
                  dragConstraints={{ left: -200 * scale, right: 200 * scale, top: -150 * scale, bottom: 150 * scale }}
                  dragElastic={0.15}
                  onLoad={() => setIsImageLoaded(true)}
                  loading="lazy"
                />
              </motion.div>
            </div>
          </div>

          {/* Footer Area: Text Caption & Thumbnails */}
          <div className="border-t border-white/10 bg-neutral-900/90 backdrop-blur-md px-4 py-3 z-10 shrink-0 flex flex-col items-center gap-3">
            {/* Caption display */}
            {activeMedia.text && (
              <div className="max-w-2xl text-center px-4 py-1.5 rounded-lg bg-black/40 border border-white/5 text-sm leading-relaxed text-neutral-200">
                {activeMedia.text}
              </div>
            )}

            {/* Thumbnail Strip */}
            {mediaList.length > 1 && (
              <>
                <style>{`
                  .viewer-thumbnails-container::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                <div
                  className={`flex items-center gap-3 max-w-full overflow-x-auto px-4 py-2 select-none viewer-thumbnails-container ${
                    mediaList.length > 8 ? "justify-start" : "justify-start sm:justify-center"
                  }`}
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {mediaList.map((media, idx) => (
                    <button
                      key={media.id || idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded transition-all shrink-0 p-[2px] cursor-pointer bg-neutral-800 ${
                        idx === currentIndex
                          ? "scale-105 shadow-md shadow-wa-primary/20 ring-2 ring-wa-primary"
                          : "opacity-50 hover:opacity-100 ring-2 ring-transparent hover:ring-white/20"
                      }`}
                    >
                      <div className="w-full h-full rounded overflow-hidden">
                        <img
                          src={media.mediaUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
