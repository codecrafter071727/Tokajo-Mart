import type { Banner as BannerDto } from "@qc/contracts";
import { banners as fixtureBanners } from "./mockData";

export type BannerLink =
  { type: "category"; target: string } | { type: "product"; target: string } | null;

/** What the home strip draws, whether it came from the server or from the bundled fixtures. */
export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string;
  /** Background gradient stops. Server banners use one flat colour twice. */
  colors: [string, string];
  /** Dark text on light backgrounds, white text on dark ones */
  darkText: boolean;
  cta: string | null;
  photos: string[];
  emoji: string;
  link: BannerLink;
};

/** True when a #rrggbb colour is light enough that dark text reads on it. */
export function isLight(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1] as string, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Perceived brightness, 0 to 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function toHomeBanner(dto: BannerDto): HomeBanner {
  const link: BannerLink =
    dto.linkType !== "none" && dto.linkTarget
      ? { type: dto.linkType, target: dto.linkTarget }
      : null;
  return {
    id: dto.id,
    title: dto.title,
    subtitle: dto.subtitle,
    colors: [dto.color, dto.color],
    darkText: isLight(dto.color),
    cta: link ? "Shop now" : null,
    photos: dto.imageUrl ? [dto.imageUrl] : [],
    emoji: "🛒",
    link,
  };
}

export const fixtures: HomeBanner[] = fixtureBanners.map((b) => ({
  id: b.id,
  title: b.title,
  subtitle: b.subtitle,
  colors: b.gradient,
  darkText: false,
  cta: b.cta,
  photos: b.images,
  emoji: b.image,
  link: null,
}));
