import { supabase } from "../lib/supabaseClient";
import { storageService } from "./storageService";
import { profileService } from "./profileService";
import { chatService } from "./chatService";
import { messageService } from "./messageService";

// Helper to determine if we should use local storage fallback
let useLocalFallback = false;

export const statusService = {
  /**
   * Resiliently check if statuses table exists, and fallback to localStorage if not.
   */
  async checkTableExists() {
    try {
      const { error } = await supabase.from("statuses").select("id").limit(1);
      if (error && error.code === "PGRST205") {
        useLocalFallback = true;
        console.warn("Statuses table not found in Supabase. Using localStorage fallback.");
      } else {
        useLocalFallback = false;
      }
    } catch (e) {
      useLocalFallback = true;
      console.warn("Unable to connect to Supabase statuses table. Using localStorage fallback.");
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
  }) {
    await this.checkTableExists();

    let mediaUrl = null;
    if (mediaFile) {
      // Upload media if present
      mediaUrl = await storageService.uploadFile(mediaFile, "statuses");
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h from now

    if (useLocalFallback) {
      const newStatus = {
        id: "local-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        type,
        media_url: mediaUrl,
        caption,
        text_content: textContent,
        bg_color: bgColor,
        text_style: textStyle,
        privacy,
        privacy_list: privacyList,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        views: [],
      };

      const localStatuses = JSON.parse(localStorage.getItem("wa_local_statuses") || "[]");
      localStatuses.unshift(newStatus);
      localStorage.setItem("wa_local_statuses", JSON.stringify(localStatuses));

      // Trigger local updates
      this.triggerLocalSyncEvent();
      return newStatus;
    } else {
      const insertPayload = {
        user_id: userId,
        type,
        media_url: mediaUrl,
        caption,
        text_content: textContent,
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
      return data;
    }
  },

  /**
   * Fetch active statuses, grouping them by user, and filtering out expired ones.
   */
  async fetchStatuses(currentUserId) {
    await this.checkTableExists();

    const nowIso = new Date().toISOString();

    if (useLocalFallback) {
      const localStatuses = JSON.parse(localStorage.getItem("wa_local_statuses") || "[]");
      const localViews = JSON.parse(localStorage.getItem("wa_local_status_views") || "[]");
      
      // Filter out expired statuses
      const activeStatuses = localStatuses.filter((s) => new Date(s.expires_at) > new Date());
      localStorage.setItem("wa_local_statuses", JSON.stringify(activeStatuses));

      // Get user profiles
      // Fetch all unique profiles from database so that statuses display valid user info
      const uniqueUserIds = [...new Set(activeStatuses.map((s) => s.user_id))];
      const profilesMap = {};
      
      for (const uid of uniqueUserIds) {
        if (uid === currentUserId) {
          const { data: currentProfile } = await supabase.from("profiles").select("*").eq("id", uid).single();
          profilesMap[uid] = currentProfile || { id: uid, name: "Me", avatar: "" };
        } else {
          const profile = await profileService.getProfileById(uid);
          profilesMap[uid] = profile || { id: uid, name: "Contact", avatar: "" };
        }
      }

      // Group statuses by user
      const groups = {};
      
      activeStatuses.forEach((status) => {
        const uid = status.user_id;
        const profile = profilesMap[uid] || { id: uid, name: "Contact", avatar: "" };
        
        // Find views for this status
        const viewsForStatus = localViews
          .filter((v) => v.status_id === status.id)
          .map((v) => ({
            viewerId: v.viewer_id,
            name: v.name,
            avatar: v.avatar,
            reaction: v.reaction,
            replyText: v.reply_text,
            createdAt: v.created_at,
          }));

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
        groups[uid].statuses.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
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

      // 2. Fetch views for these active statuses
      const statusIds = statusesData.map((s) => s.id);
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
        viewsByStatus[view.status_id].push({
          viewerId: view.viewer_id,
          name: view.profiles?.name || "Viewer",
          avatar: view.profiles?.avatar,
          reaction: view.reaction,
          replyText: view.reply_text,
          createdAt: view.created_at,
        });
      });

      // Group statuses by user
      const groups = {};

      statusesData.forEach((status) => {
        const uid = status.user_id;
        const profile = status.profiles || { id: uid, name: "Contact", avatar: "" };
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
        groups[uid].statuses.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        if (uid !== currentUserId) {
          groups[uid].hasUnseen = groups[uid].statuses.some((s) => !s.isSeen);
        } else {
          groups[uid].hasUnseen = false;
        }
      });

      return Object.values(groups);
    }
  },

  /**
   * Log seen state when a status is viewed by a user.
   */
  async markStatusAsSeen(statusId, viewerId) {
    await this.checkTableExists();

    if (useLocalFallback) {
      const localViews = JSON.parse(localStorage.getItem("wa_local_status_views") || "[]");
      
      const alreadyViewed = localViews.some(
        (v) => v.status_id === statusId && v.viewer_id === viewerId
      );

      if (!alreadyViewed) {
        // Get viewer profile details
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("id", viewerId)
          .single();

        const newView = {
          id: "view-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
          status_id: statusId,
          viewer_id: viewerId,
          name: viewerProfile?.name || "Viewer",
          avatar: viewerProfile?.avatar || "",
          reaction: null,
          reply_text: null,
          created_at: new Date().toISOString(),
        };

        localViews.push(newView);
        localStorage.setItem("wa_local_status_views", JSON.stringify(localViews));
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

      if (error && error.code !== "23505") { // Ignore unique constraint violation
        console.warn("Error inserting status view:", error);
      }
      return data;
    }
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
      const localViews = JSON.parse(localStorage.getItem("wa_local_status_views") || "[]");
      const updatedViews = localViews.map((v) => {
        if (v.status_id === statusId && v.viewer_id === currentUserId) {
          return { ...v, reaction: emoji };
        }
        return v;
      });
      localStorage.setItem("wa_local_status_views", JSON.stringify(updatedViews));
      this.triggerLocalSyncEvent();
    } else {
      const { error } = await supabase
        .from("status_views")
        .update({ reaction: emoji })
        .eq("status_id", statusId)
        .eq("viewer_id", currentUserId);

      if (error) console.warn("Failed to save status reaction:", error);
    }

    // 2. Send Direct Message to the user as a status interaction
    try {
      const ownerProfile = await profileService.getProfileById(ownerId);
      if (ownerProfile) {
        const chatObj = await chatService.createOrOpenOneToOneChat(currentUserId, ownerProfile);
        
        let statusPreviewText = "status update";
        if (status.type === "text") {
          statusPreviewText = `"${status.textContent}"`;
        } else if (status.type === "image") {
          statusPreviewText = "📷 Photo status";
        } else if (status.type === "video") {
          statusPreviewText = "🎥 Video status";
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
          emojiReaction: emoji
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
      const localViews = JSON.parse(localStorage.getItem("wa_local_status_views") || "[]");
      const updatedViews = localViews.map((v) => {
        if (v.status_id === statusId && v.viewer_id === currentUserId) {
          return { ...v, reply_text: replyText };
        }
        return v;
      });
      localStorage.setItem("wa_local_status_views", JSON.stringify(updatedViews));
      this.triggerLocalSyncEvent();
    } else {
      const { error } = await supabase
        .from("status_views")
        .update({ reply_text: replyText })
        .eq("status_id", statusId)
        .eq("viewer_id", currentUserId);

      if (error) console.warn("Failed to save status reply text:", error);
    }

    // 2. Send Direct Message to the user containing the reply text and status metadata context
    try {
      const ownerProfile = await profileService.getProfileById(ownerId);
      if (ownerProfile) {
        const chatObj = await chatService.createOrOpenOneToOneChat(currentUserId, ownerProfile);
        
        let statusDescription = "Status";
        let statusMediaUrl = status.mediaUrl;
        
        if (status.type === "text") {
          statusDescription = `Status: "${status.textContent}"`;
        } else if (status.type === "image") {
          statusDescription = status.caption ? `Photo Status: "${status.caption}"` : "Photo Status";
        } else if (status.type === "video") {
          statusDescription = status.caption ? `Video Status: "${status.caption}"` : "Video Status";
        }

        // WhatsApp Web sends a quoted message containing the status preview when replying
        // Let's model this using replyTo metadata context
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
      const localStatuses = JSON.parse(localStorage.getItem("wa_local_statuses") || "[]");
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
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_views" },
        () => onUpdate()
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
