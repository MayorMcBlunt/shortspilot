export type Platform = 'tiktok' | 'instagram' | 'youtube'

export type PlatformConfig = {
  name: string
  maxLengthSeconds: number
  aspectRatio: '9:16' | '16:9' | '1:1'
  captionLimit: number
  hashtagLimit: number
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  tiktok: {
    name: 'TikTok',
    maxLengthSeconds: 60,
    aspectRatio: '9:16',
    captionLimit: 2200,
    hashtagLimit: 30,
  },
  instagram: {
    name: 'Instagram Reels',
    maxLengthSeconds: 90,
    aspectRatio: '9:16',
    captionLimit: 2200,
    hashtagLimit: 30,
  },
  youtube: {
    name: 'YouTube Shorts',
    maxLengthSeconds: 60,
    aspectRatio: '9:16',
    captionLimit: 5000,
    hashtagLimit: 15,
  },
}
