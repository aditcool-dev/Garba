import { getSupabaseClient } from "./client";

export async function uploadAvatar(userId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  if (!file) return { url: null, error: "No file provided" };

  if (!file.type.startsWith("image/")) {
    return { url: null, error: "File must be an image (PNG, JPG, WEBP)" };
  }

  // Max 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: "Image must be smaller than 5MB" };
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await client.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        return { url: null, error: uploadError.message };
      }

      const { data } = client.storage.from("avatars").getPublicUrl(filePath);
      return { url: data.publicUrl, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Storage upload failed";
      return { url: null, error: msg };
    }
  }

  // Local fallback: convert to Data URL for instant preview & persistence
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({ url: reader.result as string, error: null });
    };
    reader.onerror = () => {
      resolve({ url: null, error: "Failed to read image locally" });
    };
    reader.readAsDataURL(file);
  });
}
