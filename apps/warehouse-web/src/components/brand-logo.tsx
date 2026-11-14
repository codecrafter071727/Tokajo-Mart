import Image from "next/image";

const LOGO = { src: "/logo.png", width: 1024, height: 682 } as const;
const RATIO = LOGO.width / LOGO.height;

type BrandLogoProps = {
  /** Visual height in px; width scales from the logo aspect ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
};

/** Full Milcki lockup — same asset as the browser tab icon. */
export function BrandLogo({ height = 36, className, priority }: BrandLogoProps) {
  const width = Math.round(height * RATIO);

  return (
    <Image
      src={LOGO.src}
      alt="Milcki"
      width={width}
      height={height}
      priority={priority}
      className={["h-auto w-auto shrink-0 object-contain", className].filter(Boolean).join(" ")}
      style={{ height, width, maxHeight: height }}
    />
  );
}
