---
name: Blinkit
description: Quick-commerce grocery app. Dense, fast, utilitarian. Yellow brand shell, green action color, white product cards on a light grey canvas.
# CONFIDENCE: [official] = published brand color; [approx] = reconstructed from the live app, verify against a current screenshot before shipping.
colors:
  brand-yellow: "#F8CB46" # [official] header shell, splash, brand moments
  brand-green: "#0C831F" # [official] primary action: ADD, steppers, cart bar, success
  brand-black: "#1C1C1C" # [official] primary text
  green-tint: "#F7FFF9" # [approx] ADD button hover / selected tint
  green-border: "#318616" # [approx] ADD button outline
  yellow-tint: "#FFF9E5" # [approx] promo strips, soft highlights
  canvas: "#F4F6FB" # [approx] page background behind cards
  surface: "#FFFFFF" # cards, sheets, bars
  border: "#E8E8E8" # [approx] hairlines
  text-primary: "#1C1C1C"
  text-secondary: "#666666" # [approx] units, subtext
  text-tertiary: "#9C9C9C" # [approx] struck-through MRP, placeholders
  offer-blue: "#256FEF" # [approx] link-style offers, info
  discount-green: "#0C831F" # % OFF badge text/background
  danger: "#E23744" # [approx] errors, out of stock accents
  disabled-bg: "#F0F0F0"
  disabled-text: "#B0B0B0"
typography:
  family: "Okra, 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif" # [approx] Okra is believed; Inter is the safe open fallback
  display: { size: 24px, weight: 800, line: 28px }
  h1: { size: 20px, weight: 800, line: 24px }
  h2: { size: 16px, weight: 700, line: 20px }
  body: { size: 14px, weight: 500, line: 20px }
  product-name: { size: 13px, weight: 600, line: 17px, lines: 2 }
  caption: { size: 12px, weight: 500, line: 16px }
  micro: { size: 10px, weight: 700, line: 12px, tracking: 0.2px, transform: uppercase }
  price: { size: 13px, weight: 700 }
spacing: { 2: 2px, 4: 4px, 8: 8px, 12: 12px, 16: 16px, 20: 20px, 24: 24px }
rounded: { xs: 4px, sm: 8px, md: 12px, lg: 16px, pill: 999px }
elevation:
  none: "none"
  card: "0 1px 2px rgba(0,0,0,0.06)"
  sticky: "0 -2px 8px rgba(0,0,0,0.10)"
  sheet: "0 -4px 16px rgba(0,0,0,0.15)"
motion:
  fast: 120ms
  base: 200ms
  easing: "cubic-bezier(0.2, 0, 0, 1)"
---

# Blinkit Design System

## 1. Overview and Feel

Blinkit feels like a **fast, no-nonsense utility** wearing a friendly yellow coat. The product is speed ("delivery in minutes"), so every screen is built to get a user from intent to cart in the fewest taps. Density is high, decoration is minimal, and the only strong color moments are **yellow** (brand, arrival) and **green** (action, success, savings).

Principles:

1. **Speed over spectacle.** No heavy animation, no hero imagery that delays scanning.
2. **Green means act or save.** If it is green, it adds, confirms, or discounts. Never use green decoratively.
3. **Yellow means brand and warmth.** Header shell, splash, delivery-time moments. Not for buttons.
4. **Products are the visuals.** Packshots on white, tightly gridded. UI chrome stays neutral so product photography carries color.
5. **Always show time, price, and unit.** Delivery ETA, price, MRP, and pack size are never hidden.

## 2. Color Usage

| Role             | Token                           | Where                                                                           |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| Brand shell      | `brand-yellow`                  | Home header background (location, search), splash, onboarding                   |
| Primary action   | `brand-green`                   | ADD text and border, stepper fill, cart bar, Proceed/Pay buttons, success ticks |
| Text             | `brand-black`, `text-secondary` | Headings and prices in black; units and metadata in grey                        |
| Canvas           | `canvas`                        | Behind card rows and sections                                                   |
| Cards and sheets | `surface`                       | Product cards, bill details, bottom sheets                                      |
| Savings          | `discount-green`                | "X% OFF" badges, "You saved" strips                                             |
| Highlight strip  | `yellow-tint`                   | Free delivery nudges, offers banners                                            |

Rules: max one saturated color block per viewport region. Text on `brand-yellow` is always `brand-black`. Text on `brand-green` is always white.

## 3. Typography

Heavy weights for headings (700 to 800), medium for body (500). Prices are bold. Product names clamp to **2 lines** with ellipsis. Unit text (e.g. "500 g", "1 L") sits in `caption` grey directly under the name. Delivery-time pill uses `micro` uppercase, e.g. "8 MINS".

## 4. Layout and Spacing

- Mobile-first, single column. Horizontal padding **12 to 16px**.
- 8px base grid. Gaps between product cards **8px**, between sections **12 to 16px**.
- Product grids: **3 columns** on category/listing screens, horizontally scrolling rails (about 2.5 cards visible) on home.
- Category grid on home: 4 columns of icon tiles with 2-line labels below.
- Sticky elements: top search bar on scroll, **bottom cart bar** above the OS inset, bottom tab nav on home only.

## 5. Components

### 5.1 Home Header (yellow shell)

- Background `brand-yellow`, extends under the status bar.
- Row 1: small delivery-time headline ("Delivery in N minutes", `h1` weight 800) and address line with chevron, `caption`. Profile avatar icon top right.
- Row 2: search bar, white, `rounded.md` (12px), 44 to 48px tall, leading search icon, placeholder cycles through examples such as `Search "milk"`, with a mic icon trailing.
- On scroll the header collapses to just the search bar, remaining yellow.

### 5.2 Product Card

- Surface white, `rounded.sm` to `rounded.md`, hairline `border` or very light `elevation.card`.
- Top: square packshot, centered, generous padding, on white.
- Overlays: discount badge top-left (small green flag/ribbon, white bold text, "20% OFF"); delivery-time pill small, grey-bordered, with clock icon.
- Body: product name (`product-name`, 2 lines), unit (`caption`, grey), then price row.
- Price row: left = selling price (`price`, black) and struck-through MRP (`text-tertiary`) beside it. Right = **ADD button**.
- Variants: "N options" dropdown chip instead of unit when multiple pack sizes exist.

### 5.3 ADD Button and Stepper

- **ADD (default):** white background, 1px `green-border`, `brand-green` text, 700 weight, uppercase "ADD", `rounded.sm` (8px), about 32px tall, 64 to 72px wide. Pressed: `green-tint` fill.
- **Stepper (after add):** `brand-green` fill, white `−  N  +`, same size and radius as ADD, so the layout never shifts. Tap targets at least 32px.
- Quantity change animates in under `motion.fast`. Haptic tick on mobile.

### 5.4 Sticky Cart Bar

- Appears at bottom the moment the cart is non-empty. Full width minus 12px margins, `brand-green` fill, `rounded.md`, white text.
- Left: "N items" with stacked mini thumbnails or count, and total price beneath. Right: "View Cart" with chevron.
- Sits above bottom nav or safe area. Slides up with `motion.base`.

### 5.5 Category Tile

- Soft pastel or light-grey rounded square (`rounded.md`) holding a product collage/icon; label below in `caption` weight 600, centered, max 2 lines.

### 5.6 Section Rail

- Section title `h2` left, "see all" text link in `brand-green` right. Rail scrolls horizontally with peeking last card to signal more content.

### 5.7 Cart Screen

- Stack of white cards on `canvas`: (1) delivery-time strip with clock and "Delivery in N minutes, shipment of X items"; (2) item list with image, name, unit, price, stepper; (3) "Before you checkout" suggestion rail; (4) **Bill details** (item total with strike MRP, delivery charge, handling charge, grand total, "Your total savings" in green); (5) cancellation policy fine print; (6) tip-your-partner chips (pill chips, selected = green outline and tint).
- Bottom sticky bar: address summary and a full-width `brand-green` primary button ("Proceed to Pay" or "Login to proceed").

### 5.8 Buttons (general)

- **Primary:** `brand-green` fill, white text, 700, 48px tall, `rounded.md`.
- **Secondary:** white fill, green border and text.
- **Disabled:** `disabled-bg` fill, `disabled-text`.
- No gradients, no heavy shadows.

### 5.9 Chips and Badges

- Filter and tip chips: pill, 1px border `border`, 13px 600 text; selected state = green border, `green-tint` fill, green text.
- Offer badge: blue text `offer-blue` on white or very light blue for bank/coupon info.

### 5.10 Bottom Sheets and Modals

- White, top corners `rounded.lg` (16px), grabber handle, dimmed scrim, `elevation.sheet`. Used for variant picker, address selection, coupons, product details.

### 5.11 Product Detail

- Image carousel with dots, name, unit, delivery pill, price block with savings, "View product details" accordion, highlights list, "Similar products" rail, sticky bottom bar with price and ADD.

### 5.12 Tracking Screen

- Map in upper half, sheet in lower half with ETA in large bold, delivery partner card (avatar, name, call button), and status line. Yellow accents only for the ETA moment.

## 6. Iconography and Imagery

- Line icons, 1.5 to 2px stroke, rounded caps, 20 to 24px, black or grey; green only when active.
- Product images on pure white, consistent crop and padding, with soft shadow-free presentation.
- Illustrations (empty states, errors) are flat, friendly, limited to brand yellow, green, black, and white.

## 7. Motion

- Short and functional: 120 to 200ms, standard ease-out. Cart bar slide-up, ADD to stepper morph, sheet slide, shimmer skeletons (light grey) on loading rails.
- No parallax, no long page transitions.

## 8. Voice and Microcopy

- Short, confident, slightly playful: "Delivery in 10 minutes", "Add", "View cart", "You saved ₹X on this order".
- Prices use ₹ with no decimals unless needed. Units always visible.
- Errors are plain and actionable, not apologetic essays.

## 9. Do and Don't

**Do**

- Keep ADD and stepper identical in footprint.
- Show savings in green wherever MRP exceeds price.
- Keep the cart bar reachable at all times once items exist.
- Use skeleton loaders that match card geometry.

**Don't**

- Don't use yellow for CTAs or green for backgrounds of large areas other than the cart bar and primary buttons.
- Don't add drop shadows to every card, use hairlines.
- Don't hide unit or delivery time behind taps.
- Don't introduce a second accent color.

## 10. Known Unknowns

- Exact font (Okra assumed), exact grey values, exact corner radii, and animation curves are approximations. Capture them from a current build and update the `[approx]` tokens above.
- Blinkit's internal system is called Bolt and is not public in full, so this file is a reconstruction, not an export.
