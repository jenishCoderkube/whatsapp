"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Check, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export function ImageCropper({ imageUrl, onCrop, onCancel }) {
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 80 }); // Percentages
  const [dragMode, setDragMode] = useState(null); // 'move' | 'tl' | 'tr' | 'bl' | 'br'
  const [aspectRatio, setAspectRatio] = useState("free"); // 'free' | '1:1' | '4:3' | '16:9'
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const startDragRef = useRef({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

  const getAspectNum = (aspect) => {
    if (aspect === "1:1") return 1;
    if (aspect === "4:3") return 4 / 3;
    if (aspect === "16:9") return 16 / 9;
    return null;
  };

  useEffect(() => {
    // Reset crop box when aspect ratio changes
    const aspect = getAspectNum(aspectRatio);
    if (aspect) {
      const boxW = 60;
      // Calculate h based on w and image dims
      if (imageRef.current) {
        const imgW = imageRef.current.clientWidth;
        const imgH = imageRef.current.clientHeight;
        const boxH = (boxW * imgW) / (imgH * aspect);
        setCropBox({
          x: 20,
          y: Math.max(5, (100 - boxH) / 2),
          w: boxW,
          h: Math.min(90, boxH),
        });
      } else {
        setCropBox({ x: 20, y: 20, w: 60, h: 60 / aspect });
      }
    } else {
      setCropBox({ x: 15, y: 15, w: 70, h: 70 });
    }
  }, [aspectRatio]);

  const handleMouseDown = (mode, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    startDragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.w,
      boxH: cropBox.h,
    };
  };

  const handleMouseMove = (e) => {
    if (!dragMode) return;
    e.preventDefault();

    const img = imageRef.current;
    if (!img) return;

    const imgW = img.clientWidth;
    const imgH = img.clientHeight;

    const dx = ((e.clientX - startDragRef.current.mouseX) / imgW) * 100;
    const dy = ((e.clientY - startDragRef.current.mouseY) / imgH) * 100;

    let { boxX, boxY, boxW, boxH } = startDragRef.current;
    const aspect = getAspectNum(aspectRatio);

    if (dragMode === "move") {
      let newX = boxX + dx;
      let newY = boxY + dy;
      
      // Boundaries
      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX + boxW > 100) newX = 100 - boxW;
      if (newY + boxH > 100) newY = 100 - boxH;

      setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
    } else {
      let newX = boxX;
      let newY = boxY;
      let newW = boxW;
      let newH = boxH;

      if (dragMode === "br") {
        newW = Math.max(10, boxW + dx);
        if (aspect) {
          newH = (newW * imgW) / (imgH * aspect);
        } else {
          newH = Math.max(10, boxH + dy);
        }
      } else if (dragMode === "bl") {
        const potentialW = boxW - dx;
        if (potentialW >= 10 && boxX + dx >= 0) {
          newW = potentialW;
          newX = boxX + dx;
          if (aspect) {
            newH = (newW * imgW) / (imgH * aspect);
          } else {
            newH = Math.max(10, boxH + dy);
          }
        }
      } else if (dragMode === "tr") {
        newW = Math.max(10, boxW + dx);
        if (aspect) {
          newH = (newW * imgW) / (imgH * aspect);
          newY = boxY + (boxH - newH);
        } else {
          const potentialH = boxH - dy;
          if (potentialH >= 10 && boxY + dy >= 0) {
            newH = potentialH;
            newY = boxY + dy;
          }
        }
      } else if (dragMode === "tl") {
        const potentialW = boxW - dx;
        if (potentialW >= 10 && boxX + dx >= 0) {
          newW = potentialW;
          newX = boxX + dx;
          if (aspect) {
            newH = (newW * imgW) / (imgH * aspect);
            newY = boxY + (boxH - newH);
          } else {
            const potentialH = boxH - dy;
            if (potentialH >= 10 && boxY + dy >= 0) {
              newH = potentialH;
              newY = boxY + dy;
            }
          }
        }
      }

      // Final boundary validation
      if (newX >= 0 && newY >= 0 && newX + newW <= 100 && newY + newH <= 100) {
        setCropBox({ x: newX, y: newY, w: newW, h: newH });
      }
    }
  };

  const handleMouseUp = () => {
    setDragMode(null);
  };

  useEffect(() => {
    if (dragMode) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      
      // Touch support
      const handleTouchMove = (e) => {
        if (e.touches.length > 0) {
          handleMouseMove(e.touches[0]);
        }
      };
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleMouseUp);
      };
    }
  }, [dragMode, cropBox]);

  const handleCropExecute = () => {
    const img = imageRef.current;
    if (!img) return;

    // Load original image to canvas
    const originalImage = new Image();
    originalImage.crossOrigin = "anonymous";
    originalImage.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const cropX = (cropBox.x / 100) * originalImage.naturalWidth;
      const cropY = (cropBox.y / 100) * originalImage.naturalHeight;
      const cropW = (cropBox.w / 100) * originalImage.naturalWidth;
      const cropH = (cropBox.h / 100) * originalImage.naturalHeight;

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(originalImage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            onCrop(blob);
          }
        },
        "image/webp",
        0.85
      );
    };
    originalImage.src = imageUrl;
  };

  return (
    <div className="absolute inset-0 bg-black/95 z-30 flex flex-col">
      {/* Crop Options Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 shrink-0 text-white border-b border-white/10">
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex items-center gap-2">
          {["free", "1:1", "4:3", "16:9"].map((aspect) => (
            <button
              key={aspect}
              onClick={() => setAspectRatio(aspect)}
              className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider transition-all ${
                aspectRatio === aspect ? "bg-white text-black font-bold" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {aspect}
            </button>
          ))}
        </div>

        <button onClick={handleCropExecute} className="p-2 bg-[#00a884] hover:bg-[#008f72] rounded-full transition-colors">
          <Check className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Editor Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center p-8 overflow-hidden select-none"
      >
        <div className="relative inline-block max-h-full max-w-full">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="To Crop"
            className="max-h-[70vh] max-w-full object-contain select-none pointer-events-none"
          />

          {/* Draggable Cropping Box overlay */}
          <div
            className="absolute border-2 border-dashed border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] cursor-move"
            style={{
              left: `${cropBox.x}%`,
              top: `${cropBox.y}%`,
              width: `${cropBox.w}%`,
              height: `${cropBox.h}%`,
            }}
            onMouseDown={(e) => handleMouseDown("move", e)}
            onTouchStart={(e) => {
              if (e.touches.length > 0) handleMouseDown("move", e.touches[0]);
            }}
          >
            {/* Grid Lines inside */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
              <div className="border-r border-b border-white border-dashed"></div>
              <div className="border-r border-b border-white border-dashed"></div>
              <div className="border-b border-white border-dashed"></div>
              <div className="border-r border-b border-white border-dashed"></div>
              <div className="border-r border-b border-white border-dashed"></div>
              <div className="border-b border-white border-dashed"></div>
              <div className="border-r border-white border-dashed"></div>
              <div className="border-r border-white border-dashed"></div>
              <div></div>
            </div>

            {/* Corner Resize Handles */}
            <div
              className="absolute -top-1.5 -left-1.5 h-4.5 w-4.5 border-t-3 border-l-3 border-[#00a884] cursor-nwse-resize z-10"
              onMouseDown={(e) => handleMouseDown("tl", e)}
              onTouchStart={(e) => {
                if (e.touches.length > 0) handleMouseDown("tl", e.touches[0]);
              }}
            />
            <div
              className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 border-t-3 border-r-3 border-[#00a884] cursor-nesw-resize z-10"
              onMouseDown={(e) => handleMouseDown("tr", e)}
              onTouchStart={(e) => {
                if (e.touches.length > 0) handleMouseDown("tr", e.touches[0]);
              }}
            />
            <div
              className="absolute -bottom-1.5 -left-1.5 h-4.5 w-4.5 border-b-3 border-l-3 border-[#00a884] cursor-nesw-resize z-10"
              onMouseDown={(e) => handleMouseDown("bl", e)}
              onTouchStart={(e) => {
                if (e.touches.length > 0) handleMouseDown("bl", e.touches[0]);
              }}
            />
            <div
              className="absolute -bottom-1.5 -right-1.5 h-4.5 w-4.5 border-b-3 border-r-3 border-[#00a884] cursor-nwse-resize z-10"
              onMouseDown={(e) => handleMouseDown("br", e)}
              onTouchStart={(e) => {
                if (e.touches.length > 0) handleMouseDown("br", e.touches[0]);
              }}
            />
          </div>
        </div>
      </div>
      <div className="text-center py-4 bg-black/60 text-white/50 text-xs shrink-0 select-none">
        Drag corners to resize. Drag box center to move. Click check to apply.
      </div>
    </div>
  );
}
