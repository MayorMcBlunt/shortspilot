// ─────────────────────────────────────────────────────────────────────────────
// Supabase Storage helpers
// Uploads audio and video files for the video generation pipeline.
//
// Buckets (both public):
//   "audio" — TTS MP3 files uploaded before Creatomate render
//   "video" — Final MP4s re-uploaded from Creatomate after render
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

// Use the service role key for server-side uploads (bypasses RLS)
function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// Route to the correct bucket based on the file path prefix
// path examples: "audio/job-uuid.mp3" → bucket "audio"
//                "video/queue-uuid.mp4" → bucket "video"
function getBucket(path: string): string {
  if (path.startsWith('audio/')) return 'audio'
  if (path.startsWith('video/')) return 'video'
  return 'audio'  // safe default
}

export type UploadResult =
  | { success: true; url: string; path: string }
  | { success: false; error: string }

/**
 * Upload a Buffer/Uint8Array to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToStorage(
  buffer: Buffer | Uint8Array,
  path: string,           // e.g. "audio/job-uuid.mp3"
  contentType: string     // e.g. "audio/mpeg" or "video/mp4"
): Promise<UploadResult> {
  try {
    const supabase = getStorageClient()

    const bucket = getBucket(path)
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path.replace(/^(audio|video)\//, ''), buffer, {
        contentType,
        upsert: true,   // allow re-uploads on retry
      })

    if (uploadError) {
      return { success: false, error: `Storage upload failed: ${uploadError.message}` }
    }

    // Both buckets are public — use the stable public URL
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path.replace(/^(audio|video)\//, ''))

    return { success: true, url: publicData.publicUrl, path }
  } catch (err) {
    return {
      success: false,
      error: `Storage error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Upload from a remote URL (e.g. a Creatomate-rendered MP4).
 * Fetches the file then re-uploads to our own storage bucket.
 */
export async function uploadFromUrl(
  remoteUrl: string,
  path: string,
  contentType: string
): Promise<UploadResult> {
  try {
    const response = await fetch(remoteUrl)
    if (!response.ok) {
      return { success: false, error: `Failed to fetch remote file: ${response.statusText}` }
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    return uploadToStorage(buffer, path, contentType)
  } catch (err) {
    return {
      success: false,
      error: `uploadFromUrl error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
