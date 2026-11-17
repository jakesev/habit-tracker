import { describe, expect, it } from "vitest";
import { blockToEvent, eventId, eventToBusyBlock, mergeBusy } from "./gcal-map";
import type { DayBlock } from "./types";

const block = (p: Partial<DayBlock> = {}): DayBlock => ({
  id: "writing-abc",
  templateId: "writing",
  title: "Writing",
  category: "skill",
  type: "flexible",
  priority: 5,
  start: 18 * 60 + 15,
  duration: 30,
  minDuration: 15,
  status: "planned",
  reminderLead: 10,
  ...p,
});

describe("event ids", () => {
  it("are valid Google ids and stable per date + block", () => {
    const id = eventId("2026-11-17", "writing-abc");
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(eventId("2026-11-17", "writing-abc")).toBe(id);
    expect(eventId("2026-11-18", "writing-abc")).not.toBe(id);
  });
});

describe("blocks → Google events", () => {
  it("writes local times with the time zone and tags the event as ours", () => {
    const e = blockToEvent("2026-11-17", block(), "Australia/Brisbane");
    expect(e.start).toEqual({ dateTime: "2026-11-17T18:15:00", timeZone: "Australia/Brisbane" });
    expect(e.end?.dateTime).toBe("2026-11-17T18:45:00");
    expect(e.extendedProperties?.private?.app).toBe("shugyo");
  });
  it("marks done blocks with a tick", () => {
    expect(blockToEvent("2026-11-17", block({ status: "done", focusedMinutes: 30 }), "UTC").summary).toBe("✓ Writing");
  });
});

describe("Google events → busy blocks", () => {
  const ev = (start: string, end: string, extra = {}) => ({ id: "x1", summary: "Dentist", start: { dateTime: start }, end: { dateTime: end }, ...extra });

  it("snaps outward to the 15-minute grid", () => {
    const b = eventToBusyBlock("2026-11-17", ev("2026-11-17T15:10:00", "2026-11-17T15:50:00"))!;
    expect(b.start).toBe(15 * 60);
    expect(b.duration).toBe(60);
    expect(b.category).toBe("event");
    expect(b.templateId).toBe("gcal");
  });

  it("skips all-day, free, declined and our own events", () => {
    expect(eventToBusyBlock("2026-11-17", { id: "a", start: { date: "2026-11-17" }, end: { date: "2026-11-18" } })).toBeNull();
    expect(eventToBusyBlock("2026-11-17", ev("2026-11-17T09:00:00", "2026-11-17T10:00:00", { transparency: "transparent" }))).toBeNull();
    expect(eventToBusyBlock("2026-11-17", ev("2026-11-17T09:00:00", "2026-11-17T10:00:00", { attendees: [{ self: true, responseStatus: "declined" }] }))).toBeNull();
    expect(eventToBusyBlock("2026-11-17", ev("2026-11-17T09:00:00", "2026-11-17T10:00:00", { extendedProperties: { private: { app: "shugyo" } } }))).toBeNull();
  });

  it("replaces only the Google busy blocks on a re-read", () => {
    const old = eventToBusyBlock("2026-11-17", ev("2026-11-17T09:00:00", "2026-11-17T10:00:00"))!;
    const fresh = { ...old, id: "gcal-new", start: 11 * 60 };
    const merged = mergeBusy([block(), old], [fresh]);
    expect(merged.map((b) => b.id)).toEqual(["gcal-new", "writing-abc"]);
  });
});
