/**
 * Odkazy na videa v portfoliu (video k nám nenahráváme – jen odkaz).
 * Pozná YouTube, Instagram, TikTok a Vimeo, vrátí čistý odkaz,
 * adresu přehrávače (když jde vložit) a náhled (jen YouTube).
 */
export type VideoProvider = "youtube" | "instagram" | "tiktok" | "vimeo";

export type ParsedVideo = {
  provider: VideoProvider;
  /** Uložený (vyčištěný) odkaz */
  url: string;
};

export type VideoEmbed = ParsedVideo & {
  /** Adresa pro <iframe>, nebo null (jen odkaz ven) */
  embedUrl: string | null;
  /** Automatický náhled, nebo null */
  thumbnailUrl: string | null;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const IG_CODE = /^[A-Za-z0-9_-]{5,40}$/;

function toUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value || value.length > 500) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function host(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
}

/** Rozpozná odkaz na video; nepodporovaný nebo neplatný → null. */
export function parseVideoUrl(raw: string): ParsedVideo | null {
  const url = toUrl(raw);
  if (!url) return null;
  const h = host(url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (h === "youtube.com" || h === "music.youtube.com") {
    let id: string | null = null;
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
    if (id && YT_ID.test(id)) {
      return {
        provider: "youtube",
        url: parts[0] === "shorts" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      };
    }
    return null;
  }
  if (h === "youtu.be") {
    const id = parts[0];
    return id && YT_ID.test(id) ? { provider: "youtube", url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (h === "instagram.com") {
    // /reel/X, /reels/X, /p/X, /tv/X, i /jmeno/reel/X
    const i = parts.findIndex((p) => ["reel", "reels", "p", "tv"].includes(p));
    const type = parts[i];
    const code = i >= 0 ? parts[i + 1] : undefined;
    if (type && code && IG_CODE.test(code)) {
      const kind = type === "p" ? "p" : type === "tv" ? "tv" : "reel";
      return { provider: "instagram", url: `https://www.instagram.com/${kind}/${code}/` };
    }
    return null;
  }
  if (h === "tiktok.com") {
    // https://www.tiktok.com/@jmeno/video/1234567890
    const i = parts.indexOf("video");
    const id = i >= 0 ? parts[i + 1] : undefined;
    const user = parts[0]?.startsWith("@") ? parts[0] : null;
    if (id && /^\d{5,25}$/.test(id)) {
      return { provider: "tiktok", url: `https://www.tiktok.com/${user ?? "@_"}/video/${id}` };
    }
    return null;
  }
  if (h === "vm.tiktok.com" || h === "vt.tiktok.com") {
    // krátký odkaz – přehrát vložený nejde, jen odkaz ven
    const code = parts[0];
    return code && /^[A-Za-z0-9]{4,20}$/.test(code) ? { provider: "tiktok", url: `https://${h}/${code}/` } : null;
  }
  if (h === "vimeo.com" || h === "player.vimeo.com") {
    const id = parts.find((p) => /^\d{5,12}$/.test(p));
    return id ? { provider: "vimeo", url: `https://vimeo.com/${id}` } : null;
  }
  return null;
}

/** Z uloženého odkazu připraví přehrávač a náhled. */
export function videoEmbed(provider: string, storedUrl: string): VideoEmbed | null {
  const parsed = parseVideoUrl(storedUrl);
  if (!parsed || parsed.provider !== provider) return null;
  const url = new URL(parsed.url);
  const parts = url.pathname.split("/").filter(Boolean);
  switch (parsed.provider) {
    case "youtube": {
      const id = url.searchParams.get("v") ?? parts[1] ?? "";
      return {
        ...parsed,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
    case "instagram":
      return { ...parsed, embedUrl: `https://www.instagram.com/${parts[0]}/${parts[1]}/embed/`, thumbnailUrl: null };
    case "tiktok": {
      const id = parts[2];
      return { ...parsed, embedUrl: id ? `https://www.tiktok.com/embed/v2/${id}` : null, thumbnailUrl: null };
    }
    case "vimeo":
      return { ...parsed, embedUrl: `https://player.vimeo.com/video/${parts[0]}?autoplay=1&dnt=1`, thumbnailUrl: null };
  }
}

/** Je video na výšku (reels, shorts, TikTok)? Pro poměr stran přehrávače. */
export function isVerticalVideo(provider: string, storedUrl: string): boolean {
  return provider === "instagram" || provider === "tiktok" || storedUrl.includes("/shorts/");
}
