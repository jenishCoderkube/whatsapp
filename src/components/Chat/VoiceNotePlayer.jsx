"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { cn } from "../../utils/cn";

export function VoiceNotePlayer({ id, mediaUrl, durationMetadata }) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const audioRef = useRef(null);
  const progressContainerRef = useRef(null);

  // Parse metadata duration on mount
  useEffect(() => {
    if (durationMetadata) {
      const parts = String(durationMetadata).split(":");
      if (parts.length === 2) {
        const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        setAudioDuration(secs);
      } else {
        const secs = parseFloat(durationMetadata);
        if (!isNaN(secs)) {
          setAudioDuration(secs);
        }
      }
    }
  }, [durationMetadata]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  // Stop playback when another audio starts playing (global sync)
  useEffect(() => {
    const handleGlobalVoicePlay = (e) => {
      if (e.detail?.id !== id && isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener("wa-voice-play", handleGlobalVoicePlay);
    return () => {
      window.removeEventListener("wa-voice-play", handleGlobalVoicePlay);
    };
  }, [id, isPlaying]);

  const initAudio = () => {
    if (audioRef.current) return audioRef.current;

    setIsLoading(true);
    const audio = new Audio(mediaUrl);
    audioRef.current = audio;

    audio.playbackRate = playbackSpeed;

    audio.oncanplaythrough = () => {
      setIsLoading(false);
      if (audio.duration && audio.duration !== Infinity) {
        setAudioDuration(audio.duration);
      }
    };

    audio.onloadedmetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setAudioDuration(audio.duration);
      }
    };

    audio.onwaiting = () => {
      setIsLoading(true);
    };

    audio.onplaying = () => {
      setIsLoading(false);
    };

    audio.onseeking = () => {
      setIsLoading(true);
    };

    audio.onseeked = () => {
      setIsLoading(false);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setPlaybackProgress(0);
    };

    audio.onerror = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };

    return audio;
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!mediaUrl) return;

    const audio = initAudio();

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Dispatch global play event so other playing audios stop
      window.dispatchEvent(new CustomEvent("wa-voice-play", { detail: { id } }));
      
      audio.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn("Failed to play audio:", err);
          setIsLoading(false);
        });
    }
  };

  const handleSpeedChange = (e) => {
    e.stopPropagation();
    let nextSpeed = 1;
    if (playbackSpeed === 1) nextSpeed = 1.5;
    else if (playbackSpeed === 1.5) nextSpeed = 2;
    
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const audio = initAudio();
    if (!progressContainerRef.current) return;

    const rect = progressContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickedPct = Math.max(0, Math.min(1, clickX / width));

    const durationToUse = audio.duration && audio.duration !== Infinity 
      ? audio.duration 
      : audioDuration || 0;

    if (durationToUse) {
      const newTime = clickedPct * durationToUse;
      audio.currentTime = newTime;
      setCurrentTime(newTime);
      setPlaybackProgress(clickedPct * 100);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Generate deterministic waveform based on ID
  const generateWaveform = (seed) => {
    const bars = 22;
    const waveform = [];
    for (let i = 0; i < bars; i++) {
      const charCode = seed ? seed.charCodeAt(i % seed.length) : i;
      const height = 15 + ((charCode * 13 + i * 7) % 70); // between 15% and 85%
      waveform.push(height);
    }
    return waveform;
  };

  const waveformBars = generateWaveform(id);

  return (
    <div className="flex items-center gap-3 py-1.5 min-w-[210px] sm:min-w-[260px] select-none text-wa-text">
      {/* Play/Pause Button */}
      <button 
        onClick={togglePlay} 
        className="h-10 w-10 rounded-full bg-wa-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 shrink-0 transition-transform shadow-sm relative"
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isPlaying ? (
          <Pause className="h-5 w-5 fill-white" />
        ) : (
          <Play className="h-5 w-5 fill-white ml-0.5" />
        )}
      </button>

      {/* Waveform & Playback info */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Waveform Visualization Container */}
        <div 
          ref={progressContainerRef}
          onClick={handleSeek}
          className="h-8 flex items-center gap-[3px] cursor-pointer relative justify-between w-full"
        >
          {waveformBars.map((height, idx) => {
            const barPct = (idx / waveformBars.length) * 100;
            const isPlayed = playbackProgress >= barPct;
            return (
              <div 
                key={idx}
                style={{ height: `${height}%` }}
                className={cn(
                  "w-[3px] rounded-full transition-colors duration-150",
                  isPlayed ? "bg-wa-primary" : "bg-wa-border dark:bg-[#374151]"
                )}
              />
            );
          })}
        </div>

        {/* Playback time and Speed badge */}
        <div className="flex items-center justify-between text-[10px] text-wa-muted font-mono leading-none">
          <span>{formatTime(isPlaying ? currentTime : audioDuration)}</span>
          
          <button
            onClick={handleSpeedChange}
            className="px-1.5 py-0.5 rounded bg-wa-hover hover:bg-wa-active border border-wa-border text-wa-text font-bold transition-colors select-none"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
}
