import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads a salon profile image to Cloudinary and deletes the previous image if one exists.
 */
export async function uploadSalonImage(
  fileBase64: string,
  previousPublicId?: string | null
): Promise<CloudinaryUploadResult> {
  const isConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

  if (!isConfigured) {
    throw new Error(
      "Cloudinary credentials are not configured in .env.local (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)."
    );
  }

  // 1. If previous image exists on Cloudinary, delete it to prevent storage waste
  if (previousPublicId) {
    try {
      await cloudinary.uploader.destroy(previousPublicId, {
        invalidate: true,
      });
      console.log(`[Cloudinary] Deleted previous salon image: ${previousPublicId}`);
    } catch (err) {
      console.warn(`[Cloudinary] Failed to delete previous image ${previousPublicId}:`, err);
    }
  }

  // 2. Upload new image with salon profile optimizations
  const uploadResponse = await cloudinary.uploader.upload(fileBase64, {
    folder: "galla/salons",
    resource_type: "image",
    transformation: [
      { width: 600, height: 600, crop: "fill", gravity: "auto" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });

  return {
    url: uploadResponse.secure_url,
    publicId: uploadResponse.public_id,
  };
}

export { cloudinary };
