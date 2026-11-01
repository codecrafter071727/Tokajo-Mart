# design.md — Quick Commerce Customer App

Working name: **Dash** (placeholder, rename freely)
Platform: React Native (Expo) customer app. Tokens are written so the same values drive the Next.js web frontends.
Status: v1 design foundation. The brand color is a placeholder and lives in **one token file** so it can be swapped later without touching components.

---

## 1. Product job

People open this app for a **known need, right now**: milk, a charger, something for guests arriving in 20 minutes. The job of the UI is to get from "I need X" to "paid" in under 30 seconds, and to make the second order faster than the first.

Everything below serves four behaviors:

1. **Find fast** (search first, categories second, discovery third)
2. **Add without leaving the list** (inline stepper, never a modal)
3. **Always know where the cart is** (persistent cart bar)
4. **Trust the ETA** (the delivery promise is the hero, always visible)

---

## 2. What the market leaders do (research summary)

Sources: UX teardowns and case studies of Blinkit, Zepto and Instamart, plus Blinkit interaction recordings. Treat these as patterns to understand, not pixels to copy.

| Pattern             | What leaders do                                                                                               | What we do                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ETA as hero         | Delivery time sits in the header next to the address, bold and always visible                                 | Same. It is the largest text in the header                                     |
| Browse before login | Blinkit lets users into the app without forcing sign-in; Instamart asks for a location first                  | Location-first, **no login wall** until checkout                               |
| Reorder surfaces    | Last-ordered items on home; case studies repeatedly recommend "frequently bought" and "favourites" at the top | "Buy again" is the **first** home section for returning users                  |
| Cart visibility     | A floating "View cart" pill on home; teardowns flag its absence on product pages as friction                  | Cart bar is global: home, listing, PDP, search                                 |
| Product cards       | Dense grid, weight/pack size under the name, discount badge, one-tap ADD that turns into a stepper            | Same structure, tighter hierarchy (see §8.4)                                   |
| Trust cues          | Small facts such as "sourced this morning" on fresh items                                                     | Freshness/origin line on perishables                                           |
| Category browsing   | Grid of category tiles; case studies criticize inconsistent tiles with multiple images each                   | **One image per tile, one uniform size**                                       |
| Checkout speed      | Saved UPI intent, minimal fields, contextual add-ons (milk, bread) before pay                                 | One-screen checkout, saved payment, 3 contextual add-ons max                   |
| Urgency tactics     | Zepto-style countdown timers and surge notices                                                                | Surge/rain fees get a clear explanation; **no fake countdown timers**          |
| Personality         | Playful mascots, festive theme switches, story-style recaps                                                   | Small, seasonal, skippable moments. Never block the path to purchase           |
| Known weak spots    | "Save for later" buried with no feedback; inconsistent save icons                                             | Wishlist is a heart on every card, with a toast and a visible entry in Account |

**Where a competitor can win:** less visual noise than the incumbents, a faster repeat-order path, honest pricing, and a calm checkout with no dark patterns.

---

## 3. Design principles

1. **Speed is the feature.** Every screen answers: can this be done in one tap fewer?
2. **The grid is the product.** Product cards are 80% of what users see. Get the card right and the app is right.
3. **One loud thing per screen.** Brand color is rare so it carries meaning (primary actions, ETA, cart).
4. **Quiet surfaces, loud actions.** Backgrounds are near-white and neutral; only ADD, cart and pay are saturated.
5. **Honest urgency.** Show real ETAs and real stock. Never invent scarcity.
6. **Thumb-first.** Primary actions live in the bottom 40% of the screen.

---

## 4. Color

### 4.1 Brand color (placeholder, chosen for a Blinkit competitor)

Incumbents own yellow-green (Blinkit), purple (Zepto) and orange (Instamart). The brand is now a fresh green (`#42C86E`).

| Token           | Hex           | Use                                                  |
| --------------- | ------------- | ---------------------------------------------------- |
| `brand-900`     | `#0C3D1D`     | Text on tinted brand surfaces                        |
| `brand-700`     | `#238A47`     | Pressed state, green text and icons on white (4.3:1) |
| **`brand-600`** | **`#42C86E`** | **Primary. Buttons, ADD, cart bar, header gradient** |
| `brand-500`     | `#5BD686`     | Icons, progress                                      |
| `brand-200`     | `#B2EBC7`     | Borders on tinted surfaces                           |
| `brand-100`     | `#DCF7E6`     | Tinted backgrounds, selected chips                   |
| `brand-50`      | `#F1FCF5`     | Subtle tinted wash                                   |

The brand is `#42C86E` (chosen by the product owner). It is a light green, so white text on it is only about 2.2:1: keep it bold and large, and use `brand-700` (`Colors.brandText`) for any green text or icon that sits on white.

### 4.2 Accent (secondary signal color)

| Token        | Hex       | Use                                                   |
| ------------ | --------- | ----------------------------------------------------- |
| `accent-500` | `#FFB400` | Offers, ratings, "fastest" badges, savings highlights |
| `accent-100` | `#FFF3CC` | Offer strip backgrounds                               |
| `accent-900` | `#5C4000` | Text on accent-100 (never white on accent-500)        |

### 4.3 Neutrals

| Token         | Hex       | Use                                                  |
| ------------- | --------- | ---------------------------------------------------- |
| `ink-900`     | `#14201E` | Primary text (slightly green-tinted, not pure black) |
| `ink-700`     | `#3B4A47` | Secondary text                                       |
| `ink-500`     | `#6B7A77` | Tertiary, captions, placeholders                     |
| `line-300`    | `#DDE5E3` | Borders, dividers                                    |
| `surface-100` | `#F3F6F5` | Screen background, image placeholders                |
| `surface-0`   | `#FFFFFF` | Cards, sheets                                        |

### 4.4 Semantic

| Token         | Hex       | Use                          |
| ------------- | --------- | ---------------------------- |
| `success-600` | `#15803D` | Delivered, in stock, savings |
| `warning-600` | `#B45309` | Low stock, surge notice      |
| `danger-600`  | `#C62828` | Errors, out of stock, remove |
| `info-600`    | `#1D6FD8` | Informational banners        |

### 4.5 Dark mode (v1.1, tokens reserved)

Background `#0E1513`, card `#16201D`, text `#EAF2F0`, brand shifts to `brand-500` for contrast. Do not hard-code hex in components, only tokens, so dark mode is a token swap.

### 4.6 Rules

- Brand fills are for **actions and status**, not decoration. No gradient washes behind content.
- Text on `brand-600` is white; text on `accent-500` is `accent-900`.
- Minimum contrast 4.5:1 for body text, 3:1 for large text and UI icons.
- Never convey state by color alone (add icon or label for stock, errors, offers).

---

## 5. Typography

**Family:** `Plus Jakarta Sans` (Google Fonts, free). Friendly and geometric with strong numerals, which matters because prices, ETAs and quantities are the main content. It supports Latin only, so add `Noto Sans Devanagari` as a fallback for Hindi.

**Fallback stack:** `Plus Jakarta Sans`, `Noto Sans Devanagari`, system-ui, sans-serif.

Weights loaded: 400, 500, 600, 700, 800 (limit to these to protect app size).

| Token          | Size / Line | Weight | Use                               |
| -------------- | ----------- | ------ | --------------------------------- |
| `display`      | 28 / 34     | 800    | ETA in header, empty-state titles |
| `title-lg`     | 22 / 28     | 700    | Screen titles                     |
| `title`        | 18 / 24     | 700    | Section headers                   |
| `subtitle`     | 16 / 22     | 600    | Card titles, list rows            |
| `body`         | 14 / 20     | 400    | Default body                      |
| `body-strong`  | 14 / 20     | 600    | Product name, emphasis            |
| `price`        | 15 / 20     | 700    | Selling price (tabular numerals)  |
| `price-strike` | 12 / 16     | 400    | MRP, strikethrough, `ink-500`     |
| `caption`      | 12 / 16     | 500    | Pack size, delivery notes         |
| `micro`        | 10 / 12     | 600    | Badges only                       |

Rules:

- Use **tabular numerals** for prices and quantities (`fontVariant: ['tabular-nums']`) so columns align while quantities change.
- Sentence case everywhere. No ALL CAPS labels except the single button word `ADD`.
- Support Dynamic Type / font scaling up to 130%. Layouts must not clip at 130%.
- Max 2 lines for product names, ellipsize after that.

---

## 6. Spacing, layout, shape

**Base unit: 4px.**

| Token      | Value |
| ---------- | ----- |
| `space-1`  | 4     |
| `space-2`  | 8     |
| `space-3`  | 12    |
| `space-4`  | 16    |
| `space-5`  | 20    |
| `space-6`  | 24    |
| `space-8`  | 32    |
| `space-10` | 40    |

- **Screen gutter:** 16px.
- **Design base frame:** 360 × 800 (small Android). Verify at 390 × 844 (iPhone) and 412 × 915.
- **Product grid:** 3 columns on phones, 12px gap, 16px outer margin. Card width = `(screenWidth − 32 − 24) / 3`. Switch to 2 columns under 340px width, 4 on tablets.
- **Touch targets:** minimum 44 × 44. ADD/stepper buttons are 32px tall visually but with a 44px hit area.

**Radius**

| Token         | Value | Use                         |
| ------------- | ----- | --------------------------- |
| `radius-sm`   | 8     | Chips, badges, inputs       |
| `radius-md`   | 12    | Product cards, images       |
| `radius-lg`   | 16    | Banners, category tiles     |
| `radius-xl`   | 24    | Bottom sheets (top corners) |
| `radius-full` | 999   | Cart bar, pills, avatar     |

Vary the radius by role. Don't put one radius on everything.

**Elevation**

| Token    | Style                         | Use                                                  |
| -------- | ----------------------------- | ---------------------------------------------------- |
| `elev-0` | none, 1px `line-300` border   | Product cards (flat grid reads cleaner than shadows) |
| `elev-1` | `0 2 8 rgba(20,32,30,0.08)`   | Sticky header after scroll                           |
| `elev-2` | `0 -4 16 rgba(20,32,30,0.12)` | Cart bar, bottom sheets                              |

---

## 7. Iconography & imagery

- **Icons:** Ionicons via `@expo/vector-icons` (ships with Expo Go; Lucide needs `react-native-svg`, which isn't installed), 24px, `ink-900`; active state `brand-600`. Never use emoji for UI chrome. Emoji are only a stand-in for product packshots until real images exist. Don't mix icon sets.
- **Product images:** square 1:1, white or transparent-background packshots, 8px internal padding on a `surface-100` tile. Provide `blurhash` placeholders. Serve WebP/AVIF at 2 sizes (list ≈ 240px, PDP ≈ 800px).
- **Category tiles:** one illustration or packshot per tile, same size, same crop.
- **Banners:** 16:7, max 5 in the carousel, auto-advance 5s, pause on touch.
- **Illustration style:** flat, two-tone (brand + accent), used only in empty states, onboarding and order status.

---

## 8. Components

### 8.1 Location + ETA header (home)

```
┌──────────────────────────────────────────┐
│ Delivery in                              │
│ 9 mins                        [ 👤 ]     │  display 28/800, brand-600
│ Sector 62, Noida  ▾                      │  body, ink-700
├──────────────────────────────────────────┤
│ 🔍  Search "milk"                    🎙  │  animated placeholder
└──────────────────────────────────────────┘
```

- The header sits on a `brand-700 → brand-600` gradient with white text and rounded bottom corners (`radius-xl`); the search pill is white with `elev-1`. This is the one place brand color is used as a surface, because it anchors the ETA promise. Banners are gradient heroes with a single `accent-500` CTA pill.
- ETA is the largest text on the screen. It updates live with store load and weather.
- Tapping the address opens an **address bottom sheet** (saved addresses, current location, map pin).
- Search bar: 48px tall, `radius-full`, `surface-100` fill, no border. The placeholder cycles through popular items every 2.5s ("milk", "bread", "eggs"). Respect Reduce Motion by showing a static placeholder.
- Header becomes sticky and collapses to the search bar plus a small ETA chip on scroll.

### 8.2 Home screen order (top to bottom)

1. Header (ETA, address, search)
2. **Buy again** (horizontal scroll, returning users only; hide for new users)
3. Banner carousel (offers)
4. Category grid (4 columns, 2 rows visible, "See all" opens the Categories tab)
5. Contextual rail by time of day (breakfast, snacks, late night)
6. Product rails by category (6–8 items each, "See all" at the end)
7. Footer brand line (keep it minimal)

Rule: **no more than two promotional blocks before the first product rail.**

### 8.3 Bottom navigation

Three tabs only: **Home · Categories · Cart**. Account lives in the header avatar. Cart tab shows an item-count badge. The tab bar is hidden on PDP, checkout and tracking.

### 8.4 Product card (the most important component)

```
┌────────────────┐
│ [-15%]      ♡  │   discount badge top-left, heart top-right
│                │
│    [image]     │   1:1, surface-100, radius-md
│                │
│  [ ADD ]       │   overlaps image bottom-right
├────────────────┤
│ ⏱ 9 mins       │   caption, ink-500 (omit if same as header ETA)
│ Amul Taaza Milk│   body-strong, max 2 lines
│ 500 ml         │   caption, ink-500
│ ₹29  ₹32       │   price + strikethrough MRP
└────────────────┘
```

**States**

| State             | Behavior                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Default           | `ADD` button: white fill, `brand-600` 1px border, `brand-600` text, radius-sm             |
| Added             | Becomes stepper: `brand-600` fill, white `−  1  +`, count animates                        |
| Multiple variants | Button reads `ADD` with a small "2 options" caption; tapping opens a variant bottom sheet |
| Max quantity      | `+` disabled, toast "Only 5 per order"                                                    |
| Low stock         | Caption "Only 2 left" in `warning-600` (only when stock ≤ 3, and **real**)                |
| Out of stock      | Image 50% opacity, button replaced by `Notify me`                                         |
| Loading           | Skeleton with shimmer (image block, 3 text lines)                                         |

**Behavior**

- Tapping ADD adds one unit immediately with light haptic feedback. **No modal, no navigation.**
- First add of a session triggers the cart bar to slide up (200ms).
- Tapping the card body opens PDP. Tapping the heart toggles wishlist with a toast ("Saved to favourites") and a visible "Favourites" entry in Account.
- Discount badge: `accent-500` fill, `accent-900` text, `micro` weight 600. Show only if discount ≥ 5%.

### 8.5 Floating cart bar

```
┌──────────────────────────────────────────┐
│ 🛒  3 items · ₹248          View cart  ›  │  brand-600 bg, white text
└──────────────────────────────────────────┘
```

- Fixed above the tab bar (or the safe area where no tab bar), `radius-full`, 12px horizontal margin, `elev-2`.
- Appears on Home, Listing, Search and PDP. Hidden on Cart, Checkout and Tracking.
- Shows a thin progress line for the free-delivery threshold: "Add ₹40 more for free delivery".
- Item count and price animate on change (number roll, 150ms).

### 8.6 Category tile

- 1:1 image tile (`surface-100`, radius-lg) with a label below, `caption` weight 600, max 2 lines, centered.
- Same size and crop for every tile. One image per tile.

### 8.7 Category listing screen

Two-pane layout:

```
┌───────┬──────────────────────────────┐
│ left  │  Sub-category chips ▸▸▸      │
│ rail  ├──────────────────────────────┤
│ (72px)│  product grid (3 col)        │
│ icons │                              │
└───────┴──────────────────────────────┘
```

- Left rail: sub-categories with icon and label; the active one has a `brand-600` bar on the left edge and a `brand-50` fill.
- Filter and sort in a sticky row above the grid (`Filters`, `Sort`, quick toggles such as `Under ₹99`).
- The rail scrolls independently of the grid.

### 8.8 Product detail page (PDP)

1. Image carousel with dots (swipe, pinch to zoom)
2. ETA chip, brand, name (`title`), pack size selector (chips if variants)
3. Price block (price, MRP, savings in `success-600`)
4. Sticky bottom bar: price on the left, `ADD` / stepper on the right
5. Collapsible sections: Details, Ingredients, Storage, Return policy, Seller info
6. "You might also need" rail
7. Cart bar remains visible; the sticky add bar sits **above** it only when the cart is empty, otherwise the cart bar is replaced by the add bar plus a "View cart" link

### 8.9 Search

- Opens a full-screen overlay with recent searches and trending chips.
- Results appear as you type (debounce 200ms), with typo tolerance, with sections for **Products** and **Categories**.
- Same product card and ADD button as everywhere, so users can add without leaving search.
- Empty results: "Nothing for 'xyz'. Try a shorter word or browse categories", plus a category grid.

### 8.10 Cart

- Header: "Cart" and delivery ETA.
- Savings banner at the top if applicable ("You're saving ₹54").
- Item rows: image 56px, name, pack size, price, stepper.
- **Contextual add-ons** rail ("Complete your order", max 3 items).
- Bill summary: item total, delivery fee, handling fee, discount, **grand total**. Every fee gets an info icon that explains it. If a surge fee applies, show a labeled row, not a hidden fee.
- Sticky bottom: address and delivery slot line, then `Proceed to pay · ₹248`.

### 8.11 Checkout (one screen)

1. Address (confirm or change)
2. Delivery instructions (optional chips: "Leave at door", "Don't ring bell")
3. Tip for the rider (optional chips ₹10/20/30/Custom, default none)
4. Payment methods: saved UPI first, then cards, wallets, COD
5. Sticky `Pay ₹248` button

Rules: login happens **here** (phone OTP, autofill, 6 digits) if not already signed in. Cart persists through login. No promo-code field visible by default; show "Have a code?" as a text link.

### 8.12 Order tracking

- Full-screen map (top 55%) with rider and destination, bottom sheet with status.
- Status steps: Order placed → Packing → On the way → Arrived.
- Big ETA in `display`. Rider name and a call button when "On the way".
- Items summary collapsed in the sheet. Support and Help always one tap away.

### 8.13 Buttons

| Type        | Style                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Primary     | `brand-600` fill, white text, radius-sm (12 for large), height 48, `subtitle` weight 700 |
| Secondary   | White fill, 1px `brand-600` border, `brand-600` text                                     |
| Tertiary    | Text only, `brand-600`                                                                   |
| Destructive | `danger-600` text on white, fill only in confirm dialogs                                 |
| Disabled    | `surface-100` fill, `ink-500` text                                                       |

Pressed state darkens to `brand-700`, 96% scale, 80ms.

### 8.14 Chips, badges, toasts, sheets

- **Chips:** 32px tall, radius-sm, `surface-100` default, `brand-100` fill and `brand-600` text when selected.
- **Toasts:** appear above the cart bar, 2.5s, swipe to dismiss, one at a time.
- **Bottom sheets:** radius-xl top corners, drag handle, scrim 40% black, max height 90%.

---

## 9. Motion

Motion answers an action. It does not decorate.

| Interaction     | Spec                                          |
| --------------- | --------------------------------------------- |
| ADD → stepper   | 120ms morph, light haptic                     |
| Cart bar in/out | 200ms slide-up, ease-out                      |
| Quantity change | Number roll 150ms                             |
| Tab switch      | Instant (no slide)                            |
| Bottom sheet    | 240ms spring (damping 0.85)                   |
| Skeletons       | Shimmer 1.2s loop, stops when content loads   |
| Order placed    | One confirmation moment: check draws in 400ms |

- Use `react-native-reanimated` on the UI thread. Keep everything at 60fps.
- Honor **Reduce Motion**: replace slides with fades, and remove shimmer and the placeholder animation.
- Seasonal moments (festival splash, theme toggle) are allowed, but must be skippable within 1 second and must never delay the home screen.

---

## 10. Content & tone

- Voice: plain, quick, friendly. Sentence case. Active verbs.
- Buttons name the outcome: `Add`, `Proceed to pay`, `Place order`. The same action keeps the same name everywhere.
- Errors say what happened and what to do, with no apology and no blame: "Payment didn't go through. Your money is safe. Try another method."
- Empty states invite an action: "Your cart is empty. Start with something from Buy again."
- Numbers: ₹ with Indian grouping (₹1,24,500), no decimals unless paise matter.
- Don't use fake urgency copy ("Hurry! Only a few left") unless the stock number is real.

---

## 11. States & edge cases checklist

Every screen must define: **loading, empty, error, offline, partial** states.

- **Outside serviceable area:** friendly map screen with "Notify me when we launch here".
- **Store closed / high demand:** ETA shows a range with a reason ("Heavy rain, ~25 mins").
- **Item went out of stock in cart:** inline warning on the row, with a "Remove" and "Find similar" action. Don't block the whole checkout.
- **Price changed:** show the delta and require one confirmation tap.
- **Offline:** cached home and cart readable, ADD disabled with a banner.
- **Slow network:** skeletons first, never a blank screen or full-page spinner.

---

## 12. Accessibility

- WCAG 2.2 AA minimum.
- Every icon button has an `accessibilityLabel`. Product cards read as: "Amul Taaza Milk, 500 millilitres, 29 rupees, 9 percent off, add to cart".
- Stepper announces the new quantity on change.
- Support screen readers (TalkBack, VoiceOver) with a logical focus order: header, search, content, cart bar.
- Respect system font scale, Reduce Motion, Bold Text, and High Contrast.
- Touch targets ≥ 44px; spacing between adjacent targets ≥ 8px.

---

## 13. Performance budget (design-relevant)

- Home screen interactive in < 2s on a mid-range Android on 4G.
- Product list uses `FlashList`, windowed, with a fixed item height where possible.
- Images lazy-load with blurhash; list images ≤ 25KB.
- Skeletons render in the first frame.
- Cart bar and ADD respond in < 100ms, **optimistic update first, sync second**.

---

## 14. Implementation notes (React Native / Expo)

**Token file** (`theme/tokens.ts`): the only place hex values live.

```ts
export const colors = {
  brand: {
    50: "#F1FCF5",
    100: "#DCF7E6",
    200: "#B2EBC7",
    500: "#5BD686",
    600: "#42C86E",
    700: "#238A47",
    900: "#0C3D1D",
  },
  accent: { 100: "#FFF3CC", 500: "#FFB400", 900: "#5C4000" },
  ink: { 900: "#14201E", 700: "#3B4A47", 500: "#6B7A77" },
  line: { 300: "#DDE5E3" },
  surface: { 0: "#FFFFFF", 100: "#F3F6F5" },
  success: "#15803D",
  warning: "#B45309",
  danger: "#C62828",
  info: "#1D6FD8",
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontFamily: "PlusJakartaSans_800ExtraBold" },
  titleLg: { fontSize: 22, lineHeight: 28, fontFamily: "PlusJakartaSans_700Bold" },
  title: { fontSize: 18, lineHeight: 24, fontFamily: "PlusJakartaSans_700Bold" },
  subtitle: { fontSize: 16, lineHeight: 22, fontFamily: "PlusJakartaSans_600SemiBold" },
  body: { fontSize: 14, lineHeight: 20, fontFamily: "PlusJakartaSans_400Regular" },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontFamily: "PlusJakartaSans_600SemiBold" },
  price: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "PlusJakartaSans_700Bold",
    fontVariant: ["tabular-nums"],
  },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: "PlusJakartaSans_500Medium" },
  micro: { fontSize: 10, lineHeight: 12, fontFamily: "PlusJakartaSans_600SemiBold" },
};
```

**Rebranding later:** change only `colors.brand` and `colors.accent`. Check contrast of `brand.600` against white (≥ 4.5:1) and keep the role mapping: 600 = primary, 100 = tint, 700 = pressed.

**Suggested libraries:** `expo-font`, `@expo-google-fonts/plus-jakarta-sans`, `react-native-reanimated`, `@shopify/flash-list`, `expo-image` (with blurhash), `@gorhom/bottom-sheet`, `lucide-react-native`, `expo-haptics`.

**Component build order:** tokens → Button → Chip → ProductCard (all states) → CartBar → Header/Search → CategoryTile → BottomSheet → Cart rows → Checkout → Tracking.

---

## 15. Related surfaces (out of scope for this file)

- **Rider app:** reuse tokens; high-contrast, large buttons, one-handed use, swipe-to-confirm for pickup and drop.
- **Warehouse web (picker/packer):** dense tables, barcode-scan-first, status colors only.
- **Admin web:** Next.js dashboard using the same tokens, neutral-heavy, `brand` only for primary actions.

Each can get its own design.md section later; keep the token file shared.

---

## 16. Open decisions

- [ ] Final brand name and logo (the palette follows)
- [ ] Final brand color (swap `colors.brand` and `colors.accent`)
- [ ] Hindi / regional language support in v1 or v1.1
- [ ] Dark mode in v1 or v1.1
- [ ] Mascot or illustration direction (optional)
- [ ] Subscription / membership surface (header badge and checkout placement)
