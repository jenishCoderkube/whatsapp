export const indexedDBService = {
  dbName: "WhatsAppCloneDB",
  dbVersion: 1,
  db: null,

  async initDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("pending_messages")) {
          db.createObjectStore("pending_messages", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pending_files")) {
          db.createObjectStore("pending_files", { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("IndexedDB initialization error:", event.target.error);
        reject(event.target.error);
      };
    });
  },

  async savePendingMessage(message, file = null) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["pending_messages", "pending_files"], "readwrite");
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);

      const msgStore = transaction.objectStore("pending_messages");
      msgStore.put(message);

      if (file) {
        const fileStore = transaction.objectStore("pending_files");
        fileStore.put({ id: message.id, file });
      }
    });
  },

  async getPendingMessages() {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["pending_messages"], "readonly");
      const store = transaction.objectStore("pending_messages");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getPendingFile(messageId) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["pending_files"], "readonly");
      const store = transaction.objectStore("pending_files");
      const request = store.get(messageId);

      request.onsuccess = () => resolve(request.result?.file || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async removePendingMessage(messageId) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["pending_messages", "pending_files"], "readwrite");
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);

      const msgStore = transaction.objectStore("pending_messages");
      msgStore.delete(messageId);

      const fileStore = transaction.objectStore("pending_files");
      fileStore.delete(messageId);
    });
  }
};
