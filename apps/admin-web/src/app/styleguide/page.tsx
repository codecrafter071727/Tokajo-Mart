import { Gallery } from "./gallery";

export const metadata = { title: "Style guide", robots: { index: false } };

/**
 * Every building block of the console on sample data, in the light and the dark theme side by
 * side. Behind the admin sign in like every page. Use it to check a change and to pick the right
 * component before building a screen.
 */
export default function StyleGuidePage() {
  return <Gallery />;
}
