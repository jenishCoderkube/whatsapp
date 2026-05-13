import { supabase } from "../lib/supabaseClient";

export const storageService = {
  /**
   * Upload true binary media and file assets targeting the global `whatsapp-storage` public bucket dynamically.
   * Generates secure isolated string path identifiers natively preventing file overwriting.
   */
  async uploadFile(file, customSubfolder = "attachments") {
    try {
      if (!file) return null;

      const fileExtension = file.name.split(".").pop();
      const uniqueFileName = `${customSubfolder}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`;

      const { data, error } = await supabase.storage
        .from("whatsapp-storage")
        .upload(uniqueFileName, file, {
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
      console.warn("Dynamic storage direct upload pipeline exception:", error);
      throw new Error("Unable to complete media payload storage transfer: " + error.message);
    }
  },
};
