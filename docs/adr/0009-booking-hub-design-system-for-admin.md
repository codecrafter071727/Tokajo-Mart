# 0009. Admin web uses the Booking Hub design system

Status: accepted, November 2026

## Context

The admin console had grown page by page with mixed styles. We already had a polished admin in
another project (Booking Hub) whose look the team wanted for the control room of the platform.

## Decision

Admin web adopts Booking Hub's tokens (oklch light and dark themes), fonts (DM Sans and JetBrains
Mono), collapsible sidebar and top bar, and component kit (cards, stats, badges, tables, dialogs,
filters, skeletons, charts). The site switcher becomes a warehouse switcher stored in a cookie.
Icons are drawn inline and charts use the recharts version already in the repo instead of adding
packages. Warehouse web keeps its own tablet first layout with matching tokens.

## Consequences

- One consistent look across every admin page, documented at `/styleguide`.
- New admin pages use `src/components/ui/*` rather than one off styles.
- Booking Hub itself stays outside this repository (it is gitignored here).
