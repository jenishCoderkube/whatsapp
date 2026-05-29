"use client";

import React, { useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "../../utils/cn";

export function MediaGrid({ messages = [], onImageClick }) {
  const totalCount = messages.length;

  if (totalCount === 0) return null;

  // Single image display
  if (totalCount === 1) {
    const msg = messages[0];
    return (
      <div 
        onClick={() => onImageClick && onImageClick(0)}
        className="relative group cursor-pointer overflow-hidden rounded bg-black/5 dark:bg-white/5 max-w-full select-none"
      >
        <img
          src={msg.mediaUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"}
          alt="Media content"
          className="w-full h-auto max-h-[330px] object-contain rounded transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded">
          <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
        </div>
      </div>
    );
  }

  // 2 images: Side-by-side
  if (totalCount === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 w-full max-w-[320px] aspect-[4/3] rounded overflow-hidden select-none">
        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            onClick={() => onImageClick && onImageClick(index)}
            className="relative group cursor-pointer h-full w-full bg-black/10 overflow-hidden"
          >
            <img
              src={msg.mediaUrl}
              alt={`Grid Item ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <Maximize2 className="h-4.5 w-4.5 text-white drop-shadow-sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3 images: WhatsApp collage (60% left, two stacked on 40% right)
  if (totalCount === 3) {
    return (
      <div className="flex gap-1 w-full max-w-[320px] aspect-[4/3] rounded overflow-hidden select-none">
        {/* Left main image (60% width) */}
        <div
          onClick={() => onImageClick && onImageClick(0)}
          className="relative group cursor-pointer w-[60%] h-full bg-black/10 overflow-hidden"
        >
          <img
            src={messages[0].mediaUrl}
            alt="Grid Item 1"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <Maximize2 className="h-5 w-5 text-white drop-shadow-sm" />
          </div>
        </div>

        {/* Right stacked images (40% width) */}
        <div className="w-[40%] h-full flex flex-col gap-1">
          {[1, 2].map((idx) => (
            <div
              key={messages[idx].id || idx}
              onClick={() => onImageClick && onImageClick(idx)}
              className="relative group cursor-pointer h-[calc(50%-2px)] w-full bg-black/10 overflow-hidden"
            >
              <img
                src={messages[idx].mediaUrl}
                alt={`Grid Item ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <Maximize2 className="h-4 w-4 text-white drop-shadow-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4 or more images: 2x2 grid with count overlay on the last visible grid item
  const displayImages = messages.slice(0, 4);
  const extraCount = totalCount - 3; // E.g., if totalCount is 5, we show 3 normally, and the 4th has overlay "+2"

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full max-w-[320px] aspect-[1/1] rounded overflow-hidden select-none">
      {displayImages.map((msg, index) => {
        const isLastGridItem = index === 3;
        const hasOverlay = isLastGridItem && totalCount > 4;

        return (
          <div
            key={msg.id || index}
            onClick={() => onImageClick && onImageClick(index)}
            className="relative group cursor-pointer h-full w-full bg-black/10 overflow-hidden"
          >
            <img
              src={msg.mediaUrl}
              alt={`Grid Item ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {hasOverlay ? (
              <div className="absolute inset-0 bg-black/55 flex items-center justify-center backdrop-blur-[1px] transition-colors group-hover:bg-black/45">
                <span className="text-white text-xl font-bold font-sans">+{extraCount}</span>
              </div>
            ) : (
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <Maximize2 className="h-4.5 w-4.5 text-white drop-shadow-sm" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
