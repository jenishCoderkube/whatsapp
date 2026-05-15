"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, MoreVertical, ArrowLeft, Video, Phone, UserPlus, LogOut, Trash2, Loader2, Check, Upload, Download, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { setMobileScreen } from "../../redux/slices/uiSlice";
import { clearUnread, setActiveChat, removeChat, updateChatAvatar } from "../../redux/slices/chatSlice";
import { chatService } from "../../services/chatService";
import { profileService } from "../../services/profileService";
import { storageService } from "../../services/storageService";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../utils/cn";
import { useVoiceCall } from "../../hooks/useVoiceCall";

export function ChatHeader() {
  const dispatch = useAppDispatch();
  const chats = useAppSelector((state) => state.chat.chats);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const messagesDict = useAppSelector((state) => state.message.messages);
  const typingMap = useAppSelector((state) => state.chat.typingMap[activeChatId] || {});
  const user = useAppSelector((state) => state.auth.user);
  const currentUserId = user?.id;

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId ? messagesDict[activeChatId] || [] : [];
  
  const sharedMedia = useMemo(() => {
    return activeMessages.filter(m => (m.type === "image" || m.type === "video") && m.mediaUrl);
  }, [activeMessages]);

  const [infoModal, setInfoModal] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  
  // Group Management States
  const [groupMembers, setGroupMembers] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  
  const groupAvatarFileInputRef = useRef(null);
  
  const { startCall } = useVoiceCall();

  const handleVoiceCallTrigger = () => {
    if (activeChat && !activeChat.isGroup) {
      startCall({
        id: activeChat.peerId,
        name: activeChat.name,
        avatar: activeChat.avatar
      }, activeChat.id);
    } else {
      alert("Voice calling for groups is coming soon!");
    }
  };

  const handleVideoCallTrigger = () => {
    if (activeChat && !activeChat.isGroup) {
      startCall({
        id: activeChat.peerId,
        name: activeChat.name,
        avatar: activeChat.avatar
      }, activeChat.id, "video");
    } else {
      alert("Video calling for groups is coming soon!");
    }
  };

  useEffect(() => {
    if (infoModal && activeChat?.isGroup) {
      fetchMembers();
    }
  }, [infoModal, activeChatId]);

  const fetchMembers = async () => {
    if (!activeChatId) return;
    setIsFetchingMembers(true);
    try {
      const members = await chatService.getGroupMembers(activeChatId);
      setGroupMembers(members);
    } catch (e) {
      console.warn("Fetch members failed", e);
    } finally {
      setIsFetchingMembers(false);
    }
  };

  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;

    setIsUpdatingAvatar(true);
    try {
      const uploadedUrl = await storageService.uploadFile(file, "avatars");
      await chatService.updateGroupAvatar(activeChatId, uploadedUrl);
      dispatch(updateChatAvatar({ chatId: activeChatId, avatar: uploadedUrl }));
    } catch (err) {
      console.error("Failed to update group avatar:", err);
      alert("Failed to update group avatar.");
    } finally {
      setIsUpdatingAvatar(false);
      if (e.target) e.target.value = "";
    }
  };

  // Debounced search for adding members
  useEffect(() => {
    if (!showAddMember) return;
    const timer = setTimeout(() => {
      setIsSearching(true);
      profileService.searchProfiles(userSearchQuery, currentUserId).then((res) => {
        // Filter out existing members
        const filtered = res.filter(p => !groupMembers.some(m => m.id === p.id));
        setSearchResults(filtered);
        setIsSearching(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, showAddMember, groupMembers]);

  if (!activeChat) return null;

  const isAdmin = activeChat.groupCreatorId === currentUserId;

  // Realtime membership sync
  useEffect(() => {
    if (!activeChatId) return;

    const channel = supabase
      .channel(`members-${activeChatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${activeChatId}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  const handleAddMember = async (targetId) => {
    setIsActionPending(true);
    try {
      await chatService.addGroupMembers(activeChatId, [targetId], currentUserId);
      await fetchMembers();
      setShowAddMember(false);
    } catch (e) {
      alert("Failed to add member");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRemoveMember = async (targetId) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    setIsActionPending(true);
    try {
      await chatService.removeGroupMember(activeChatId, targetId, currentUserId);
      await fetchMembers();
    } catch (e) {
      alert("Failed to remove member");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    setIsActionPending(true);
    try {
      await chatService.leaveGroup(activeChatId, currentUserId);
      dispatch(removeChat(activeChatId));
      dispatch(setActiveChat(null));
      setInfoModal(false);
    } catch (e) {
      alert("Failed to leave group");
    } finally {
      setIsActionPending(false);
    }
  };

  // Check if any remote peer is dynamically typing inside this view channel
  const isPeerTyping = Object.keys(typingMap).some((uid) => uid !== currentUserId);
  const typingNames = Object.entries(typingMap)
    .filter(([uid]) => uid !== currentUserId)
    .map(([_, name]) => (typeof name === "string" ? name : "Someone"));

  const typingText = typingNames.length > 1 
    ? `${typingNames.join(", ")} are typing...`
    : `${typingNames[0]} is typing...`;

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return activeChat.phoneNumber;
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isToday) {
      return `last seen today at ${timeStr}`;
    } else if (isYesterday) {
      return `last seen yesterday at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
      return `last seen ${dateStr} at ${timeStr}`;
    }
  };

  const renderSubtitle = () => {
    if (activeChat.isGroup) {
      const count = groupMembers.length > 0 ? groupMembers.length : activeChat.groupMembersCount || 0;
      return `${count} participants`;
    }
    if (activeChat.online) return "Online";
    if (activeChat.lastSeen) return formatLastSeen(activeChat.lastSeen);
    return activeChat.phoneNumber;
  };

  const headerOptions = [
    { label: "Contact Info", onClick: () => setInfoModal(true) },
    { label: "Select Messages", onClick: () => {} },
    { label: "Close Chat", onClick: () => dispatch(setMobileScreen("list")) },
    { label: "Clear messages", danger: true, onClick: () => {} },
  ];

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-wa-header border-b border-wa-border select-none z-[60] shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back navigation support on mobile viewports */}
        <button
          onClick={() => {
            dispatch(setMobileScreen("list"));
            dispatch(setActiveChat(null));
            dispatch(clearUnread(activeChat.id));
          }}
          className="md:hidden block p-1 -ml-1 rounded-full text-wa-muted hover:bg-wa-active transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div onClick={() => setInfoModal(true)} className="cursor-pointer shrink-0 relative group">
          <Avatar src={activeChat.avatar} fallback={activeChat.name[0]} isOnline={activeChat.online} size="md" />
          {activeChat.isGroup && isAdmin && !activeChat.isLeft && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                groupAvatarFileInputRef.current?.click();
              }}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white cursor-pointer"
              title="Change Group Icon"
            >
              <Upload className="h-3 w-3" />
            </div>
          )}
        </div>

        <div onClick={() => setInfoModal(true)} className="flex-1 min-w-0 cursor-pointer">
          <h2 className="text-sm sm:text-base font-medium text-wa-text truncate">
            {activeChat.name}
          </h2>
          {isPeerTyping ? (
            <p className="text-xs text-wa-primary font-medium italic animate-pulse truncate">
              {typingText}
            </p>
          ) : (
            <p className="text-xs text-wa-muted truncate capitalize-first">
              {renderSubtitle()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 text-wa-muted">
        {/* Mobile: Unified Call Dropdown */}
        <div className="sm:hidden block">
          <Dropdown
            trigger={
              <button className="p-2 rounded-full hover:bg-wa-active transition-colors">
                <Phone className="h-4 w-4" />
              </button>
            }
            items={[
              { 
                label: "Voice Call", 
                icon: <Phone className="h-3.5 w-3.5" />, 
                onClick: handleVoiceCallTrigger 
              },
              { 
                label: "Video Call", 
                icon: <Video className="h-3.5 w-3.5" />, 
                onClick: handleVideoCallTrigger 
              },
            ]}
          />
        </div>

        {/* Desktop: Separate Buttons */}
        <button 
          onClick={handleVoiceCallTrigger}
          className="p-2 rounded-full hover:bg-wa-active transition-colors hidden sm:inline-flex" 
          title="Voice Call"
        >
          <Phone className="h-4 w-4" />
        </button>

        <button 
          onClick={handleVideoCallTrigger}
          className="p-2 rounded-full hover:bg-wa-active transition-colors hidden sm:inline-flex" 
          title="Video Call"
        >
          <Video className="h-4 w-4" />
        </button>

        <button className="p-2 rounded-full hover:bg-wa-active transition-colors" title="Search Messages">
          <Search className="h-4 w-4" />
        </button>

        <Dropdown
          trigger={
            <button className="p-2 rounded-full hover:bg-wa-active transition-colors">
              <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          }
          items={headerOptions}
        />
      </div>

      {/* Contact modal view */}
      <Modal 
        isOpen={infoModal} 
        onClose={() => { setInfoModal(false); setShowAddMember(false); }} 
        title={activeChat.isGroup ? "Group info" : "Contact info"}
        className="md:max-w-3xl"
      >
        <div className="flex flex-col md:flex-row md:items-stretch gap-6 max-h-[75vh] overflow-hidden">
          {/* Left Side: Avatar & Identity */}
          <div className="flex flex-col items-center text-center md:w-5/12 md:border-r md:border-wa-border md:pr-6 overflow-y-auto py-2 shrink-0">
            <input 
              type="file" 
              ref={groupAvatarFileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleGroupAvatarChange}
            />
            
            <div className="relative group mb-4">
              <Avatar src={activeChat.avatar} fallback={activeChat.name[0]} size="xxl" className="shadow-md" />
              {activeChat.isGroup && isAdmin && !activeChat.isLeft && (
                <div 
                  onClick={() => groupAvatarFileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-center cursor-pointer p-4 border-2 border-transparent hover:border-wa-primary/50"
                >
                  <Upload className="h-6 w-6 mb-1" />
                  <span className="text-[10px] font-bold leading-tight">CHANGE GROUP ICON</span>
                </div>
              )}
              {isUpdatingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-wa-modal/80 backdrop-blur-xs z-10">
                  <Loader2 className="h-8 w-8 text-wa-primary animate-spin" />
                </div>
              )}
            </div>

            <h3 className="text-lg font-semibold text-wa-text">{activeChat.name}</h3>
            <p className="text-xs text-wa-primary font-medium mt-1 capitalize-first">{renderSubtitle()}</p>
            
            <div className="w-full mt-6 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
              <span className="text-xs text-wa-muted font-bold uppercase tracking-wider">{activeChat.isGroup ? "Description" : "Details"}</span>
              <span className="text-sm font-medium text-wa-text break-words">
                {activeChat.isGroup ? (activeChat.description || "No group description provided.") : activeChat.phoneNumber}
              </span>
            </div>

            <div className="w-full mt-4 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
              <span className="text-xs text-wa-muted font-bold uppercase tracking-wider">Encryption</span>
              <p className="text-[11px] leading-relaxed text-wa-muted">
                Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
              </p>
            </div>
          </div>

          {/* Right Side: Participants Management */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {activeChat.isGroup ? (
              <div className="flex flex-col h-full relative min-h-[300px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-wa-muted uppercase font-bold tracking-tighter">{groupMembers.length} Participants</span>
                {!activeChat.isLeft && isAdmin && (
                  <button 
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1.5 text-wa-primary text-xs font-semibold hover:bg-wa-active px-2.5 py-1.5 rounded-md transition-all border border-wa-primary/20"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Member
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {isFetchingMembers ? (
                  <div className="py-8 text-center text-xs text-wa-muted flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-wa-primary" />
                    Loading participants...
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {groupMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-wa-hover group transition-all border border-transparent hover:border-wa-border/30">
                        <Avatar src={member.avatar} fallback={member.name[0]} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-wa-text truncate flex items-center gap-2">
                            {member.name}
                            {member.id === currentUserId && <span className="bg-wa-active text-wa-muted text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-tighter">You</span>}
                            {member.id === activeChat.groupCreatorId && <span className="bg-wa-primary/10 text-wa-primary text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-tighter border border-wa-primary/20">Admin</span>}
                          </div>
                          <div className="text-[11px] text-wa-muted truncate">{member.status || "Available"}</div>
                        </div>
                        
                        {isAdmin && member.id !== currentUserId && !activeChat.isLeft && (
                          <button 
                            onClick={() => handleRemoveMember(member.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded-full text-red-500 hover:bg-red-50 transition-all cursor-pointer shadow-sm bg-white dark:bg-wa-sidebar"
                            title="Remove from group"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {sharedMedia.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-wa-border">
                    <span className="text-xs text-wa-muted uppercase font-bold tracking-widest mb-2 block">Shared Media</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {sharedMedia.map(msg => (
                        <div 
                          key={msg.id} 
                          onClick={() => setLightboxMedia(msg)}
                          className="aspect-square bg-wa-border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {msg.type === "image" ? (
                            <img src={msg.mediaUrl} alt="Media" className="w-full h-full object-cover" />
                          ) : (
                            <video src={msg.mediaUrl} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!activeChat.isLeft && (
                <div className="mt-4 pt-4 border-t border-wa-border">
                  <button 
                    onClick={handleLeaveGroup}
                    className="flex items-center justify-center gap-2 text-red-500 text-sm font-bold hover:bg-red-50 w-full py-3 rounded-xl transition-all border border-red-100/50 hover:border-red-200"
                  >
                    <LogOut className="h-4 w-4" />
                    Exit Group
                  </button>
                </div>
              )}

                {/* Add Member Overlay Layer */}
                {showAddMember && (
                  <div className="absolute inset-0 bg-wa-modal z-20 animate-scale-up flex flex-col p-0">
                    <div className="flex items-center gap-3 mb-4 p-1">
                      <button onClick={() => setShowAddMember(false)} className="p-2 hover:bg-wa-active rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-wa-text">Add Participant</span>
                        <span className="text-[10px] text-wa-muted uppercase tracking-widest">Select from contacts</span>
                      </div>
                    </div>
                    
                    <div className="relative mb-4 px-1">
                      <Input 
                        placeholder="Search users..." 
                        value={userSearchQuery} 
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="h-10 text-sm pl-10 rounded-xl"
                        autoFocus
                      />
                      <Search className="absolute left-4 top-3 h-4 w-4 text-wa-muted" />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      {isSearching ? (
                        <div className="text-center py-8 text-xs text-wa-muted flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-wa-primary" />
                          Scanning directory...
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {searchResults.map((p) => (
                            <div 
                              key={p.id} 
                              onClick={() => handleAddMember(p.id)}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-wa-hover cursor-pointer transition-all border border-transparent hover:border-wa-border/50 group"
                            >
                              <Avatar src={p.avatar} fallback={p.name[0]} size="md" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-wa-text truncate">{p.name}</div>
                                <div className="text-[11px] text-wa-muted truncate">{p.email}</div>
                              </div>
                              <div className="p-1.5 rounded-full bg-wa-primary/10 text-wa-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                <UserPlus className="h-4 w-4" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-sm text-wa-muted italic">
                          No users found matching your search.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Contact Detail view for 1-to-1 chats */
              <div className="flex flex-col gap-4 py-2 h-full overflow-y-auto custom-scrollbar pr-1">
                <div className="bg-wa-header/30 p-4 rounded-xl border border-wa-border/50 shrink-0">
                  <span className="text-xs text-wa-muted uppercase font-bold tracking-widest mb-2 block">Personal Status</span>
                  <p className="text-sm text-wa-text leading-relaxed">
                    {activeChat.status || "Available"}
                  </p>
                </div>
                
                <div className="bg-wa-header/30 p-4 rounded-xl border border-wa-border/50 shrink-0">
                  <span className="text-xs text-wa-muted uppercase font-bold tracking-widest mb-2 block">Shared Media</span>
                  {sharedMedia.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {sharedMedia.map(msg => (
                        <div 
                          key={msg.id} 
                          onClick={() => setLightboxMedia(msg)}
                          className="aspect-square bg-wa-border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {msg.type === "image" ? (
                            <img src={msg.mediaUrl} alt="Media" className="w-full h-full object-cover" />
                          ) : (
                            <video src={msg.mediaUrl} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-wa-muted italic">
                      No media shared yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Shared Media Lightbox */}
      <Modal 
        isOpen={!!lightboxMedia} 
        onClose={() => setLightboxMedia(null)} 
        title={lightboxMedia?.fileName || "Media Preview"}
        className="max-w-4xl bg-black border-wa-border/20"
      >
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-black min-h-[60vh] relative group">
          {lightboxMedia && (
            <>
              {lightboxMedia.type === "image" ? (
                <img src={lightboxMedia.mediaUrl} alt="Fullscreen" className="max-h-[75vh] max-w-full object-contain rounded" />
              ) : (
                <video src={lightboxMedia.mediaUrl} controls autoPlay className="max-h-[75vh] max-w-full object-contain rounded bg-black" />
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <button 
                  onClick={() => window.open(lightboxMedia.mediaUrl, "_blank")} 
                  className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
                  title="Download / Open Original"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </header>
  );
}
