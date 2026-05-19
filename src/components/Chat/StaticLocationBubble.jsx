"use client";

import React from "react";
import { MapPin, ExternalLink } from "lucide-react";

export default function StaticLocationBubble({ message }) {
  const coordinates = message.mediaUrl || "";
  const [lat, lng] = coordinates.split(",");

  const handleOpenMap = () => {
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, "_blank");
  };

  return (
    <div 
      onClick={handleOpenMap}
      className="flex flex-col w-[170px] sm:w-[210px] overflow-hidden rounded-xl bg-wa-sidebar border border-wa-border/50 shadow-xs cursor-pointer group select-none"
    >
      {/* 1. Styled Map Mock Background with red pin in the center */}
      <div className="h-16 sm:h-20 bg-[#e0ece4] dark:bg-[#18252c] relative flex items-center justify-center overflow-hidden">
        {/* Simple grid lines representing roads */}
        <div className="absolute inset-0 opacity-20 dark:opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_14px]"></div>
        
        {/* Road line representation */}
        <div className="absolute top-0 bottom-0 left-1/3 w-4 bg-sky-200/40 dark:bg-sky-900/20 -rotate-45 transform origin-top"></div>
        <div className="absolute left-0 right-0 top-1/2 h-3 bg-white/20 dark:bg-white/5 shadow-xs"></div>

        {/* Central static pin */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-5.5 h-5.5 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30 animate-pulse absolute -top-0.5"></div>
          <MapPin className="h-4 w-4 text-red-500 fill-red-500 relative drop-shadow-md" />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] sm:text-[10px] font-semibold gap-1 backdrop-blur-xs">
          <ExternalLink className="h-3 w-3" />
          Open in Google Maps
        </div>
      </div>

      {/* 2. Text Details */}
      <div className="p-1.5 sm:p-2 bg-wa-sidebar flex items-center justify-between">
        <div className="flex flex-col gap-0.5 text-left">
          <span className="font-semibold text-[10px] sm:text-[11px] text-wa-text">
            Current Location
          </span>
          <span className="text-[8px] sm:text-[9px] text-wa-muted">
            {lat && lng ? `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°` : "Static Location"}
          </span>
        </div>
        <span className="text-[8px] sm:text-[9px] font-bold text-wa-primary hover:underline flex items-center gap-0.5">
          View Map
        </span>
      </div>
    </div>
  );
}
