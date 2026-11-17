/**
 * The plan grows with you. It holds only what you've decided is set, and leaves the rest
 * of life (dinner, family, the unexpected) alone. One thing is added at a time, and only
 * after you've held the standard for a week.
 */
import { hm } from "./time";
import type { TemplateBlock } from "./types";

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export interface Phase {
  n: number;
  name: string;
  line: string;
  /** What this phase adds, in words. */
  adds: string;
}

export const PHASES: Phase[] = [
  { n: 1, name: "Foundation", line: "Push-ups in the morning, a cold shower, reading at 8.", adds: "Push-ups, cold shower, reading" },
  { n: 2, name: "Sales rep", line: "Add one sales script rep, any time in the evening.", adds: "Sales script rep, 15 min, any time 5–8pm" },
  { n: 3, name: "Writing", line: "Add 15 minutes of writing in the evening.", adds: "Writing, 15 min, any time 5–8pm" },
  { n: 4, name: "Speaking", line: "Add 15 minutes of speaking practice. The full skills set.", adds: "Speaking, 15 min, any time 5–8pm" },
];

/** Hold the standard on at least this many of the last 7 days to be offered the next phase. */
export const ADVANCE_AFTER = 5;

/** An evening skill block: any time from 5 to 8pm, never "late" inside that window. */
const evening = (id: string, title: string, subtitle: string, checklist: string[]): TemplateBlock => ({
  id,
  title,
  subtitle,
  category: "skill",
  days: WEEKDAYS,
  start: hm(17, 0),
  duration: 15,
  minDuration: 15,
  until: hm(20, 0),
  anytime: true,
  type: "flexible",
  priority: 4,
  checklist,
});

export function programTemplate(phase: number, _familyNight = 6): TemplateBlock[] {
  const p = Math.max(1, Math.min(PHASES.length, phase));
  const t: TemplateBlock[] = [
    {
      id: "pushups",
      title: "Push-ups",
      subtitle: "20 reps",
      category: "body",
      days: EVERY_DAY,
      start: hm(5, 0),
      duration: 15,
      minDuration: 15,
      until: hm(6, 0),
      anytime: true,
      type: "flexible",
      priority: 4,
    },
    {
      id: "cold-shower",
      title: "Cold shower",
      subtitle: "Any time after work",
      category: "body",
      days: WEEKDAYS,
      start: hm(17, 0),
      duration: 15,
      minDuration: 15,
      until: hm(21, 0),
      anytime: true,
      type: "flexible",
      priority: 4,
    },
    {
      id: "cold-shower-weekend",
      title: "Cold shower",
      subtitle: "Any time today",
      category: "body",
      days: WEEKEND,
      start: hm(7, 0),
      duration: 15,
      minDuration: 15,
      until: hm(21, 0),
      anytime: true,
      type: "flexible",
      priority: 4,
    },
    {
      id: "reading",
      title: "Reading",
      subtitle: "30 minute cap",
      category: "reading",
      days: EVERY_DAY,
      start: hm(20, 0),
      duration: 30,
      minDuration: 15,
      type: "flexible",
      priority: 5,
      checklist: ["Stopped at the cap", "Named the one big idea", "Named how to use it"],
    },
  ];
  if (p >= 2) t.push(evening("script", "Sales script rep", "One run, out loud", ["Ran it out loud", "Tightened one line"]));
  if (p >= 3) t.push(evening("writing", "Writing", "Headline, problem, turn", ["Used a headline", "Named the problem", "Wrote the turn"]));
  if (p >= 4) t.push(evening("speaking", "Speaking", "Record it. Listen back.", ["Recorded it", "Listened back", "Picked one thing to fix"]));
  return t;
}

/** Your own blocks (added with + Add, weekly) survive a change of phase. */
export const isCustom = (id: string) => id.startsWith("tpl-");
