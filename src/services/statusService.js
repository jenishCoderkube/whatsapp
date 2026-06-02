import { supabase } from "../lib/supabaseClient";
import { storageService } from "./storageService";
import { profileService } from "./profileService";
import { chatService } from "./chatService";
import { messageService } from "./messageService";

// Helper to determine if we should use local storage fallback
let useLocalFallback = false;
let hasCheckedTable = false;
let contactsCache = null;
let contactsCacheTime = 0;
let pendingFetchPromise = null;

export const statusService = {
  /**
   * Helper to encode metadata into status text content or caption.
   */
  encodeMetadata(content = "", metadata = {}) {
    if (!metadata || Object.keys(metadata).length === 0) return content;
    return `|||METADATA:${JSON.stringify(metadata)}|||${content}`;
  },

  /**
   * Helper to decode metadata from status text content or caption.
   */
  decodeMetadata(rawContent = "") {
    if (!rawContent) return { content: "", metadata: {} };
    if (
      typeof rawContent === "string" &&
      rawContent.startsWith("|||METADATA:")
    ) {
      const index = rawContent.indexOf("|||", 12);
      if (index !== -1) {
        try {
          const jsonStr = rawContent.substring(12, index);
          const content = rawContent.substring(index + 3);
          const metadata = JSON.parse(jsonStr);
          return { content, metadata };
        } catch (e) {
          console.warn("Failed parsing metadata:", e);
        }
      }
    }
    return { content: rawContent, metadata: {} };
  },

  /**
   * Get all user IDs that have an existing conversation with the current user.
   */
  async getUserContactIds(currentUserId) {
    if (!currentUserId) return [];

    const now = Date.now();
    // Cache contact IDs for 10 seconds to deduplicate rapid status loading triggers
    if (contactsCache && now - contactsCacheTime < 10000) {
      return contactsCache;
    }

    try {
      const { data: userConvs, error: convsError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (convsError || !userConvs || userConvs.length === 0) return [];

      const conversationIds = userConvs.map((c) => c.conversation_id);

      const { data: peers, error: peersError } = await supabase
        .from("conversation_members")
        .select("user_id")
        .in("conversation_id", conversationIds)
        .neq("user_id", currentUserId);

      if (peersError || !peers) return [];

      const result = [...new Set(peers.map((p) => p.user_id))];
      contactsCache = result;
      contactsCacheTime = Date.now();
      return result;
    } catch (e) {
      console.warn("Failed to fetch user contact IDs:", e);
      return [];
    }
  },

  /**
   * Resiliently check if statuses table exists, and fallback to localStorage if not.
   */
  async checkTableExists() {
    if (hasCheckedTable) return useLocalFallback;
    try {
      const { error } = await supabase.from("statuses").select("id").limit(1);
      if (error && error.code === "PGRST205") {
        useLocalFallback = true;
        console.warn(
          "Statuses table not found in Supabase. Using localStorage fallback.",
        );
      } else {
        useLocalFallback = false;
      }
      hasCheckedTable = true;
    } catch (e) {
      useLocalFallback = true;
      console.warn(
        "Unable to connect to Supabase statuses table. Using localStorage fallback.",
      );
      hasCheckedTable = true;
    }
    return useLocalFallback;
  },

  /**
   * Upload a status (Image, Video, or Text).
   */
  async uploadStatus({
    userId,
    type,
    mediaFile = null,
    caption = "",
    textContent = "",
    bgColor = "#005c4b",
    textStyle = "sans",
    privacy = "contacts",
    privacyList = [],
    metadata = {},
  }) {
    await this.checkTableExists();

    let mediaUrl = null;
    if (mediaFile) {
      // Upload media if present
      mediaUrl = await storageService.uploadFile(mediaFile, "statuses");
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h from now

    // Encode metadata into the content strings
    const finalCaption = mediaFile
      ? this.encodeMetadata(caption, metadata)
      : "";
    const finalTxt = !mediaFile
      ? this.encodeMetadata(textContent, metadata)
      : "";

    let createdStatus = null;

    if (useLocalFallback) {
      createdStatus = {
        id:
          "local-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        type,
        media_url: mediaUrl,
        caption: finalCaption,
        text_content: finalTxt,
        bg_color: bgColor,
        text_style: textStyle,
        privacy,
        privacy_list: privacyList,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        views: [],
      };

      const localStatuses = JSON.parse(
        localStorage.getItem("wa_local_statuses") || "[]",
      );
      localStatuses.unshift(createdStatus);
      localStorage.setItem("wa_local_statuses", JSON.stringify(localStatuses));

      // Trigger local updates
      this.triggerLocalSyncEvent();
    } else {
      const insertPayload = {
        user_id: userId,
        type,
        media_url: mediaUrl,
        caption: finalCaption,
        text_content: finalTxt,
        bg_color: bgColor,
        text_style: textStyle,
        privacy,
        privacy_list: privacyList,
        expires_at: expiresAt,
      };

      const { data, error } = await supabase
        .from("statuses")
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      createdStatus = data;
    }

    // Trigger mention notifications via DMs
    if (createdStatus && metadata.mentions && metadata.mentions.length > 0) {
      // Normalize createdStatus payload for notifyMentions
      const normalizedStatus = {
        id: createdStatus.id,
        type: createdStatus.type,
        mediaUrl: createdStatus.media_url,
        textContent: createdStatus.text_content,
        bgColor: createdStatus.bg_color,
        textStyle: createdStatus.text_style,
        caption: createdStatus.caption,
      };
      const mentionedIds = metadata.mentions.map((m) => m.id);
      this.notifyMentions(normalizedStatus, userId, mentionedIds);
    }

    return createdStatus;
  },

  /**
   * Send DM notification when users are mentioned in a status update.
   */
  async notifyMentions(status, currentUserId, mentionedIds) {
    if (!mentionedIds || mentionedIds.length === 0) return;

    for (const peerId of mentionedIds) {
      if (peerId === currentUserId) continue;
      try {
        const peerProfile = await profileService.getProfileById(peerId);
        if (peerProfile) {
          const chatObj = await chatService.createOrOpenOneToOneChat(
            currentUserId,
            peerProfile,
          );

          let previewText = "status update";
          if (status.type === "text") {
            const { content } = this.decodeMetadata(status.textContent);
            previewText = `"${content}"`;
          } else {
            const { content } = this.decodeMetadata(status.caption);
            previewText = content ? `"${content}"` : "Photo status";
          }

          const messageText = `Mentioned you in a status update: ${previewText}`;

          const replyToMetadata = {
            messageId: "status-" + status.id,
            text: messageText,
            senderName: "Status Update",
            mediaUrl: status.mediaUrl,
            type: status.type,
            isStatus: true,
            statusId: status.id,
            statusType: status.type,
            statusMediaUrl: status.mediaUrl,
            statusTextContent: status.textContent,
            statusBgColor: status.bgColor,
            statusTextStyle: status.textStyle,
            statusCaption: status.caption,
          };

          await messageService.sendMessage({
            conversationId: chatObj.id,
            senderId: currentUserId,
            text: messageText,
            type: "text",
            replyTo: replyToMetadata,
          });
        }
      } catch (e) {
        console.error("Failed to notify mentioned user:", peerId, e);
      }
    }
  },

  /**
   * Fetch active statuses, grouping them by user, and filtering out expired ones.
   */
  async fetchStatuses(currentUserId) {
    if (pendingFetchPromise) {
      return pendingFetchPromise;
    }

    pendingFetchPromise = (async () => {
      try {
        await this.checkTableExists();

        const nowIso = new Date().toISOString();
        const contactIds = await this.getUserContactIds(currentUserId);

        if (useLocalFallback) {
          const localStatuses = JSON.parse(
            localStorage.getItem("wa_local_statuses") || "[]",
          );
          const localViews = JSON.parse(
            localStorage.getItem("wa_local_status_views") || "[]",
          );

          // Filter out expired statuses
          const activeStatuses = localStatuses.filter(
            (s) => new Date(s.expires_at) > new Date(),
          );
          localStorage.setItem("wa_local_statuses", JSON.stringify(activeStatuses));

          const visibleStatuses = activeStatuses.filter((status) => {
            const statusUserId = status.user_id;
            if (statusUserId === currentUserId) return true;

            const privacy = status.privacy || "contacts";
            const privacyList = status.privacy_list || [];

            if (privacy === "everyone") return true;
            if (privacy === "contacts") return contactIds.includes(statusUserId);
            if (privacy === "selected") return privacyList.includes(currentUserId);
            if (privacy === "hide")
              return (
                contactIds.includes(statusUserId) &&
                !privacyList.includes(currentUserId)
              );

            return false;
          });

          // Get user profiles
          const uniqueUserIds = [...new Set(visibleStatuses.map((s) => s.user_id))];
          const profilesMap = {};

          for (const uid of uniqueUserIds) {
            if (uid === currentUserId) {
              const { data: currentProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", uid)
                .single();
              profilesMap[uid] = currentProfile || {
                id: uid,
                name: "Me",
                avatar: "",
              };
            } else {
              const profile = await profileService.getProfileById(uid);
              profilesMap[uid] = profile || {
                id: uid,
                name: "Contact",
                avatar: "",
              };
            }
          }

          // Group statuses by user
          const groups = {};

          visibleStatuses.forEach((status) => {
            const uid = status.user_id;
            const profile = profilesMap[uid] || {
              id: uid,
              name: "Contact",
              avatar: "",
            };

            // Find views for this status, parsing votes or answers
            const viewsForStatus = localViews
              .filter((v) => v.status_id === status.id)
              .map((v) => {
                let voteOptionId = null;
                let questionAnswer = null;
                let cleanReplyText = v.reply_text;

                if (v.reply_text && v.reply_text.startsWith("|||VOTE:")) {
                  voteOptionId = v.reply_text.substring(8);
                  cleanReplyText = null;
                } else if (v.reply_text && v.reply_text.startsWith("|||ANSWER:")) {
                  questionAnswer = v.reply_text.substring(10);
                  cleanReplyText = null;
                }

                return {
                  viewerId: v.viewer_id,
                  name: v.name,
                  avatar: v.avatar,
                  reaction: v.reaction,
                  replyText: cleanReplyText,
                  voteOptionId,
                  questionAnswer,
                  createdAt: v.created_at,
                };
              });

            const isSeen = viewsForStatus.some((v) => v.viewerId === currentUserId);

            const mappedStatus = {
              id: status.id,
              userId: status.user_id,
              type: status.type,
              mediaUrl: status.media_url,
              caption: status.caption,
              textContent: status.text_content,
              bgColor: status.bg_color,
              textStyle: status.text_style,
              createdAt: status.created_at,
              expiresAt: status.expires_at,
              views: viewsForStatus,
              isSeen: uid === currentUserId ? false : isSeen, // own status doesn't have "seen" color rings for self
            };

            if (!groups[uid]) {
              groups[uid] = {
                userId: uid,
                name: profile.name,
                avatar: profile.avatar,
                statuses: [],
                hasUnseen: false,
              };
            }

            groups[uid].statuses.push(mappedStatus);
          });

          // Format groups
          Object.keys(groups).forEach((uid) => {
            // Sort statuses inside the group chronologically (earliest first)
            groups[uid].statuses.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            );

            if (uid !== currentUserId) {
              groups[uid].hasUnseen = groups[uid].statuses.some((s) => !s.isSeen);
            } else {
              groups[uid].hasUnseen = false;
            }
          });

          return Object.values(groups);
        } else {
          // 1. Fetch active statuses (expires_at > now)
          const { data: statusesData, error: statusesError } = await supabase
            .from("statuses")
            .select("*, profiles:user_id(id, name, avatar)")
            .gt("expires_at", nowIso)
            .order("created_at", { ascending: true });

          if (statusesError) throw statusesError;
          if (!statusesData) return [];

          const visibleStatuses = statusesData.filter((status) => {
            const statusUserId = status.user_id;
            if (statusUserId === currentUserId) return true;

            const privacy = status.privacy || "contacts";
            const privacyList = status.privacy_list || [];

            if (privacy === "everyone") return true;
            if (privacy === "contacts") return contactIds.includes(statusUserId);
            if (privacy === "selected") return privacyList.includes(currentUserId);
            if (privacy === "hide")
              return (
                contactIds.includes(statusUserId) &&
                !privacyList.includes(currentUserId)
              );

            return false;
          });

          // 2. Fetch views for these active statuses
          const statusIds = visibleStatuses.map((s) => s.id);
          let viewsData = [];

          if (statusIds.length > 0) {
            const { data: fetchedViews, error: viewsError } = await supabase
              .from("status_views")
              .select("*, profiles:viewer_id(name, avatar)")
              .in("status_id", statusIds);

            if (!viewsError && fetchedViews) {
              viewsData = fetchedViews;
            }
          }

          // Group views by status_id
          const viewsByStatus = {};
          viewsData.forEach((view) => {
            if (!viewsByStatus[view.status_id]) {
              viewsByStatus[view.status_id] = [];
            }

            let voteOptionId = null;
            let questionAnswer = null;
            let cleanReplyText = view.reply_text;

            if (view.reply_text && view.reply_text.startsWith("|||VOTE:")) {
              voteOptionId = view.reply_text.substring(8);
              cleanReplyText = null;
            } else if (
              view.reply_text &&
              view.reply_text.startsWith("|||ANSWER:")
            ) {
              questionAnswer = view.reply_text.substring(10);
              cleanReplyText = null;
            }

            viewsByStatus[view.status_id].push({
              viewerId: view.viewer_id,
              name: view.profiles?.name || "Viewer",
              avatar: view.profiles?.avatar,
              reaction: view.reaction,
              replyText: cleanReplyText,
              voteOptionId,
              questionAnswer,
              createdAt: view.created_at,
            });
          });

          // Group statuses by user
          const groups = {};

          visibleStatuses.forEach((status) => {
            const uid = status.user_id;
            const profile = status.profiles || {
              id: uid,
              name: "Contact",
              avatar: "",
            };
            const viewsForStatus = viewsByStatus[status.id] || [];
            const isSeen = viewsForStatus.some((v) => v.viewerId === currentUserId);

            const mappedStatus = {
              id: status.id,
              userId: status.user_id,
              type: status.type,
              mediaUrl: status.media_url,
              caption: status.caption,
              textContent: status.text_content,
              bgColor: status.bg_color,
              textStyle: status.text_style,
              createdAt: status.created_at,
              expiresAt: status.expires_at,
              views: viewsForStatus,
              isSeen: uid === currentUserId ? false : isSeen,
            };

            if (!groups[uid]) {
              groups[uid] = {
                userId: uid,
                name: profile.name,
                avatar: profile.avatar,
                statuses: [],
                hasUnseen: false,
              };
            }

            groups[uid].statuses.push(mappedStatus);
          });

          // Re-evaluate groups
          Object.keys(groups).forEach((uid) => {
            // Sort chronologically
            groups[uid].statuses.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            );

            if (uid !== currentUserId) {
              groups[uid].hasUnseen = groups[uid].statuses.some((s) => !s.isSeen);
            } else {
              groups[uid].hasUnseen = false;
            }
          });

          return Object.values(groups);
        }
      } finally {
        pendingFetchPromise = null;
      }
    })();

    return pendingFetchPromise;
  },

  /**
   * Log seen state when a status is viewed by a user.
   */
  async markStatusAsSeen(statusId, viewerId) {
    await this.checkTableExists();

    if (useLocalFallback) {
      const localViews = JSON.parse(
        localStorage.getItem("wa_local_status_views") || "[]",
      );

      const alreadyViewed = localViews.some(
        (v) => v.status_id === statusId && v.viewer_id === viewerId,
      );

      if (!alreadyViewed) {
        // Get viewer profile details
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("id", viewerId)
          .single();

        const newView = {
          id:
            "view-" +
            Date.now() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          status_id: statusId,
          viewer_id: viewerId,
          name: viewerProfile?.name || "Viewer",
          avatar: viewerProfile?.avatar || "",
          reaction: null,
          reply_text: null,
          created_at: new Date().toISOString(),
        };

        localViews.push(newView);
        localStorage.setItem(
          "wa_local_status_views",
          JSON.stringify(localViews),
        );
        this.triggerLocalSyncEvent();
      }
      return true;
    } else {
      const { data, error } = await supabase
        .from("status_views")
        .insert({
          status_id: statusId,
          viewer_id: viewerId,
        })
        .select()
        .single();

      if (error && error.code !== "23505") {
        // Ignore unique constraint violation
        console.warn("Error inserting status view:", error);
      }
      return data;
    }
  },

  /**
   * Vote on a status poll. Saves optionId into the status view reply_text.
   */
  async voteOnStatusPoll(status, viewerId, optionId) {
    await this.checkTableExists();
    const statusId = status.id;
    const votePayload = `|||VOTE:${optionId}`;

    if (useLocalFallback) {
      const localViews = JSON.parse(
        localStorage.getItem("wa_local_status_views") || "[]",
      );
      let found = false;
      const updatedViews = localViews.map((v) => {
        if (v.status_id === statusId && v.viewer_id === viewerId) {
          found = true;
          return { ...v, reply_text: votePayload };
        }
        return v;
      });

      if (!found) {
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("id", viewerId)
          .single();

        updatedViews.push({
          id:
            "view-" +
            Date.now() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          status_id: statusId,
          viewer_id: viewerId,
          name: viewerProfile?.name || "Viewer",
          avatar: viewerProfile?.avatar || "",
          reaction: null,
          reply_text: votePayload,
          created_at: new Date().toISOString(),
        });
      }
      localStorage.setItem(
        "wa_local_status_views",
        JSON.stringify(updatedViews),
      );
      this.triggerLocalSyncEvent();
      return true;
    } else {
      const { data: existing } = await supabase
        .from("status_views")
        .select("id")
        .eq("status_id", statusId)
        .eq("viewer_id", viewerId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("status_views")
          .update({ reply_text: votePayload })
          .eq("status_id", statusId)
          .eq("viewer_id", viewerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("status_views").insert({
          status_id: statusId,
          viewer_id: viewerId,
          reply_text: votePayload,
        });
        if (error) throw error;
      }
      return true;
    }
  },

  /**
   * Submit an answer to a question card sticker.
   */
  async answerStatusQuestion(status, viewerId, answerText) {
    await this.checkTableExists();
    const statusId = status.id;
    const answerPayload = `|||ANSWER:${answerText}`;

    if (useLocalFallback) {
      const localViews = JSON.parse(
        localStorage.getItem("wa_local_status_views") || "[]",
      );
      let found = false;
      const updatedViews = localViews.map((v) => {
        if (v.status_id === statusId && v.viewer_id === viewerId) {
          found = true;
          return { ...v, reply_text: answerPayload };
        }
        return v;
      });

      if (!found) {
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("id", viewerId)
          .single();

        updatedViews.push({
          id:
            "view-" +
            Date.now() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          status_id: statusId,
          viewer_id: viewerId,
          name: viewerProfile?.name || "Viewer",
          avatar: viewerProfile?.avatar || "",
          reaction: null,
          reply_text: answerPayload,
          created_at: new Date().toISOString(),
        });
      }
      localStorage.setItem(
        "wa_local_status_views",
        JSON.stringify(updatedViews),
      );
      this.triggerLocalSyncEvent();
    } else {
      const { data: existing } = await supabase
        .from("status_views")
        .select("id")
        .eq("status_id", statusId)
        .eq("viewer_id", viewerId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("status_views")
          .update({ reply_text: answerPayload })
          .eq("status_id", statusId)
          .eq("viewer_id", viewerId);
      } else {
        await supabase.from("status_views").insert({
          status_id: statusId,
          viewer_id: viewerId,
          reply_text: answerPayload,
        });
      }
    }

    // Also send DM notification to creator with the question and reply
    try {
      const ownerId = status.userId;
      const ownerProfile = await profileService.getProfileById(ownerId);
      if (ownerProfile) {
        const chatObj = await chatService.createOrOpenOneToOneChat(
          viewerId,
          ownerProfile,
        );
        const rawContent =
          status.type === "text" ? status.textContent : status.caption;
        const { metadata } = this.decodeMetadata(rawContent);
        const questionPrompt = metadata.question?.prompt || "Question";
        const messageText = `Answered your status question "${questionPrompt}": "${answerText}"`;

        const replyToMetadata = {
          messageId: "status-" + statusId,
          text: messageText,
          senderName: ownerProfile.name,
          mediaUrl: status.mediaUrl,
          type: status.type,
          isStatus: true,
          statusId: status.id,
          statusType: status.type,
          statusMediaUrl: status.mediaUrl,
          statusTextContent: status.textContent,
          statusBgColor: status.bgColor,
          statusTextStyle: status.textStyle,
          statusCaption: status.caption,
        };

        await messageService.sendMessage({
          conversationId: chatObj.id,
          senderId: viewerId,
          text: messageText,
          type: "text",
          replyTo: replyToMetadata,
        });
      }
    } catch (e) {
      console.error("Failed to send status question answer DM:", e);
    }
  },

  /**
   * Edit a status text content or media caption. Preserves existing metadata.
   */
  async editStatus(statusId, newText, type) {
    await this.checkTableExists();

    let existingMetadata = {};
    if (useLocalFallback) {
      const localStatuses = JSON.parse(
        localStorage.getItem("wa_local_statuses") || "[]",
      );
      const found = localStatuses.find((s) => s.id === statusId);
      if (found) {
        const rawContent = type === "text" ? found.text_content : found.caption;
        const decoded = this.decodeMetadata(rawContent);
        existingMetadata = decoded.metadata;

        const finalTxt = this.encodeMetadata(newText, existingMetadata);
        if (type === "text") {
          found.text_content = finalTxt;
        } else {
          found.caption = finalTxt;
        }
        localStorage.setItem(
          "wa_local_statuses",
          JSON.stringify(localStatuses),
        );
        this.triggerLocalSyncEvent();
        return true;
      }
    } else {
      const { data: found, error: fetchErr } = await supabase
        .from("statuses")
        .select("text_content, caption")
        .eq("id", statusId)
        .single();

      if (!fetchErr && found) {
        const rawContent = type === "text" ? found.text_content : found.caption;
        const decoded = this.decodeMetadata(rawContent);
        existingMetadata = decoded.metadata;

        const finalTxt = this.encodeMetadata(newText, existingMetadata);
        const updatePayload =
          type === "text" ? { text_content: finalTxt } : { caption: finalTxt };

        const { error } = await supabase
          .from("statuses")
          .update(updatePayload)
          .eq("id", statusId);

        if (error) throw error;
        return true;
      }
    }
    return false;
  },

  /**
   * Send emoji reaction to status. Updates local view record AND sends a Direct Message.
   */
  async reactToStatus(status, currentUserId, emoji) {
    await this.checkTableExists();

    const statusId = status.id;
    const ownerId = status.userId;

    // 1. Update reaction in status_views
    if (useLocalFallback) {
      const localViews = JSON.parse(
        localStorage.getItem("wa_local_status_views") || "[]",
      );
      let found = false;
      const updatedViews = localViews.map((v) => {
        if (v.status_id === statusId && v.viewer_id === currentUserId) {
          found = true;
          return { ...v, reaction: emoji };
        }
        return v;
      });

      if (!found) {
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("id", currentUserId)
          .single();

        updatedViews.push({
          id:
            "view-" +
            Date.now() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          status_id: statusId,
          viewer_id: currentUserId,
          name: viewerProfile?.name || "Viewer",
          avatar: viewerProfile?.avatar || "",
          reaction: emoji,
          reply_text: null,
          created_at: new Date().toISOString(),
        });
      }
      localStorage.setItem(
        "wa_local_status_views",
        JSON.stringify(updatedViews),
      );
      this.triggerLocalSyncEvent();
    } else {
      const { data: existing } = await supabase
        .from("status_views")
        .select("id")
        .eq("status_id", statusId)
        .eq("viewer_id", currentUserId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("status_views")
          .update({ reaction: emoji })
          .eq("status_id", statusId)
          .eq("viewer_id", currentUserId);
        if (error) console.warn("Failed to save status reaction:", error);
      } else {
        const { error } = await supabase.from("status_views").insert({
          status_id: statusId,
          viewer_id: currentUserId,
          reaction: emoji,
        });
        if (error) console.warn("Failed to save status reaction:", error);
      }
    }

    // 2. Send Direct Message to the user as a status interaction
    try {
      const ownerProfile = await profileService.getProfileById(ownerId);
      if (ownerProfile) {
        const chatObj = await chatService.createOrOpenOneToOneChat(
          currentUserId,
          ownerProfile,
        );

        let statusPreviewText = "status update";
        if (status.type === "text") {
          const { content } = this.decodeMetadata(status.textContent);
          statusPreviewText = `"${content}"`;
        } else if (status.type === "image") {
          statusPreviewText = "Photo status";
        } else if (status.type === "video") {
          statusPreviewText = "Video status";
        }

        const messageText = `Reacted ${emoji} to your status: ${statusPreviewText}`;

        const replyToMetadata = {
          messageId: "status-" + statusId,
          text: messageText,
          senderName: ownerProfile.name,
          mediaUrl: status.mediaUrl,
          type: status.type,
          isStatus: true,
          statusId: status.id,
          statusType: status.type,
          statusMediaUrl: status.mediaUrl,
          statusTextContent: status.textContent,
          statusBgColor: status.bgColor,
          statusTextStyle: status.textStyle,
          statusCaption: status.caption,
          emojiReaction: emoji,
        };

        await messageService.sendMessage({
          conversationId: chatObj.id,
          senderId: currentUserId,
          text: messageText,
          type: "text",
          replyTo: replyToMetadata,
        });
      }
    } catch (e) {
      console.error("Failed to send status reaction DM:", e);
    }
  },

  /**
   * Send a text reply to status. Updates local view record AND sends a Direct Message.
   */
  async replyToStatus(status, currentUserId, replyText) {
    await this.checkTableExists();

    const statusId = status.id;
    const ownerId = status.userId;

    // 1. Update reply text in status_views
    if (useLocalFallback) {
      const localViews = JSON.parse(
        localStorage.getItem("wa_local_status_views") || "[]",
      );
      let found = false;
      const updatedViews = localViews.map((v) => {
        if (v.status_id === statusId && v.viewer_id === currentUserId) {
          found = true;
          return { ...v, reply_text: replyText };
        }
        return v;
      });

      if (!found) {
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("id", currentUserId)
          .single();

        updatedViews.push({
          id:
            "view-" +
            Date.now() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          status_id: statusId,
          viewer_id: currentUserId,
          name: viewerProfile?.name || "Viewer",
          avatar: viewerProfile?.avatar || "",
          reaction: null,
          reply_text: replyText,
          created_at: new Date().toISOString(),
        });
      }
      localStorage.setItem(
        "wa_local_status_views",
        JSON.stringify(updatedViews),
      );
      this.triggerLocalSyncEvent();
    } else {
      const { data: existing } = await supabase
        .from("status_views")
        .select("id")
        .eq("status_id", statusId)
        .eq("viewer_id", currentUserId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("status_views")
          .update({ reply_text: replyText })
          .eq("status_id", statusId)
          .eq("viewer_id", currentUserId);
        if (error) console.warn("Failed to save status reply text:", error);
      } else {
        const { error } = await supabase.from("status_views").insert({
          status_id: statusId,
          viewer_id: currentUserId,
          reply_text: replyText,
        });
        if (error) console.warn("Failed to save status reply text:", error);
      }
    }

    // 2. Send Direct Message to the user containing the reply text and status metadata context
    try {
      const ownerProfile = await profileService.getProfileById(ownerId);
      if (ownerProfile) {
        const chatObj = await chatService.createOrOpenOneToOneChat(
          currentUserId,
          ownerProfile,
        );

        let statusDescription = "Status";
        let statusMediaUrl = status.mediaUrl;

        if (status.type === "text") {
          const { content } = this.decodeMetadata(status.textContent);
          statusDescription = `Status: "${content}"`;
        } else if (status.type === "image") {
          const { content } = this.decodeMetadata(status.caption);
          statusDescription = content
            ? `Photo Status: "${content}"`
            : "Photo Status";
        } else if (status.type === "video") {
          const { content } = this.decodeMetadata(status.caption);
          statusDescription = content
            ? `Video Status: "${content}"`
            : "Video Status";
        }

        const replyToMetadata = {
          messageId: "status-" + statusId,
          text: statusDescription,
          senderName: ownerProfile.name,
          mediaUrl: statusMediaUrl,
          type: status.type,
          isStatus: true,
          statusId: status.id,
          statusType: status.type,
          statusMediaUrl: status.mediaUrl,
          statusTextContent: status.textContent,
          statusBgColor: status.bgColor,
          statusTextStyle: status.textStyle,
          statusCaption: status.caption,
        };

        await messageService.sendMessage({
          conversationId: chatObj.id,
          senderId: currentUserId,
          text: replyText,
          type: "text",
          replyTo: replyToMetadata,
        });
      }
    } catch (e) {
      console.error("Failed to send status reply DM:", e);
    }
  },

  /**
   * Delete a status update.
   */
  async deleteStatus(statusId) {
    await this.checkTableExists();

    if (useLocalFallback) {
      const localStatuses = JSON.parse(
        localStorage.getItem("wa_local_statuses") || "[]",
      );
      const filtered = localStatuses.filter((s) => s.id !== statusId);
      localStorage.setItem("wa_local_statuses", JSON.stringify(filtered));
      this.triggerLocalSyncEvent();
      return true;
    } else {
      const { error } = await supabase
        .from("statuses")
        .delete()
        .eq("id", statusId);

      if (error) throw error;
      return true;
    }
  },

  /**
   * Subscribe to real-time status database changes.
   */
  subscribeToStatuses(onUpdate) {
    const localHandler = () => onUpdate();
    if (typeof window !== "undefined") {
      window.addEventListener("wa_status_sync_event", localHandler);
    }

    const statusesChannel = supabase
      .channel("realtime-statuses-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "statuses" },
        () => onUpdate(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_views" },
        () => onUpdate(),
      )
      .subscribe();

    return {
      unsubscribe: () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("wa_status_sync_event", localHandler);
        }
        supabase.removeChannel(statusesChannel);
      },
    };
  },

  /**
   * Local storage event trigger.
   */
  triggerLocalSyncEvent() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wa_status_sync_event"));
    }
  },
};
