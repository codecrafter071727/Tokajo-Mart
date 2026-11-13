# 0010. Dark text on the brand green

Status: accepted, November 2026

## Context

The brand green is #42C86E. White text on it has a contrast ratio of about 2.2:1, below the 4.5:1
needed for readable text. A darker green would fix contrast but move away from the brand colour.

## Decision

Keep #42C86E exactly as the fill and put dark ink (#14201E, about 7.7:1) on it for text and icons,
through an `onBrand` token in the customer and rider app themes. Green text on white uses the
darker `brandText` (#238A47). Decorative green (progress bars, dots) is unchanged.

## Consequences

- Buttons and bars meet contrast requirements and keep the brand colour.
- The apps look slightly different from Blinkit's white on dark green, by choice.
- New components must use the tokens, never white on #42C86E.
