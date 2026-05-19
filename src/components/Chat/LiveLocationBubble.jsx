"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Navigation, StopCircle, Eye } from "lucide-react";
import { useAppSelector } from "../../hooks/useRedux";
import { locationService } from "../../services/locationService";
import LocationMapModal from "./LocationMapModal";

export default function LiveLocationBubble({ message }) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id;
  const isMsgOutgoing = message.isOutgoing;

  const [isExpired, setIsExpired] = useState(true);
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [showMapModal, setShowMapModal] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const expiresAtString = message.fileName; // Expiration ISO string stored in fileName

  // 1. Calculate time left and expiration status dynamically
  useEffect(() => {
    if (!expiresAtString) return;

    const checkExpiration = () => {
      const expiresAt = new Date(expiresAtString).getTime();
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeftStr("Ended");
      } else {
        setIsExpired(false);
        const minutes = Math.ceil(diff / 60000);
        if (minutes > 60) {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          setTimeLeftStr(`Active (${hours}h ${mins}m left)`);
        } else {
          setTimeLeftStr(`Active (${minutes}m left)`);
        }
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 15000); // Update every 15s

    return () => clearInterval(interval);
  }, [expiresAtString]);

  // Stop sharing action
  const handleStopSharing = async (e) => {
    e.stopPropagation();
    setIsStopping(true);
    try {
      await locationService.stopSharing(message.conversationId, currentUserId);
      setIsExpired(true);
      setTimeLeftStr("Ended");
    } catch (err) {
      console.error(err);
    } finally {
      setIsStopping(false);
    }
  };

  const senderName = message.profiles?.name || (isMsgOutgoing ? "You" : "Contact");

  return (
    <div className="flex flex-col w-[170px] sm:w-[210px] overflow-hidden rounded-xl bg-wa-sidebar border border-wa-border/50 shadow-xs select-none">
      {/* 1. Map Mock Preview Header */}
      <div 
        onClick={() => setShowMapModal(true)}
        className="h-16 sm:h-20 bg-[#e0ece4] dark:bg-[#18252c] relative flex items-center justify-center cursor-pointer group overflow-hidden"
      >
        {/* Simple grid lines representing roads */}
        <div className="absolute inset-0 opacity-20 dark:opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_14px]"></div>
        
        {/* Diagonal "river" / "highway" line representation */}
        <div className="absolute top-0 bottom-0 left-1/3 w-4 bg-sky-200/40 dark:bg-sky-900/20 -rotate-45 transform origin-top"></div>
        
        {/* Pulsing indicator */}
        {!isExpired ? (
          <div className="relative z-10 flex items-center justify-center">
            <div className="absolute w-8 h-8 bg-[#00a884]/20 rounded-full animate-ping"></div>
            <div className="absolute w-5 h-5 bg-[#00a884]/40 rounded-full animate-pulse"></div>
            <div className="w-4 h-4 bg-[#00a884] rounded-full border-2 border-white flex items-center justify-center shadow-md">
              <Navigation className="h-2 w-2 text-white fill-white transform rotate-45 -translate-x-0.5 -translate-y-0.5" />
            </div>
          </div>
        ) : (
          <div className="w-6 h-6 bg-gray-400 dark:bg-gray-600 rounded-full border-2 border-white flex items-center justify-center shadow-md z-10">
            <MapPin className="h-3.5 w-3.5 text-white" />
          </div>
        )}

        {/* Hover overlay CTA */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] sm:text-[10px] font-semibold gap-1 backdrop-blur-xs">
          <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          View Live Map
        </div>
      </div>

      {/* 2. Text Details */}
      <div className="p-2 sm:p-2.5 flex flex-col gap-0.5 text-left bg-wa-sidebar">
        <span className="font-semibold text-[10px] sm:text-[11px] text-wa-text truncate w-full">
          {isMsgOutgoing ? "Your Live Location" : `${senderName}'s Live Location`}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span 
            className={`w-1.5 h-1.5 rounded-full ${
              isExpired ? "bg-gray-400" : "bg-[#25d366] animate-pulse"
            }`}
          ></span>
          <span className="text-[9px] sm:text-[10px] text-wa-muted font-medium">
            {timeLeftStr}
          </span>
        </div>

        {/* 3. Action controls */}
        {!isExpired && (
          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-wa-border/50">
            <button
              onClick={() => setShowMapModal(true)}
              className="flex-1 flex items-center justify-center gap-0.5 py-1 rounded-lg bg-wa-hover hover:bg-wa-active text-wa-text text-[9px] sm:text-[10px] font-bold transition-all border border-wa-border"
            >
              <Eye className="h-3 w-3 text-wa-primary" />
              View
            </button>
            {isMsgOutgoing && (
              <button
                onClick={handleStopSharing}
                disabled={isStopping}
                className="flex-1 flex items-center justify-center gap-0.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-[9px] sm:text-[10px] font-bold transition-all border border-red-100 disabled:opacity-50"
              >
                <StopCircle className="h-3 w-3" />
                Stop
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Fullscreen Map Modal Portal */}
      {showMapModal && (
        <LocationMapModal
          conversationId={message.conversationId}
          currentUserId={currentUserId}
          onClose={() => setShowMapModal(false)}
        />
      )}
    </div>
  );
}
