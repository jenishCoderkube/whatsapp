import { supabase } from "../lib/supabaseClient";

export const storageService = {
  /**
   * Client-side image compression using HTML5 Canvas.
   * Resizes large images to max 1600px and converts to WebP.
   */
  async optimizeImage(file) {
    if (!file || !file.type.startsWith("image/") || file.type === "image/gif") return file;
    
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const maxDim = 1600;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(optimizedFile);
            } else {
              resolve(file);
            }
          },
          "image/webp",
          0.8
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      
      img.src = url;
    });
  },

  /**
   * Upload true binary media and file assets targeting the global `whatsapp-storage` public bucket dynamically.
   * Generates secure isolated string path identifiers natively preventing file overwriting.
   */
  async uploadFile(file, customSubfolder = "attachments") {
    try {
      if (!file) return null;

      const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        throw new Error("OFFLINE_PENDING");
      }

      let fileToUpload = file;
      if (file.type.startsWith("image/")) {
        fileToUpload = await this.optimizeImage(file);
      }

      const fileExtension = fileToUpload.name.split(".").pop();
      const uniqueFileName = `${customSubfolder}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`;

      const { data, error } = await supabase.storage
        .from("whatsapp-storage")
        .upload(uniqueFileName, fileToUpload, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Resolve absolute real public asset URL natively
      const { data: publicUrlData } = supabase.storage
        .from("whatsapp-storage")
        .getPublicUrl(uniqueFileName);

      return publicUrlData?.publicUrl || null;
    } catch (error) {
      if (error.message === "OFFLINE_PENDING") throw error;
      console.warn("Dynamic storage direct upload pipeline exception:", error);
      throw new Error("Unable to complete media payload storage transfer: " + error.message);
    }
  },
};
