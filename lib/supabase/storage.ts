import { getSupabaseClient } from "./client";

/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * Automatically squares (center-crops), downscales to max 360x360,
 * and encodes to optimized JPEG (quality 0.82).
 * Result is typically only ~25KB–35KB while preserving crisp profile quality.
 */
function compressImage(
  file: File,
  maxDim = 360,
  quality = 0.82
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Browser window required for image compression"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const width = img.width;
        const height = img.height;

        // Center crop to 1:1 square
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        const targetDim = Math.min(minDim, maxDim);
        canvas.width = targetDim;
        canvas.height = targetDim;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2D canvas context"));
          return;
        }

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetDim, targetDim);

        // Convert to dataUrl for instant display/fallback
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Convert to Blob for bucket storage upload
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              // Fallback if toBlob fails
              const byteString = atob(dataUrl.split(",")[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              resolve({ blob: new Blob([ab], { type: "image/jpeg" }), dataUrl });
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads user avatar photo:
 * 1. ALWAYS compresses the photo first (reducing 5MB camera photos down to ~30KB).
 * 2. If 'avatars' bucket exists in Supabase, uploads the compressed file to `avatars/${userId}/avatar.jpg` (upsert=true).
 *    Storing only 1 photo per user prevents orphaned storage bloat.
 * 3. If bucket does not exist, seamlessly saves the compressed Data URL directly to the database.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  if (!file) return { url: null, error: "No file selected" };

  if (!file.type.startsWith("image/")) {
    return { url: null, error: "File must be an image (PNG, JPG, JPEG, WEBP)" };
  }

  // Max raw input limit (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { url: null, error: "Photo must be smaller than 10MB" };
  }

  let compressed: { blob: Blob; dataUrl: string };
  try {
    // Step 1: Compress first to ~25KB - 35KB
    compressed = await compressImage(file, 360, 0.82);
  } catch (err) {
    console.error("Compression failed:", err);
    return { url: null, error: "Failed to process photo format" };
  }

  // Step 2: Try uploading the COMPRESSED file to the Supabase Storage Bucket
  const client = getSupabaseClient();
  if (client) {
    try {
      const filePath = `${userId}/avatar.jpg`;
      const compressedFile = new File([compressed.blob], "avatar.jpg", { type: "image/jpeg" });

      const { error: uploadError } = await client.storage
        .from("avatars")
        .upload(filePath, compressedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (!uploadError) {
        const { data } = client.storage.from("avatars").getPublicUrl(filePath);
        if (data?.publicUrl) {
          // Add timestamp query param to bust client image cache when avatar changes
          const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
          return { url: publicUrl, error: null };
        }
      } else {
        console.info(
          "Supabase bucket 'avatars' not created yet or upload failed. Using compressed base64 fallback:",
          uploadError.message
        );
      }
    } catch (e) {
      console.warn("Storage upload exception, using fallback:", e);
    }
  }

  // Step 3: Fallback - return the compressed dataUrl (~30KB)
  // This ensures profile photos ALWAYS work smoothly even without bucket configuration
  return { url: compressed.dataUrl, error: null };
}
