/**
 * Handling for a row of single digit OTP boxes. Pure, so the tricky cases (a pasted code, an SMS
 * autofill that delivers every digit at once, letters, deleting) are tested without a screen.
 */

export type OtpChange = {
  /** The new contents of the boxes */
  digits: string[];
  /** True when every box is filled */
  complete: boolean;
  /** The box that should have the cursor next */
  focusIndex: number;
};

export function applyOtpInput(current: string[], value: string, index: number): OtpChange {
  const length = current.length;
  const typed = value.replace(/\D/g, "");

  // Several digits at once: a paste or an SMS autofill. Spread them from the first box.
  if (typed.length > 1) {
    const digits = Array.from({ length }, (_, i) => typed[i] ?? "");
    const complete = digits.every((d) => d !== "");
    return { digits, complete, focusIndex: Math.min(typed.length, length - 1) };
  }

  // One digit, or the box was cleared (or a non digit was typed, which clears it)
  const digits = [...current];
  digits[index] = typed;
  const complete = digits.every((d) => d !== "");
  const focusIndex = typed !== "" ? Math.min(index + 1, length - 1) : index;
  return { digits, complete, focusIndex };
}
