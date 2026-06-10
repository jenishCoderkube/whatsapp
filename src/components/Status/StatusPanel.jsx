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
  muteUser,
  setLoading,
} from "../../redux/slices/statusSlice";
import { statusService } from "../../services/statusService";

// Modular Subcomponents Imports
import { StatusSidebar } from "./StatusSidebar";
import { StatusComposerText } from "./StatusComposerText";
import { StatusComposerMedia } from "./StatusComposerMedia";
import { StatusViewer } from "./StatusViewer";
import { StatusEmptyState } from "./StatusEmptyState";
import { StatusPrivacyModal } from "./StatusPrivacyModal";
import { Loader } from "../ui/Loader";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";
import { AnimatePresence, motion } from "framer-motion";

export function StatusPanel() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  
  // Status Slice States
  const statusViewOpen = useAppSelector((state) => state.status.statusViewOpen);
  const statuses = useAppSelector((state) => state.status.statuses) || [];
  const myStatuses = useAppSelector((state) => state.status.myStatuses) || [];
  const blockedUsers = useAppSelector((state) => state.chat.blockedUsers || []);
  const blockedByUsers = useAppSelector((state) => state.chat.blockedByUsers || []);
  const activeUserId = useAppSelector((state) => state.status.activeUserId);
  const activeStatusIndex = useAppSelector((state) => state.status.activeStatusIndex);
  const loading = useAppSelector((state) => state.status.loading);
  const uploading = useAppSelector((state) => state.status.uploading);
  const uploadProgress = useAppSelector((state) => state.status.uploadProgress);
  const privacy = useAppSelector((state) => state.status.privacy);
  const privacyList = useAppSelector((state) => state.status.privacyList);

  // Local Composition States
  const [composingType, setComposingType] = useState(null); // 'text' | 'media' | null
  
  // Media Batch Upload State
  const [selectedMediaFiles, setSelectedMediaFiles] = useState([]); // Array of File objects
  
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
  const statusesRef = useRef(statuses);
  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  // Grouped status lists computed from fetched list
  const contactGroups = statuses.filter((g) => 
    g.userId !== user?.id &&
    !blockedUsers.includes(g.userId) &&
    !blockedByUsers.includes(g.userId)
  );
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
      // Only trigger UI loader if there is no cache in Redux
      if (statusesRef.current.length === 0) {
        dispatch(setLoading(true));
      }
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
      } finally {
        dispatch(setLoading(false));
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

  // Media Files selection (from Sidebar)
  const handleMediaSelect = (files) => {
    const fileArray = Array.isArray(files) ? files : [files];
    const validFiles = fileArray.filter((file) => file.size <= 25 * 1024 * 1024);
    
    if (validFiles.length === 0) {
      alert("Selected media file is too large (max 25MB).");
      return;
    }

    dispatch(setActiveUser(null));
    setSelectedMediaFiles(validFiles);
    setComposingType("media");
  };

  // Close compositions and clean up states
  const handleCancelComposition = () => {
    setComposingType(null);
    setSelectedMediaFiles([]);
  };

  // Upload text status (with support for rich metadata stickers)
  const handleTextStatusSubmit = async ({ textContent, bgColor, textStyle, metadata }) => {
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
        metadata,
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
      alert(t("status.upload_failed", { error: e.message }));
      dispatch(setUploading(false));
      dispatch(setUploadProgress(null));
    }
  };

  // Upload media statuses sequentially (Drafts array)
  const handleMediaStatusSubmit = async (drafts) => {
    if (!user?.id || !drafts || drafts.length === 0) return;
    dispatch(setUploading(true));
    dispatch(setUploadProgress(5));

    try {
      for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i];
        const fileType = draft.file.type.startsWith("video/") ? "video" : "image";
        
        await statusService.uploadStatus({
          userId: user.id,
          type: fileType,
          mediaFile: draft.file,
          caption: draft.caption,
          privacy,
          privacyList,
          metadata: draft.metadata,
        });

        // Update incremental progress
        const pct = Math.round(((i + 1) / drafts.length) * 100);
        dispatch(setUploadProgress(pct));
      }

      dispatch(setUploadProgress(100));
      setTimeout(() => {
        handleCancelComposition();
        dispatch(setUploading(false));
        dispatch(setUploadProgress(null));
        reloadLists();
      }, 500);
    } catch (e) {
      console.error("Upload media statuses failed:", e);
      alert(t("status.upload_failed", { error: e.message }));
      dispatch(setUploading(false));
      dispatch(setUploadProgress(null));
    }
  };

  const reloadLists = async () => {
    if (statuses.length === 0) {
      dispatch(setLoading(true));
    }
    try {
      const data = await statusService.fetchStatuses(user.id);
      dispatch(setStatuses(data));
      const myGroup = data.find((g) => g.userId === user.id);
      if (myGroup) {
        dispatch(setMyStatuses(myGroup.statuses));
      }
    } catch (e) {
      console.warn("Failed reloading status list:", e);
    } finally {
      dispatch(setLoading(false));
    }
  };

  // Delete status update
  const handleDeleteStatus = async (statusId) => {
    if (!window.confirm(t("status.confirm_delete"))) return;
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
      alert(t("status.reply_sent", { name: activeGroup.name }));
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

  const handleVoteOnPoll = async (optionId) => {
    if (!user?.id || !activeStatus) return;
    try {
      await statusService.voteOnStatusPoll(activeStatus, user.id, optionId);
      reloadLists();
    } catch (e) {
      console.error("Failed to vote on status poll:", e);
    }
  };

  const handleAnswerQuestion = async (answerText) => {
    if (!user?.id || !activeStatus) return;
    try {
      await statusService.answerStatusQuestion(activeStatus, user.id, answerText);
      reloadLists();
    } catch (e) {
      console.error("Failed to submit question answer:", e);
    }
  };

  const handleMuteUserStatus = (userId) => {
    dispatch(muteUser(userId));
    dispatch(setActiveUser(null)); // Close status viewer
    alert("User's status updates have been muted.");
  };

  const handleSeek = (pct) => {
    if (!activeStatus) return;
    if (activeStatus.type === "video" && videoRef.current) {
      const duration = videoRef.current.duration || 15;
      videoRef.current.currentTime = (pct / 100) * duration;
      setViewerProgress(pct);
    } else {
      const elapsed = (pct / 100) * playDuration;
      pausedTimeRef.current = elapsed;
      startTimeRef.current = Date.now() - elapsed;
      setViewerProgress(pct);
    }
  };

  const handleJumpToStatus = (idx) => {
    if (!activeGroup) return;
    dispatch(setActiveStatusIndex(idx));
    setViewerProgress(0);
    pausedTimeRef.current = 0;
    startTimeRef.current = Date.now();
  };

  if (!statusViewOpen) return null;

  const showViewer = !!activeUserId || !!composingType;

  return (
    <div className="fixed inset-0 z-[150] flex bg-wa-sidebar text-wa-text select-none transition-colors duration-200">
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
          onTriggerTextComposer={() => {
            dispatch(setActiveUser(null));
            setComposingType("text");
          }}
          onTriggerMediaSelect={handleMediaSelect}
          className={showViewer ? "hidden md:flex" : "flex"}
        />

        {/* MAIN CANVAS */}
        <main className={cn(
          "flex-1 h-full bg-wa-bg flex flex-col items-center justify-center relative overflow-hidden",
          !showViewer ? "hidden md:flex" : "flex"
        )}>
          <div id="status-canvas-container" className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {composingType === "text" ? (
                <StatusComposerText
                  key="status-composer-text"
                  onCancel={handleCancelComposition}
                  onSubmit={handleTextStatusSubmit}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                />
              ) : composingType === "media" ? (
                <StatusComposerMedia
                  key="status-composer-media"
                  mediaFiles={selectedMediaFiles}
                  onCancel={handleCancelComposition}
                  onSubmit={handleMediaStatusSubmit}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                />
              ) : activeUserId && activeStatus ? (
                <StatusViewer
                  key={`status-viewer-${activeUserId}-${activeStatus.id}`}
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
                  onVoteOnPoll={handleVoteOnPoll}
                  onAnswerQuestion={handleAnswerQuestion}
                  onMuteUser={handleMuteUserStatus}
                  onSeek={handleSeek}
                  onJumpToStatus={handleJumpToStatus}
                />
              ) : (
                loading ? (
                  <motion.div
                    key="status-loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center p-8"
                  >
                    <Loader size="lg" />
                  </motion.div>
                ) : (
                  <StatusEmptyState key="status-empty-state" />
                )
              )}
            </AnimatePresence>
          </div>
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
