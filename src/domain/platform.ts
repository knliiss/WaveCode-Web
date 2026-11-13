export interface PlatformBrand {
  id: string;
  label: string;
  color: string;
  icon?: string;
  fallback?: string;
}

const brands = {
  spotify: { id: "spotify", label: "Spotify", color: "#1ed760", icon: "/platforms/spotify.svg" },
  youtubeMusic: { id: "youtube-music", label: "YouTube Music", color: "#ee1b24", icon: "/platforms/youtubemusic.svg" },
  youtube: { id: "youtube", label: "YouTube", color: "#f0181b", icon: "/platforms/youtube.svg" },
  youtubeShorts: { id: "youtube-shorts", label: "YouTube Shorts", color: "#f0181b", icon: "/platforms/youtube.svg" },
  tiktok: { id: "tiktok", label: "TikTok", color: "#171717", icon: "/platforms/tiktok.svg" },
  instagram: { id: "instagram", label: "Instagram Reels", color: "#cd3b70", icon: "/platforms/instagram.svg" },
  appleMusic: { id: "apple-music", label: "Apple Music", color: "#ee3855", icon: "/platforms/applemusic.svg" },
  deezer: { id: "deezer", label: "Deezer", color: "#7a35be", icon: "/platforms/deezer.svg" },
  tidal: { id: "tidal", label: "TIDAL", color: "#161616", icon: "/platforms/tidal.svg" },
  qobuz: { id: "qobuz", label: "Qobuz", color: "#202020", fallback: "Q" },
  amazonMusic: { id: "amazon-music", label: "Amazon Music", color: "#087da4", fallback: "a" },
} as const satisfies Record<string, PlatformBrand>;

export function platformFromUrl(value: string): PlatformBrand | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    switch (url.hostname.toLowerCase()) {
      case "music.youtube.com": return brands.youtubeMusic;
      case "www.youtube.com":
      case "youtube.com":
      case "m.youtube.com":
        return url.pathname.startsWith("/shorts/") ? brands.youtubeShorts : brands.youtube;
      case "youtu.be": return brands.youtube;
      case "open.spotify.com": return brands.spotify;
      case "www.tiktok.com":
      case "tiktok.com":
      case "vt.tiktok.com": return brands.tiktok;
      case "www.instagram.com":
      case "instagram.com": return brands.instagram;
      case "music.apple.com": return brands.appleMusic;
      case "www.deezer.com":
      case "deezer.com": return brands.deezer;
      case "tidal.com":
      case "www.tidal.com":
      case "listen.tidal.com": return brands.tidal;
      case "open.qobuz.com":
      case "play.qobuz.com": return brands.qobuz;
      case "music.amazon.com": return brands.amazonMusic;
      default: return null;
    }
  } catch {
    return null;
  }
}
