import { describe, expect, it } from "vitest";
import { checkMediaFile, mediaKind, mediaPath, mediaUrl } from "./media";

describe("גלריית דירה", () => {
  it("מזהה סוג", () => {
    expect(mediaKind("image/jpeg")).toBe("image");
    expect(mediaKind("video/mp4")).toBe("video");
    expect(mediaKind("application/pdf")).toBeNull();
  });
  it("מגבלות גודל", () => {
    expect(checkMediaFile("image/png", 2_000_000)).toBeNull();
    expect(checkMediaFile("image/png", 11 * 1024 * 1024)).toMatch(/10MB/);
    expect(checkMediaFile("video/mp4", 49 * 1024 * 1024)).toBeNull();
    expect(checkMediaFile("video/mp4", 51 * 1024 * 1024)).toMatch(/50MB/);
    expect(checkMediaFile("text/html", 10)).toMatch(/לא נתמך/);
    expect(checkMediaFile("image/png", 0)).toMatch(/ריק/);
  });
  it("נתיב וכתובת", () => {
    expect(mediaPath("apt1", "Photo One.JPG", "abc")).toBe("apt1/abc.jpg");
    expect(mediaPath("apt1", "noext", "abc")).toBe("apt1/abc.bin");
    expect(mediaUrl("https://x.supabase.co", "a/b.jpg")).toBe("https://x.supabase.co/storage/v1/object/public/apartment-media/a/b.jpg");
  });
});
