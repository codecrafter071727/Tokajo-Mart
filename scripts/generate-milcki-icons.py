"""Regenerates favicons from apps/warehouse-web/public/logo.png."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = ROOT / "apps/warehouse-web/public/logo.png"
img = Image.open(src).convert("RGBA")
green = (13, 40, 24, 255)


def square(size: int, emblem_scale: float = 0.96) -> Image.Image:
    scale = min(size / img.width, size / img.height) * emblem_scale
    w, h = int(img.width * scale), int(img.height * scale)
    fitted = img.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), green)
    canvas.paste(fitted, ((size - w) // 2, (size - h) // 2), fitted)
    return canvas


def save_ico(path: Path, sizes: tuple[int, ...]) -> None:
    layers = [square(s, 0.98) for s in sizes]
    layers[0].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=layers[1:],
    )


def main() -> None:
    wh_icons = ROOT / "apps/warehouse-web/public/icons"
    wh_icons.mkdir(parents=True, exist_ok=True)
    for s in (192, 512):
        square(s).save(wh_icons / f"icon-{s}.png", "PNG")
    square(180).save(wh_icons / "apple-touch-icon.png", "PNG")
    square(512).save(wh_icons / "maskable-512.png", "PNG")
    save_ico(wh_icons.parent / "favicon.ico", (16, 32, 48))

    wh_app = ROOT / "apps/warehouse-web/src/app"
    wh_app.mkdir(parents=True, exist_ok=True)
    square(192).save(wh_app / "icon.png", "PNG")
    square(180).save(wh_app / "apple-icon.png", "PNG")
    save_ico(wh_app / "favicon.ico", (16, 32, 48))

    admin_pub = ROOT / "apps/admin-web/public"
    for s in (192, 512):
        square(s).save(admin_pub / f"icon-{s}.png", "PNG")
    square(180).save(admin_pub / "apple-touch-icon.png", "PNG")
    save_ico(admin_pub / "favicon.ico", (16, 32, 48))

    admin_app = ROOT / "apps/admin-web/src/app"
    square(192).save(admin_app / "icon.png", "PNG")
    square(180).save(admin_app / "apple-icon.png", "PNG")
    save_ico(admin_app / "favicon.ico", (16, 32, 48))
    print("ok")


if __name__ == "__main__":
    main()
