import { describe, expect, it } from "vitest";
import { isVerticalVideo, parseVideoUrl, videoEmbed } from "./video";

describe("parseVideoUrl", () => {
  it("YouTube – různé tvary odkazu", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toEqual({
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(parseVideoUrl("youtu.be/dQw4w9WgXcQ?si=abc")?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(parseVideoUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ")?.url).toBe(
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    );
    expect(parseVideoUrl("https://www.youtube.com/@kanal")).toBeNull();
  });

  it("Instagram – reel, příspěvek, odkaz s profilem", () => {
    expect(parseVideoUrl("https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=xyz")).toEqual({
      provider: "instagram",
      url: "https://www.instagram.com/reel/C1a2B3c4D5e/",
    });
    expect(parseVideoUrl("instagram.com/reels/C1a2B3c4D5e")?.url).toBe("https://www.instagram.com/reel/C1a2B3c4D5e/");
    expect(parseVideoUrl("https://www.instagram.com/p/C1a2B3c4D5e/")?.url).toBe("https://www.instagram.com/p/C1a2B3c4D5e/");
    expect(parseVideoUrl("https://www.instagram.com/elitez")).toBeNull();
  });

  it("TikTok – plný i krátký odkaz", () => {
    expect(parseVideoUrl("https://www.tiktok.com/@jmeno/video/7301234567890123456?lang=cs")).toEqual({
      provider: "tiktok",
      url: "https://www.tiktok.com/@jmeno/video/7301234567890123456",
    });
    expect(parseVideoUrl("https://vm.tiktok.com/ZMabc123/")?.url).toBe("https://vm.tiktok.com/ZMabc123/");
  });

  it("Vimeo", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", url: "https://vimeo.com/123456789" });
  });

  it("odmítne jiné weby a nesmysly", () => {
    expect(parseVideoUrl("https://example.com/video.mp4")).toBeNull();
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
    expect(parseVideoUrl("")).toBeNull();
  });
});

describe("videoEmbed", () => {
  it("YouTube má přehrávač i náhled", () => {
    const e = videoEmbed("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(e?.embedUrl).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(e?.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
  it("Shorts jako video na výšku", () => {
    expect(videoEmbed("youtube", "https://www.youtube.com/shorts/dQw4w9WgXcQ")?.embedUrl).toContain("/embed/dQw4w9WgXcQ");
    expect(isVerticalVideo("youtube", "https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
  });
  it("Instagram, TikTok, Vimeo", () => {
    expect(videoEmbed("instagram", "https://www.instagram.com/reel/C1a2B3c4D5e/")?.embedUrl).toBe(
      "https://www.instagram.com/reel/C1a2B3c4D5e/embed/",
    );
    expect(videoEmbed("tiktok", "https://www.tiktok.com/@jmeno/video/7301234567890123456")?.embedUrl).toBe(
      "https://www.tiktok.com/embed/v2/7301234567890123456",
    );
    expect(videoEmbed("tiktok", "https://vm.tiktok.com/ZMabc123/")?.embedUrl).toBeNull();
    expect(videoEmbed("vimeo", "https://vimeo.com/123456789")?.embedUrl).toContain("player.vimeo.com/video/123456789");
  });
  it("nesedí-li poskytovatel, nic nevrátí", () => {
    expect(videoEmbed("vimeo", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
