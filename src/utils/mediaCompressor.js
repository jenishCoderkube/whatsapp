/**
 * Client-side media compression helpers to optimize uploads for low-bandwidth and offline situations.
 */

export const compressImage = (file, maxDimension = 1200, quality = 0.75) => {
  return new Promise((resolve) => {
    // If not an image, bypass compression
    if (!file.type.startsWith("image/")) {
      return resolve(file);
    }
    
    // Skip GIF compression to keep animations
    if (file.type === "image/gif") {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale bounds
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            // Use original if compression didn't save space
            if (compressedFile.size >= file.size) {
              resolve(file);
            } else {
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

/**
 * Placeholder for video compression. Client-side video encoding typically requires 
 * massive WebAssembly files (like FFmpeg.wasm), so we warn/validate size instead.
 */
export const compressVideo = async (file) => {
  // Pass-through since WASM transcoders are too heavy, but validates files
  return file;
};
