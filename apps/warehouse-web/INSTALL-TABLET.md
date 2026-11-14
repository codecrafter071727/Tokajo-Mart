# Install Milcki Warehouse on an Android tablet

The warehouse app is a web app that installs like a normal app: full screen, its own icon, no
browser bar. It needs the production site on HTTPS (installing does not work from a local dev
server).

1. On the tablet, open **Chrome** and go to the warehouse site address.
2. Sign in with your warehouse email and password.
3. Tap the **three dots** menu at the top right, then **Install app** (on older Chrome it says
   **Add to Home screen**, then **Install**).
4. Confirm. **Milcki Warehouse** appears on the home screen and in the app drawer.
5. Open it from the icon. It starts full screen in landscape.

## New order sound

- The bell icon in the top bar turns the new order chime on or off. The choice is kept on the
  tablet.
- Browsers only allow sound after the screen has been touched once. If a black **Tap to turn on new
  order sounds** button shows at the bottom, tap it once at the start of a shift.
- Keep the tablet volume up and turn off Do Not Disturb, or the chime is silent.
- The tab title also blinks with the number of new orders, and a green banner names them.

## Keep the screen on

In Android **Settings**, raise **Screen timeout** to the maximum, or use the tablet's "stay awake
while charging" developer option on a dock, so the queue stays visible.

## Updating

The app updates itself: open it while online and the newest version loads. Nothing to reinstall.

## What works offline

Nothing that matters: orders, stock and handover codes are always live. Without a connection the
app shows a "No connection" screen with a Try again button.

## Regenerating the icons

The icons in `public/icons` are drawn by `node scripts/make-icons.mjs` (no image tools needed).
