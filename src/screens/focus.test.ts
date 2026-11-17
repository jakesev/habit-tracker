import { describe, expect, it } from "vitest";
import { defaultFocusMinutes } from "./Focus";
import { hm } from "../lib/time";

describe("focus timer default", () => {
  it("on time: block length minus the break", () => {
    expect(defaultFocusMinutes(hm(18, 15), 30, hm(18, 14), 5, true)).toBe(25);
    expect(defaultFocusMinutes(hm(18, 15), 30, hm(18, 14), 0, true)).toBe(30);
  });
  it("started late: what's left of the block, minus the break", () => {
    expect(defaultFocusMinutes(hm(18, 15), 30, hm(18, 25), 0, true)).toBe(20);
    expect(defaultFocusMinutes(hm(18, 15), 30, hm(18, 25), 5, true)).toBe(15);
  });
  it("past the block entirely: falls back to its full length", () => {
    expect(defaultFocusMinutes(hm(18, 15), 30, hm(19, 30), 5, true)).toBe(25);
  });
  it("short blocks keep their length rather than going under 10 minutes", () => {
    expect(defaultFocusMinutes(hm(18, 45), 15, hm(18, 44), 10, true)).toBe(15);
  });
});
