import { Platform } from '@/types/platform'
import { publishToTikTok } from '@/lib/services/tiktok'
import { publishToInstagram } from '@/lib/services/instagram'
import { publishToYouTube } from '@/lib/services/youtube'

export async function publishContentJob(
  platform: Platform,
  videoUrl: string,
  caption: string,
  title: string
) {
  switch (platform) {
    case 'tiktok':
      return publishToTikTok(videoUrl, caption)
    case 'instagram':
      return publishToInstagram(videoUrl, caption)
    case 'youtube':
      return publishToYouTube(videoUrl, title, caption)
    default:
      throw new Error(`Unknown platform: ${platform}`)
  }
}
