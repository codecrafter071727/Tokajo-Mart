import { describe, expect, it } from "vitest";
import { applyOtpInput } from "../src/lib/otp";

const empty = ["", "", "", ""];

describe("applyOtpInput", () => {
  it("fills one box and moves on to the next", () => {
    expect(applyOtpInput(empty, "1", 0)).toEqual({
      digits: ["1", "", "", ""],
      complete: false,
      focusIndex: 1,
    });
  });

  it("completes on the last digit and keeps the cursor on the last box", () => {
    expect(applyOtpInput(["1", "2", "3", ""], "4", 3)).toEqual({
      digits: ["1", "2", "3", "4"],
      complete: true,
      focusIndex: 3,
    });
  });

  it("spreads a pasted or autofilled code across every box", () => {
    expect(applyOtpInput(empty, "1234", 0)).toEqual({
      digits: ["1", "2", "3", "4"],
      complete: true,
      focusIndex: 3,
    });
  });

  it("handles a code with spaces or dashes, as in '12 34' or '1-2-3-4'", () => {
    expect(applyOtpInput(empty, "12 34", 0).digits).toEqual(["1", "2", "3", "4"]);
    expect(applyOtpInput(empty, "1-2-3-4", 0).digits).toEqual(["1", "2", "3", "4"]);
  });

  it("ignores digits beyond the length", () => {
    expect(applyOtpInput(empty, "123456", 0).digits).toEqual(["1", "2", "3", "4"]);
  });

  it("fills a partial paste and puts the cursor after it", () => {
    expect(applyOtpInput(empty, "12", 0)).toEqual({
      digits: ["1", "2", "", ""],
      complete: false,
      focusIndex: 2,
    });
  });

  it("treats a letter as clearing the box, never storing it", () => {
    expect(applyOtpInput(["1", "", "", ""], "x", 0)).toEqual({
      digits: ["", "", "", ""],
      complete: false,
      focusIndex: 0,
    });
  });

  it("clears a box on delete without moving forward", () => {
    expect(applyOtpInput(["1", "2", "", ""], "", 1)).toEqual({
      digits: ["1", "", "", ""],
      complete: false,
      focusIndex: 1,
    });
  });

  it("does not mutate the array it was given", () => {
    const current = ["1", "", "", ""];
    applyOtpInput(current, "2", 1);
    expect(current).toEqual(["1", "", "", ""]);
  });
});
