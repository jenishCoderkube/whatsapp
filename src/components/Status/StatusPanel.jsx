"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import {
  setStatusViewOpen,
  setStatuses,
  setMyStatuses,
  setActiveUser,
  setActiveStatusIndex,
  setUploading,
  setUploadProgress,
  markStatusAsSeenLocal,
  updateStatusReactionLocal,
  setPrivacySettings,
} from "../../redux/slices/statusSlice";
import { statusService } from "../../services/statusService";

// Modular Subcomponents Imports
import { StatusSidebar } from "./StatusSidebar";
import { StatusComposerText } from "./StatusComposerText";
import { StatusComposerMedia } from "./StatusComposerMedia";
import { StatusViewer } from "./StatusViewer";
import { StatusEmptyState } from "./StatusEmptyState";
import { StatusPrivacyModal } from "./StatusPrivacyModal";
import { cn } from "../../utils/cn";

import { AnimatePresence } from "framer-motion";

export function StatusPanel() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  
  // Status Slice States
  const statusViewOpen = useAppSelector((state) => state.status.statusViewOpen);
  const statuses = useAppSelector((state) => state.status.statuses);
  const myStatuses = useAppSelector((state) => state.status.myStatuses);
  const activeUserId = useAppSelector((state) => state.status.activeUserId);
  const activeStatusIndex = useAppSelector((state) => state.status.activeStatusIndex);
  const uploading = useAppSelector((state) => state.status.uploading);
  const uploadProgress = useAppSelector((state) => state.status.uploadProgress);
  const privacy = useAppSelector((state) => state.status.privacy);
  const privacyList = useAppSelector((state) => state.status.privacyList);

  // Local Composition States
  const [composingType, setComposingType] = useState(null); // 'text' | 'media' | null
  
  // Media Upload States
  const [selectedMedia, setSelectedMedia] = useState(null); // File object
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  
  // Modal & Viewer UI States
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  // Progress Bar tracking
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0);
  const [viewerProgress, setViewerProgress] = useState(0);

  // Refs
  const videoRef = useRef(null);

  // Grouped status lists computed from fetched list
  const contactGroups = statuses.filter((g) => g.userId !== user?.id);
  const recentUpdates = contactGroups.filter((g) => g.hasUnseen);
  const viewedUpdates = contactGroups.filter((g) => !g.hasUnseen);

  // Currently playing status items
  const activeGroup = statuses.find((g) => g.userId === activeUserId);
  const activeStatus = activeGroup?.statuses?.[activeStatusIndex];

  // Duration for current item
  const playDuration = activeStatus?.type === "video" ? 15000 : 5000;

  // Load and subscribe to statuses
  useEffect(() => {
    if (!user?.id || !statusViewOpen) return;

    const loadStatuses = async () => {
      try {
        const data = await statusService.fetchStatuses(user.id);
        dispatch(setStatuses(data));
        
        // Extract my status group if any
        const myGroup = data.find((g) => g.userId === user.id);
        if (myGroup) {
          dispatch(setMyStatuses(myGroup.statuses));
        } else {
          dispatch(setMyStatuses([]));
        }
      } catch (err) {
        console.warn("Failed loading status list:", err);
      }
    };

    loadStatuses();

    // Subscribe to realtime updates
    const subscription = statusService.subscribeToStatuses(() => {
      loadStatuses();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, statusViewOpen, dispatch]);

  // Handle auto-advancing progress timers
  useEffect(() => {
    if (!activeStatus || isPaused) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      return;
    }

    // Mark status as seen when opened
    if (activeUserId !== user?.id && !activeStatus.isSeen) {
      statusService.markStatusAsSeen(activeStatus.id, user.id).then(() => {
        dispatch(markStatusAsSeenLocal({ statusId: activeStatus.id, currentUserId: user.id }));
      });
    }

    startTimeRef.current = Date.now() - pausedTimeRef.current;
    const isVideo = activeStatus.type === "video";
    
    progressIntervalRef.current = setInterval(() => {
      if (isVideo && videoRef.current) {
        const duration = videoRef.current.duration || 15;
        const current = videoRef.current.currentTime || 0;
        const pct = (current / duration) * 100;
        setViewerProgress(Math.min(pct, 100));
        
        if (videoRef.current.ended) {
          handleNextStatus();
        }
      } else {
        const elapsed = Date.now() - startTimeRef.current;
        const pct = (elapsed / playDuration) * 100;
        setViewerProgress(Math.min(pct, 100));

        if (elapsed >= playDuration) {
          handleNextStatus();
        }
      }
    }, 50);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [activeUserId, activeStatusIndex, isPaused, activeStatus?.id]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeUserId) return;
      
      if (e.key === "Escape") {
        dispatch(setActiveUser(null));
      } else if (e.key === "ArrowRight" || e.key === " ") {
        handleNextStatus();
      } else if (e.key === "ArrowLeft") {
        handlePrevStatus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeUserId, activeStatusIndex]);

  // Media File selection
  const handleMediaSelect = (file) => {
    if (file.size > 20 * 1024 * 1024) {
      alert("Media size cannot exceed 20MB.");
      return;
    }

    setSelectedMedia(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setComposingType("media");
  };

  // Close compositions
  const handleCancelComposition = () => {
    setComposingType(null);
    setSelectedMedia(null);
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
      setMediaPreviewUrl(null);
    }
  };

  // Upload text status
  const handleTextStatusSubmit = async ({ textContent, bgColor, textStyle }) => {
    if (!user?.id) return;
    dispatch(setUploading(true));
    dispatch(setUploadProgress(40));

    try {
      await statusService.uploadStatus({
        userId: user.id,
        type: "text",
        textContent,
        bgColor,
        textStyle,
        privacy,
        privacyList,
      });

      dispatch(setUploadProgress(100));
      setTimeout(() => {
        handleCancelComposition();
        dispatch(setUploading(false));
        dispatch(setUploadProgress(null));
        reloadLists();
      }, 500);
    } catch (e) {
      console.error("Upload text status failed:", e);
      alert("Upload failed: " + e.message);
      dispatch(setUploading(false));
      dispatch(setUploadProgress(null));
    }
  };

  // Upload media status
  const handleMediaStatusSubmit = async (caption) => {
    if (!user?.id || !selectedMedia) return;
    dispatch(setUploading(true));
    dispatch(setUploadProgress(30));

    try {
      const fileType = selectedMedia.type.startsWith("video/") ? "video" : "image";
      await statusService.uploadStatus({
        userId: user.id,
        type: fileType,
        mediaFile: selectedMedia,
        caption,
        privacy,
        privacyList,
      });

      dispatch(setUploadProgress(100));
      setTimeout(() => {
        handleCancelComposition();
        dispatch(setUploading(false));
        dispatch(setUploadProgress(null));
        reloadLists();
      }, 500);
    } catch (e) {
      console.error("Upload media status failed:", e);
      alert("Upload failed: " + e.message);
      dispatch(setUploading(false));
      dispatch(setUploadProgress(null));
    }
  };

  const reloadLists = async () => {
    const data = await statusService.fetchStatuses(user.id);
    dispatch(setStatuses(data));
    const myGroup = data.find((g) => g.userId === user.id);
    if (myGroup) {
      dispatch(setMyStatuses(myGroup.statuses));
    }
  };

  // Delete status update
  const handleDeleteStatus = async (statusId) => {
    if (!window.confirm("Are you sure you want to delete this status update?")) return;
    setIsPaused(true);

    try {
      await statusService.deleteStatus(statusId);
      const remaining = myStatuses.filter((s) => s.id !== statusId);
      dispatch(setMyStatuses(remaining));

      if (remaining.length === 0) {
        dispatch(setActiveUser(null));
      } else {
        const nextIndex = Math.max(0, activeStatusIndex - 1);
        dispatch(setActiveStatusIndex(nextIndex));
        setViewerProgress(0);
        pausedTimeRef.current = 0;
        setIsPaused(false);
      }
      reloadLists();
    } catch (e) {
      console.error("Delete status failed:", e);
      setIsPaused(false);
    }
  };

  // Navigation: Next Status
  const handleNextStatus = () => {
    if (!activeGroup) return;

    if (activeStatusIndex < activeGroup.statuses.length - 1) {
      dispatch(setActiveStatusIndex(activeStatusIndex + 1));
      setViewerProgress(0);
      pausedTimeRef.current = 0;
    } else {
      const currentGroupIndex = contactGroups.findIndex((g) => g.userId === activeUserId);
      if (activeUserId !== user?.id && currentGroupIndex !== -1 && currentGroupIndex < contactGroups.length - 1) {
        const nextGroup = contactGroups[currentGroupIndex + 1];
        dispatch(setActiveUser(nextGroup.userId));
        setViewerProgress(0);
        pausedTimeRef.current = 0;
      } else {
        dispatch(setActiveUser(null));
      }
    }
  };

  // Navigation: Previous Status
  const handlePrevStatus = () => {
    if (!activeGroup) return;

    if (activeStatusIndex > 0) {
      dispatch(setActiveStatusIndex(activeStatusIndex - 1));
      setViewerProgress(0);
      pausedTimeRef.current = 0;
    } else {
      const currentGroupIndex = contactGroups.findIndex((g) => g.userId === activeUserId);
      if (activeUserId !== user?.id && currentGroupIndex > 0) {
        const prevGroup = contactGroups[currentGroupIndex - 1];
        dispatch(setActiveUser(prevGroup.userId));
        dispatch(setActiveStatusIndex(prevGroup.statuses.length - 1));
        setViewerProgress(0);
        pausedTimeRef.current = 0;
      } else {
        setViewerProgress(0);
        pausedTimeRef.current = 0;
        startTimeRef.current = Date.now();
      }
    }
  };

  // Send reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !activeStatus) return;
    const textToSend = replyText.trim();
    setReplyText("");

    setIsPaused(true);
    if (videoRef.current) videoRef.current.pause();

    try {
      await statusService.replyToStatus(activeStatus, user.id, textToSend);
      dispatch(
        updateStatusReactionLocal({
          statusId: activeStatus.id,
          viewerId: user.id,
          reaction: null,
        })
      );
      alert("Reply sent to " + activeGroup.name + "!");
    } catch (e) {
      console.error("Failed to send reply:", e);
    } finally {
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    }
  };

  // Send reaction emoji
  const handleSendReaction = async (emoji) => {
    if (!activeStatus) return;

    setIsPaused(true);
    if (videoRef.current) videoRef.current.pause();

    try {
      await statusService.reactToStatus(activeStatus, user.id, emoji);
      dispatch(
        updateStatusReactionLocal({
          statusId: activeStatus.id,
          viewerId: user.id,
          reaction: emoji,
        })
      );
      createFloatingEmoji(emoji);
      
      setTimeout(() => {
        setIsPaused(false);
        if (videoRef.current) videoRef.current.play().catch(() => {});
        handleNextStatus();
      }, 1000);
    } catch (e) {
      console.error("Failed to send reaction:", e);
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    }
  };

  const createFloatingEmoji = (emoji) => {
    const container = document.getElementById("status-canvas-container");
    if (!container) return;

    const el = document.createElement("div");
    el.innerText = emoji;
    el.className = "absolute bottom-20 left-1/2 transform -translate-x-1/2 text-6xl pointer-events-none select-none z-50 animate-bounce-subtle";
    el.style.animation = "floatUp 1.2s ease-out forwards";
    
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes floatUp {
        0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); }
        20% { opacity: 1; transform: translate(-50%, -30px) scale(1.2); }
        100% { opacity: 0; transform: translate(-50%, -200px) scale(1); }
      }
    `;
    document.head.appendChild(style);
    container.appendChild(el);
    
    setTimeout(() => {
      el.remove();
      style.remove();
    }, 1500);
  };

  if (!statusViewOpen) return null;

  const showViewer = !!activeUserId || !!composingType;

  return (
    <div className="fixed inset-0 z-[150] flex bg-[#0c1317] text-white select-none transition-colors duration-200">
      <div className="flex h-full w-full max-w-[1600px] mx-auto overflow-hidden">
        
        {/* SIDEBAR */}
        <StatusSidebar
          user={user}
          myStatuses={myStatuses}
          recentUpdates={recentUpdates}
          viewedUpdates={viewedUpdates}
          privacy={privacy}
          onClose={() => dispatch(setStatusViewOpen(false))}
          onSelectMyStatus={() => dispatch(setActiveUser(user.id))}
          onSelectGroup={(uid) => dispatch(setActiveUser(uid))}
          onOpenPrivacy={() => setPrivacyModalOpen(true)}
          onTriggerTextComposer={() => setComposingType("text")}
          onTriggerMediaSelect={handleMediaSelect}
          className={showViewer ? "hidden md:flex" : "flex"}
        />

        {/* MAIN CANVAS */}
        <main className={cn(
          "flex-1 h-full bg-[#0c1317] flex flex-col items-center justify-center relative overflow-hidden",
          !showViewer ? "hidden md:flex" : "flex"
        )}>
          <AnimatePresence mode="wait">
            {composingType === "text" && (
              <StatusComposerText
                onCancel={handleCancelComposition}
                onSubmit={handleTextStatusSubmit}
                uploading={uploading}
                uploadProgress={uploadProgress}
              />
            )}

            {composingType === "media" && (
              <StatusComposerMedia
                mediaFile={selectedMedia}
                previewUrl={mediaPreviewUrl}
                onCancel={handleCancelComposition}
                onSubmit={handleMediaStatusSubmit}
                uploading={uploading}
                uploadProgress={uploadProgress}
              />
            )}

            {activeUserId && activeStatus && (
              <StatusViewer
                activeUserId={activeUserId}
                activeGroup={activeGroup}
                activeStatusIndex={activeStatusIndex}
                activeStatus={activeStatus}
                currentUser={user}
                viewerProgress={viewerProgress}
                isPaused={isPaused}
                isMuted={isMuted}
                replyText={replyText}
                onSetReplyText={setReplyText}
                onSetIsPaused={setIsPaused}
                onSetIsMuted={setIsMuted}
                onClose={() => dispatch(setActiveUser(null))}
                onNext={handleNextStatus}
                onPrev={handlePrevStatus}
                onDelete={handleDeleteStatus}
                onSendReply={handleSendReply}
                onSendReaction={handleSendReaction}
                videoRef={videoRef}
              />
            )}

            {!activeUserId && !composingType && (
              <StatusEmptyState />
            )}
          </AnimatePresence>
        </main>

      </div>

      {/* PRIVACY MODAL */}
      <StatusPrivacyModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
        currentPrivacy={privacy}
        currentPrivacyList={privacyList}
        onSave={(data) => dispatch(setPrivacySettings(data))}
      />
    </div>
  );
}
