/** How a banner looks in the customer app: a coloured card with text and a picture. */
export function BannerPreview({
  title,
  subtitle,
  imageUrl,
  color,
}: {
  title: string;
  subtitle: string;
  imageUrl: string | null;
  color: string;
}) {
  return (
    <div
      className="relative flex h-24 w-full max-w-sm overflow-hidden rounded-xl ring-1 ring-line"
      style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#E8F5E9" }}
    >
      <div className="z-10 flex min-w-0 flex-1 flex-col justify-center p-4">
        <p className="truncate text-[15px] font-bold text-ink">{title || "Banner title"}</p>
        <p className="line-clamp-2 text-xs font-medium text-ink-2">{subtitle}</p>
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-32 shrink-0 object-cover" />
      ) : null}
    </div>
  );
}
