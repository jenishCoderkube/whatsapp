"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Loader2, StopCircle } from "lucide-react";
import { locationService } from "../../services/locationService";
import { useTranslation } from "../../hooks/useTranslation";

export default function LocationMapModal({ conversationId, currentUserId, onClose }) {
  const { t } = useTranslation();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [L, setL] = useState(null);

  // 1. Dynamic client-side import of Leaflet
  useEffect(() => {
    import("leaflet").then((leafletModule) => {
      setL(leafletModule.default || leafletModule);
    });
  }, []);

  // 2. Fetch initial active locations and subscribe to real-time changes
  useEffect(() => {
    if (!L) return;

    let isMounted = true;

    // Load initial locations
    locationService.getActiveLocations(conversationId).then((data) => {
      if (isMounted) {
        setLocations(data);
        setIsLoading(false);
      }
    });

    // Subscribe to real-time postgres changes for live_locations
    const unsubscribe = locationService.subscribeToLocationUpdates(
      conversationId,
      (payload) => {
        if (!isMounted) return;

        if (payload.type === "INSERT" || payload.type === "UPDATE") {
          setLocations((prev) => {
            const filtered = prev.filter((loc) => loc.user_id !== payload.location?.user_id);
            return [...filtered, payload.location];
          });
        } else if (payload.type === "DELETE" && payload.location?.user_id) {
          setLocations((prev) => prev.filter((loc) => loc.user_id !== payload.location.user_id));
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [conversationId, L]);

  // 3. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Default center at 0, 0
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([0, 0], 2);

    // Standard OpenStreetMap tiles (supports light/dark tiles out of the box)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [L]);

  // Helper to construct custom marker with profile image or initials
  const createCustomMarker = (profileName, avatarUrl) => {
    const initials = profileName ? profileName.substring(0, 2).toUpperCase() : "?";
    const html = avatarUrl
      ? `<div class="relative w-9 h-9 rounded-full border-2 border-white bg-[#00a884] shadow-md overflow-hidden flex items-center justify-center">
           <img src="${avatarUrl}" class="w-full h-full object-cover" />
           <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#25d366] border border-white rounded-full animate-pulse"></div>
         </div>`
      : `<div class="relative w-9 h-9 rounded-full border-2 border-white bg-[#00a884] shadow-md flex items-center justify-center text-white text-[11px] font-bold">
           ${initials}
           <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#25d366] border border-white rounded-full animate-pulse"></div>
         </div>`;

    return L.divIcon({
      html: html,
      className: "custom-leaflet-marker",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  // 4. Update Markers on location states sync changes
  useEffect(() => {
    if (!L || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentMarkers = markersRef.current;
    const activeUserIds = new Set();

    // Map bounds tracking
    const bounds = [];

    locations.forEach((loc) => {
      const { user_id, latitude, longitude, profiles } = loc;
      activeUserIds.add(user_id);
      bounds.push([latitude, longitude]);

      const name = profiles?.name || "User";
      const avatar = profiles?.avatar;

      // Update position or create new marker
      if (currentMarkers[user_id]) {
        currentMarkers[user_id].setLatLng([latitude, longitude]);
      } else {
        const marker = L.marker([latitude, longitude], {
          icon: createCustomMarker(name, avatar),
        }).addTo(map);

        // Add a tooltip showing the user name
        marker.bindTooltip(name, {
          permanent: true,
          direction: "top",
          className: "bg-wa-sidebar text-wa-text border border-wa-border text-[10px] font-semibold rounded px-1.5 py-0.5 shadow-sm",
          offset: [0, -18],
        });

        currentMarkers[user_id] = marker;
      }
    });

    // Remove expired/deleted markers
    Object.keys(currentMarkers).forEach((uid) => {
      if (!activeUserIds.has(uid)) {
        currentMarkers[uid].remove();
        delete currentMarkers[uid];
      }
    });

    // Adjust zoom dynamically to fit all active participants
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      } else {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [locations, L]);

  // Stop sharing action
  const handleStopSharing = async () => {
    setIsStopping(true);
    try {
      await locationService.stopSharing(conversationId, currentUserId);
      setLocations((prev) => prev.filter((loc) => loc.user_id !== currentUserId));
    } catch (err) {
      console.error(err);
    } finally {
      setIsStopping(false);
    }
  };

  const isUserCurrentlySharing = locations.some((loc) => loc.user_id === currentUserId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-wa-sidebar border border-wa-border rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-scale-up">
        {/* Header bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-wa-border bg-wa-header">
          <div className="flex flex-col">
            <h3 className="font-semibold text-wa-text text-base">{t("chat.live_locations") || "Live Locations"}</h3>
            <p className="text-xs text-wa-muted">
              {locations.length === 0
                ? t("chat.no_active_sharing") || "No active sharing sessions"
                : locations.length > 1
                  ? t("chat.contacts_sharing_live", { count: locations.length }) || `${locations.length} contacts sharing live`
                  : t("chat.contact_sharing_live", { count: locations.length }) || `${locations.length} contact sharing live`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-wa-active text-wa-muted hover:text-wa-text transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Content body */}
        <div className="flex-1 relative bg-wa-bg">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-wa-bg z-20">
              <Loader2 className="h-8 w-8 text-[#00a884] animate-spin" />
              <span className="text-sm text-wa-muted">{t("chat.loading_map_data") || "Loading map data..."}</span>
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full z-10" />
        </div>

        {/* Footer controls */}
        {isUserCurrentlySharing && (
          <footer className="px-6 py-4 border-t border-wa-border bg-wa-header flex items-center justify-end">
            <button
              onClick={handleStopSharing}
              disabled={isStopping}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {isStopping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4" />
              )}
              {t("chat.stop_sharing_live_location") || "Stop Sharing Live Location"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
