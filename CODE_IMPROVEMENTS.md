# WhatsApp Web - Future Code Improvements & Optimizations

A strategic roadmap of code refactorings, optimizations, and technical improvements to enhance the scalability, security, and performance of the application.

---

### ✅ Extracting Custom Hooks & Subcomponents
* **Current State:** Completed / Active
* **Improvement:**
  * Extracted massive inline modals from `Sidebar.jsx` into separate modular components: `ProfileModal`, `NewChatModal`, `LinkedDevicesModal`, and `LanguageModal`.
  * Extracted inline `MediaRecorder` audio capturing, state, stream cleanups, and timer ticking from `ChatInput.jsx` into the custom hook `useAudioRecorder.js`.
  * Extracted complex rich text markdown formatting, mentions highlighting, and link previews from `MessageBubble.jsx` into a standalone `ExpandableText.jsx` subcomponent.
* **Benefits:** Drastically shrinks code sizes of main views, optimizes maintainability, enforces separation of concerns, and simplifies future unit-testing.

### ➡️ Strict Optimistic Rollbacks & Resend Queue
* **Current State:** If a message or media upload fails, the status updates to `failed`, but there is no mechanism to retry sending.
* **Improvement:**
  * Implement a "Retry" and "Delete" context-menu action on failed message bubbles.
  * Integrate an automatic exponential-backoff retry scheduler in `messageService.js` for failed text messages.
* **Benefits:** Improves user experience when operating under spotty network connections.

---

## ⚡ 2. Performance & Caching Optimizations

### ✅ Real-time User Profile Subscriptions
* **Current State:** Completed / Active
* **Improvement:**
  * Established a table-wide `postgres_changes` listener for the `profiles` table in `realtimeService.js` to dynamically sync name or avatar updates in Redux.
* **Benefits:** Guarantees profile updates are reflected instantly across the active conversation list, chat header, and active bubbles without sending messages.

### ✅ Unique Color-Hashing for Avatar Fallbacks
* **Current State:** Completed / Active
* **Improvement:**
  * Built a deterministic hashing function that takes the user's ID string and returns a matching HSL color pair.
  * Set this color as the background of the initials avatar bubble.
* **Benefits:** Implements the modern visual styling of WhatsApp and Slack, where users without photos are easily distinguishable by unique colored avatar backgrounds.

### ➡️ Message List Virtualization
* **Current State:** Planned
* **Improvement:**
  * Implement list virtualization using `react-window` or `@tanstack/react-virtual` to only mount and render message bubbles currently visible in the scroll viewport.
* **Benefits:** Decreases DOM node counts, optimizes memory overhead, and eliminates scroll stuttering on lower-end devices.

---

## 🔒 3. Security & Infrastructure Upgrades

### ➡️ Cryptographic End-to-End Encryption (E2EE)
* **Current State:** Planned
* **Improvement:**
  * Integrate the Web Crypto API to generate local AES-GCM session keys.
  * Encrypt messages on the sender's client, upload the ciphertexts, and decrypt them on the receiver's client.
* **Benefits:** Guarantees absolute, mathematical privacy where database admins or external interceptors cannot view message texts.

### ✅ Comprehensive Database Indexes
* **Current State:** Completed / Script Added
* **Improvement:**
  * Apply composite indexes in PostgreSQL:
    * Created `supabase/supabase_performance_indexes.sql` containing performance indexes for messages and members tables.
* **Benefits:** Ensures paginated historical queries (`fetchMessages`) and unread checkups stay exceptionally fast under heavy database loads.

---

## 📞 4. Communication & Call Features Enhancement

### ➡️ WebRTC Signaling for Active Calls
* **Current State:** Calls display connection and calling UI panels but lack peer-to-peer media streaming.
* **Improvement:**
  * Combine local media stream tracks with WebRTC connections.
  * Use Supabase Broadcast channels as a low-latency signaling server to negotiate SDP offers/answers and ICE candidates.
* **Benefits:** Upgrades calling layouts into fully operational, zero-cost audio and video calling services.

### ➡️ Group Call Integration
* **Current State:** Calls are configured for 1-to-1 rooms.
* **Improvement:**
  * Support mesh calls or coordinate call tokens pointing to open SFU/MCU calling services.
* **Benefits:** Allows group participants to start and join group conference rooms.

---

## 🛠️ 5. Maintainability & Code Quality

### ➡️ TypeScript Conversion
* **Current State:** The codebase is written in standard JavaScript (`.jsx` / `.js`).
* **Improvement:**
  * Progressively rename files to `.tsx` and `.ts` and define clear interfaces for `User`, `Chat`, `Message`, and `Member` objects.
* **Benefits:** Catches type mismatches at compile time, improves autocomplete accuracy, and reduces regressions during structural updates.
