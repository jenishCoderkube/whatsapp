"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquarePlus,
  MoreVertical,
  Search,
  Users,
  UserPlus,
  Check,
  Edit2,
  X,
  Upload,
  Trash2,
  Loader2,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { SearchBar } from "./SearchBar";
import { ChatCard } from "./ChatCard";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { logout, updateProfile } from "../../redux/slices/authSlice";
import { toggleTheme } from "../../redux/slices/uiSlice";
import {
  setChats,
  appendChat,
  setActiveChat,
  removeChat,
  updateChatMembership,
  updateChatAvatar,
} from "../../redux/slices/chatSlice";
import { chatService } from "../../services/chatService";
import { profileService } from "../../services/profileService";
import { storageService } from "../../services/storageService";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../utils/cn";

export function Sidebar({ className }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const chats = useAppSelector((state) => state.chat.chats);
  const searchQuery = useAppSelector((state) => state.chat.searchQuery);
  const theme = useAppSelector((state) => state.ui.theme);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const [profileModal, setProfileModal] = useState(false);
  const [newChatModal, setNewChatModal] = useState(false);
  const [activeTab, setActiveTab] = useState("direct"); // 'direct' | 'group'

  // Direct chat search states
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Group creation states
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Profile editable setting states
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [editingStatus, setEditingStatus] = useState(false);
  const [tempStatus, setTempStatus] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const profileFileInputRef = useRef(null);

  // Fetch linked database conversations dynamically upon load
  useEffect(() => {
    if (user?.id) {
      chatService.getUserChats(user.id).then((fetchedChats) => {
        if (fetchedChats && fetchedChats.length > 0) {
          dispatch(setChats(fetchedChats));

          // Batch acknowledge delivery for all active sidebar conversations
          fetchedChats.forEach((chat) => {
            if (
              chat.lastMessage &&
              !chat.lastMessage.isOutgoing &&
              chat.lastMessage.status === "sent"
            ) {
              import("../../services/messageService").then(({ messageService }) => {
                messageService.markConversationMessagesAsDelivered(chat.id, user.id);
              });
            }
          });
        }
      });

      // Listen for membership changes (being added, removed, or leaving groups)
      const membershipChannel = supabase
        .channel(`membership-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_members",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const { eventType, new: newRow, old: oldRow } = payload;
            
            if (eventType === "DELETE") {
              dispatch(removeChat(oldRow.conversation_id));
            } else if (eventType === "UPDATE" || eventType === "INSERT") {
              // If it's an update to is_left, sync the slice status
              const chatId = newRow.conversation_id;
              const isLeft = newRow.is_left;
              
              // Check if we already have this chat
              const existingChat = chatsRef.current.find(c => c.id === chatId);
              if (existingChat) {
                dispatch(updateChatMembership({ chatId, isLeft }));
              } else if (!isLeft) {
                // If added to a group we don't have in local state yet, fetch it
                chatService.getUserChats(user.id).then(allChats => {
                  const target = allChats.find(c => c.id === chatId);
                  if (target) dispatch(appendChat(target));
                });
              }
            }
          }
        )
        .subscribe();

      // Listen for conversation metadata updates (Group Avatar/Name changes)
      const conversationChannel = supabase
        .channel("global-conversation-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
          },
          (payload) => {
            const updatedConv = payload.new;
            // Check if this conversation exists in our list
            const existing = chatsRef.current.find(c => c.id === updatedConv.id);
            if (existing) {
              if (updatedConv.avatar !== existing.avatar) {
                dispatch(updateChatAvatar({ chatId: updatedConv.id, avatar: updatedConv.avatar }));
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(membershipChannel);
        supabase.removeChannel(conversationChannel);
      };
    }
  }, [user?.id, dispatch]);

  // Sync temp profile attributes upon mounting configuration overlays
  useEffect(() => {
    if (profileModal && user) {
      setTempName(user.name || "");
      setTempStatus(user.status || "Available");
      setEditingName(false);
      setEditingStatus(false);
      setProfileMessage("");
    }
  }, [profileModal, user]);

  // Handle debounced platform user profile searching
  useEffect(() => {
    if (!newChatModal) return;
    const timer = setTimeout(() => {
      setIsSearching(true);
      profileService.searchProfiles(userSearchQuery, user?.id).then((res) => {
        setSearchResults(res);
        setIsSearching(false);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, user?.id, newChatModal]);

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const dropdownItems = [
    {
      label: "Profile Info",
      onClick: () => setProfileModal(true),
    },
    {
      label: theme === "light" ? "Dark Theme" : "Light Theme",
      onClick: () => dispatch(toggleTheme()),
    },
    {
      label: "Logout",
      danger: true,
      onClick: () => dispatch(logout()),
    },
  ];

  // Initiate direct 1-to-1 conversation
  const handleStartDirectChat = async (targetProfile) => {
    if (!user?.id) return;
    try {
      const chatObj = await chatService.createOrOpenOneToOneChat(
        user.id,
        targetProfile,
      );
      dispatch(appendChat(chatObj));
      dispatch(setActiveChat(chatObj.id));
      setNewChatModal(false);
    } catch (error) {
      console.error("Failed starting direct chat:", error);
    }
  };

  // Submit native multi-user Group Chat creation
  const handleCreateGroup = async () => {
    if (!user?.id || !groupName.trim()) return;
    try {
      const groupObj = await chatService.createGroupChat({
        name: groupName.trim(),
        avatar:
          groupAvatar ||
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
        currentUserId: user.id,
        memberIds: selectedMembers,
      });

      dispatch(appendChat(groupObj));
      dispatch(setActiveChat(groupObj.id));
      setGroupName("");
      setSelectedMembers([]);
      setNewChatModal(false);
    } catch (error) {
      console.error("Group creation pipeline failure:", error);
    }
  };

  const toggleMemberSelection = (targetId) => {
    setSelectedMembers((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId],
    );
  };

  const handleRandomGroupAvatar = () => {
    const icons = [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    ];
    setGroupAvatar(icons[Math.floor(Math.random() * icons.length)]);
  };

  // Profile Customization pipelines
  const handleSaveName = async () => {
    if (!user?.id || !tempName.trim()) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const updated = await profileService.updateProfileData(user.id, {
        name: tempName.trim(),
      });
      if (updated) {
        dispatch(updateProfile({ name: updated.name }));
        setEditingName(false);
        setProfileMessage("Username updated successfully.");
      }
    } catch (err) {
      setProfileMessage("Failed to update username.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!user?.id || !tempStatus.trim()) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const updated = await profileService.updateProfileData(user.id, {
        status: tempStatus.trim(),
      });
      if (updated) {
        dispatch(updateProfile({ status: updated.status }));
        setEditingStatus(false);
        setProfileMessage("About description updated successfully.");
      }
    } catch (err) {
      setProfileMessage("Failed to update about section.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleProfileAvatarSelectChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage("Maximum image size is 5MB.");
      return;
    }

    setIsUpdatingProfile(true);
    setProfileMessage("");

    try {
      const uploadedAbsoluteUrl = await storageService.uploadFile(
        file,
        "avatars",
      );
      if (uploadedAbsoluteUrl) {
        const updated = await profileService.updateProfileData(user.id, {
          avatar: uploadedAbsoluteUrl,
        });
        if (updated) {
          dispatch(updateProfile({ avatar: updated.avatar }));
          setProfileMessage("Profile photo updated successfully.");
        }
      }
    } catch (err) {
      setProfileMessage("Failed to upload profile picture.");
    } finally {
      setIsUpdatingProfile(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatarImage = async () => {
    if (!user?.id) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const fallbackUrl =
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
      const updated = await profileService.updateProfileData(user.id, {
        avatar: fallbackUrl,
      });
      if (updated) {
        dispatch(updateProfile({ avatar: updated.avatar }));
        setProfileMessage("Profile photo removed.");
      }
    } catch (err) {
      setProfileMessage("Failed to delete custom image.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-wa-sidebar border-r border-wa-border select-none transition-colors duration-200",
        className,
      )}
    >
      {/* Top native header strip */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-wa-header transition-colors duration-200 shrink-0">
        <div
          onClick={() => setProfileModal(true)}
          className="cursor-pointer block"
          title="View Profile"
        >
          <Avatar
            src={user?.avatar}
            fallback={user?.name?.[0] || "U"}
            size="md"
            isOnline={true}
          />
        </div>

        <div className="flex items-center gap-2 text-wa-muted">
          <ThemeToggle />

          <button
            onClick={() => setNewChatModal(true)}
            className="p-2 rounded-full hover:bg-wa-active transition-colors block"
            title="New Chat"
          >
            <MessageSquarePlus className="h-5 w-5 text-wa-text" />
          </button>

          <Dropdown
            trigger={
              <button className="p-2 rounded-full hover:bg-wa-active transition-colors block">
                <MoreVertical className="h-5 w-5" />
              </button>
            }
            items={dropdownItems}
          />
        </div>
      </header>

      {/* Filter engine */}
      <SearchBar />

      {/* Scrollable contact records */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-wa-sidebar transition-colors duration-200">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat) => <ChatCard key={chat.id} chat={chat} />)
        ) : (
          <div className="p-6 text-center text-xs sm:text-sm text-wa-muted">
            No chats or contacts found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Profile Settings Engine Modal */}
      <Modal
        isOpen={profileModal}
        onClose={() => setProfileModal(false)}
        title="Profile settings"
      >
        <div className="flex flex-col items-center py-2 max-h-[75vh] overflow-y-auto px-2">
          {profileMessage && (
            <div className="w-full mb-3 p-2 rounded text-center text-xs bg-wa-active text-wa-text border border-wa-border animate-fade-in">
              {profileMessage}
            </div>
          )}

          {/* Hidden Avatar Uploader element */}
          <input
            type="file"
            ref={profileFileInputRef}
            onChange={handleProfileAvatarSelectChange}
            accept="image/*"
            className="hidden"
          />

          {/* Realtime Interactive Profile photo block */}
          <div className="relative group cursor-pointer my-2 block rounded-full">
            <Avatar
              src={user?.avatar}
              fallback={user?.name?.[0] || "U"}
              size="xxl"
              className="shadow-md ring-2 ring-wa-border"
            />
            <div
              onClick={() => profileFileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-center p-2"
            >
              <Upload className="h-5 w-5 mb-1" />
              <span className="text-[10px] leading-tight">Change photo</span>
            </div>
            {isUpdatingProfile && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-wa-modal/80 backdrop-blur-xs">
                <Loader2 className="h-6 w-6 text-wa-primary animate-spin" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 mb-4 text-xs">
            <button
              onClick={() => profileFileInputRef.current?.click()}
              disabled={isUpdatingProfile}
              className="text-wa-primary font-medium hover:underline block cursor-pointer"
            >
              Upload image
            </button>
            <span className="text-wa-muted">•</span>
            <button
              onClick={handleRemoveAvatarImage}
              disabled={isUpdatingProfile}
              className="text-red-500 font-medium hover:underline block cursor-pointer"
            >
              Remove
            </button>
          </div>

          {/* Fully Interactive Edit Fields mapping */}
          <div className="w-full pt-3 border-t border-wa-border flex flex-col gap-4 text-left">
            {/* Username Section */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-wa-primary font-medium uppercase tracking-wider px-1">
                Your Name
              </div>
              {editingName ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="h-8 text-xs flex-1"
                    placeholder="Username"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isUpdatingProfile || !tempName.trim()}
                    className="p-1.5 rounded bg-wa-primary text-white hover:opacity-90 block cursor-pointer"
                    title="Save"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTempName(user?.name || "");
                      setEditingName(false);
                    }}
                    disabled={isUpdatingProfile}
                    className="p-1.5 rounded bg-wa-active text-wa-muted hover:text-wa-text block cursor-pointer"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-wa-header px-3 py-2 rounded-md group">
                  <span className="text-xs sm:text-sm font-medium text-wa-text truncate">
                    {user?.name}
                  </span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-wa-muted hover:text-wa-primary transition-colors block cursor-pointer"
                    title="Edit name"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <span className="text-[10px] text-wa-muted px-1 block">
                This is not your username or pin. This name will be visible to
                your linked contacts.
              </span>
            </div>

            {/* About description Section */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-wa-primary font-medium uppercase tracking-wider px-1">
                About
              </div>
              {editingStatus ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value)}
                    className="h-8 text-xs flex-1"
                    placeholder="Status description"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveStatus}
                    disabled={isUpdatingProfile || !tempStatus.trim()}
                    className="p-1.5 rounded bg-wa-primary text-white hover:opacity-90 block cursor-pointer"
                    title="Save"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTempStatus(user?.status || "Available");
                      setEditingStatus(false);
                    }}
                    disabled={isUpdatingProfile}
                    className="p-1.5 rounded bg-wa-active text-wa-muted hover:text-wa-text block cursor-pointer"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-wa-header px-3 py-2 rounded-md group">
                  <span className="text-xs sm:text-sm text-wa-text truncate">
                    {user?.status || "Available"}
                  </span>
                  <button
                    onClick={() => setEditingStatus(true)}
                    className="text-wa-muted hover:text-wa-primary transition-colors block cursor-pointer"
                    title="Edit about"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Interactive New Chat / Create Group Chat Modals */}
      <Modal
        isOpen={newChatModal}
        onClose={() => setNewChatModal(false)}
        title="Start New Conversation"
      >
        <div className="flex flex-col h-[420px]">
          {/* Internal view switching strip */}
          <div className="flex border-b border-wa-border mb-3">
            <button
              onClick={() => setActiveTab("direct")}
              className={cn(
                "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors block cursor-pointer",
                activeTab === "direct"
                  ? "border-wa-primary text-wa-primary"
                  : "border-transparent text-wa-muted hover:text-wa-text",
              )}
            >
              Direct Chat
            </button>
            <button
              onClick={() => setActiveTab("group")}
              className={cn(
                "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors block cursor-pointer",
                activeTab === "group"
                  ? "border-wa-primary text-wa-primary"
                  : "border-transparent text-wa-muted hover:text-wa-text",
              )}
            >
              Create Group
            </button>
          </div>

          {/* Direct Chat search view */}
          {activeTab === "direct" ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="relative mb-3 p-0.5">
                <Input
                  type="text"
                  placeholder="Search registered profiles..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9 bg-wa-header border border-wa-border rounded-lg text-xs sm:text-sm py-2 focus:ring-1 focus:ring-wa-primary"
                />
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-wa-muted" />
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {isSearching ? (
                  <div className="py-8 text-center text-xs text-wa-muted animate-pulse">
                    Searching profiles...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => handleStartDirectChat(profile)}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-wa-hover cursor-pointer transition-colors"
                    >
                      <Avatar
                        src={profile.avatar}
                        fallback={profile.name[0]}
                        size="md"
                        isOnline={profile.online}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-wa-text truncate">
                          {profile.name}
                        </div>
                        <div className="text-[11px] text-wa-muted truncate">
                          {profile.email}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-wa-muted">
                    {userSearchQuery.trim()
                      ? "No platform users found matching criteria."
                      : "Type an email or name to discover members."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Multi-User Native Group Creation Layer */
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-3 mb-3">
                <div
                  onClick={handleRandomGroupAvatar}
                  className="cursor-pointer block"
                  title="Generate Preset Icon"
                >
                  <Avatar
                    src={groupAvatar}
                    fallback="G"
                    size="lg"
                    className="border border-wa-border hover:opacity-80 transition-opacity"
                  />
                </div>
                <div className="flex-1 p-0.5">
                  <Input
                    className="bg-wa-header border border-wa-border rounded-lg text-xs sm:text-sm py-2 font-medium focus:ring-1 focus:ring-wa-primary"
                    type="text"
                    placeholder="Group Subject / Title..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <span className="text-[10px] text-wa-muted block mt-1">
                    Click placeholder icon to pick random custom image
                  </span>
                </div>
              </div>

              <div className="text-xs font-medium text-wa-muted mb-1.5">
                Select Group Participants
              </div>

              <div className="flex-1 overflow-y-auto border border-wa-border rounded-md p-1.5 mb-3 bg-wa-sidebar">
                {searchResults.length > 0 ? (
                  searchResults.map((profile) => {
                    const isSelected = selectedMembers.includes(profile.id);
                    return (
                      <div
                        key={profile.id}
                        onClick={() => toggleMemberSelection(profile.id)}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded hover:bg-wa-hover cursor-pointer transition-colors select-none",
                          isSelected && "bg-wa-active",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center h-4 w-4 rounded border transition-colors shrink-0",
                            isSelected
                              ? "bg-wa-primary border-wa-primary text-white"
                              : "border-wa-muted",
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                        <Avatar
                          src={profile.avatar}
                          fallback={profile.name[0]}
                          size="sm"
                        />
                        <span className="text-xs text-wa-text truncate flex-1">
                          {profile.name}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-wa-muted">
                    No searchable peers ready. Type characters in the Search
                    input to fetch accounts.
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateGroup}
                disabled={!groupName.trim()}
                className="w-full"
                variant="default"
              >
                Create Group ({selectedMembers.length} Selected)
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </aside>
  );
}
