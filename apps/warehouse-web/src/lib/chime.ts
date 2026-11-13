/**
 * New order alerts for the packing floor: which orders are new since the last look, a short chime
 * made with the Web Audio API (no sound files), and the saved on or off choice.
 */

export const SOUND_KEY = "qc-wh-sound";

/** Sound is on unless someone turned it off on this device. */
export function soundEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSoundEnabled(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Blocked storage: the choice lasts until the page reloads
  }
}

/**
 * Orders that are confirmed now and were not in the queue last time. The first look only records
 * what is there (`known` is null), so opening the page never chimes for the existing backlog.
 */
export function findNewOrders(
  known: ReadonlySet<string> | null,
  items: readonly { id: string; status: string }[],
): { fresh: string[]; known: Set<string> } {
  const next = new Set(items.map((o) => o.id));
  if (known === null) return { fresh: [], known: next };
  const fresh = items.filter((o) => o.status === "confirmed" && !known.has(o.id)).map((o) => o.id);
  return { fresh, known: next };
}

type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor: AudioCtor | undefined =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** Browsers keep audio off until the page is touched. True once sound can play. */
export function audioReady(): boolean {
  return context?.state === "running";
}

/** Call from a click or key press: it unlocks audio for the rest of the visit. */
export async function unlockAudio(): Promise<boolean> {
  const ctx = audioContext();
  if (!ctx) return false;
  try {
    if (ctx.state !== "running") await ctx.resume();
  } catch {
    return false;
  }
  return ctx.state === "running";
}

/**
 * A bright two note chime (E6 then A6, like a counter bell), about half a second, soft attack so it
 * never clicks. Plays twice for two or more new orders. Silent if audio is still locked.
 */
export function playChime(times = 1): boolean {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return false;
  const notes = [1318.5, 1760];
  const start = ctx.currentTime + 0.02;
  for (let r = 0; r < Math.min(times, 2); r += 1) {
    notes.forEach((freq, i) => {
      const at = start + r * 0.7 + i * 0.16;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      overtone.type = "sine";
      osc.frequency.setValueAtTime(freq, at);
      overtone.frequency.setValueAtTime(freq * 2, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.32, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
      const soft = ctx.createGain();
      soft.gain.value = 0.18;
      osc.connect(gain);
      overtone.connect(soft).connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      overtone.start(at);
      osc.stop(at + 0.6);
      overtone.stop(at + 0.6);
    });
  }
  return true;
}
