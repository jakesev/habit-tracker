/**
 * The plan grows with you. Start with what you already do, then add one thing at a time,
 * only after you've held the standard for a week.
 */
import { hm } from "./time";
import type { TemplateBlock } from "./types";

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export interface Phase {
  n: number;
  name: string;
  line: string;
  /** What this phase adds, in words. */
  adds: string;
}

export const PHASES: Phase[] = [
  { n: 1, name: "Warm-up", line: "What you already do, on a clock. Push-ups, cold shower, a script rep, reading.", adds: "Push-ups, cold shower, sales script rep, reading" },
  { n: 2, name: "Build", line: "Add a short writing block before dinner and a Saturday script session.", adds: "Writing 15 min · Saturday script rehearsal" },
  { n: 3, name: "Strong", line: "The full skills block: writing 30, speaking, and a reading summary.", adds: "Writing 30 min · Speaking 15 min · Reading summary · Meal prep" },
];

/** Hold the standard on at least this many of the last 7 days to be offered the next phase. */
export const ADVANCE_AFTER = 5;

export function programTemplate(phase: number, familyNight = 6): TemplateBlock[] {
  const p = Math.max(1, Math.min(PHASES.length, phase));
  const t: TemplateBlock[] = [
    {
      id: "pushups",
      title: "Push-ups",
      subtitle: "20 reps. Wake the body up.",
      category: "body",
      days: EVERY_DAY,
      start: hm(5, 0),
      duration: 15,
      minDuration: 15,
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
      id: "dinner",
      title: "Dinner",
      subtitle: "Busy time. Not scored.",
      category: "event",
      days: WEEKDAYS,
      start: hm(18, 30),
      duration: 45,
      minDuration: 45,
      type: "fixed",
      priority: 3,
    },
    {
      id: "script",
      title: "Sales script rep",
      subtitle: "One run, out loud",
      category: "skill",
      days: WEEKDAYS,
      start: hm(19, 15),
      duration: 15,
      minDuration: 15,
      type: "flexible",
      priority: 4,
      checklist: ["Ran it out loud", "Tightened one line"],
    },
    {
      id: "dogs",
      title: "Dogs out, lock up",
      category: "anchor",
      days: EVERY_DAY,
      start: hm(19, 45),
      duration: 15,
      minDuration: 15,
      type: "fixed",
      priority: 5,
      alarm: true,
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
    {
      id: "winddown",
      title: "Wind down",
      subtitle: "Bed by 9",
      category: "anchor",
      days: EVERY_DAY,
      start: hm(20, 45),
      duration: 15,
      minDuration: 15,
      type: "fixed",
      priority: 3,
      alarm: true,
    },
    {
      id: "family-night",
      title: "Family night",
      subtitle: "The proper one this week",
      category: "family",
      days: [familyNight],
      start: hm(17, 0),
      duration: 120,
      minDuration: 60,
      type: "protected",
      priority: 5,
    },
    {
      id: "weekly-review",
      title: "Weekly review",
      subtitle: "Strength, weakness, one change",
      category: "anchor",
      days: [0],
      start: hm(16, 0),
      duration: 15,
      minDuration: 15,
      type: "fixed",
      priority: 4,
      checklist: ["Named my biggest strength", "Named my biggest weakness", "Picked one change"],
    },
  ];

  if (p >= 2) {
    t.push(
      {
        id: "writing",
        title: "Writing",
        subtitle: "Headline, problem, turn",
        category: "skill",
        days: WEEKDAYS,
        start: p >= 3 ? hm(18, 0) : hm(18, 15),
        duration: p >= 3 ? 30 : 15,
        minDuration: 15,
        type: "flexible",
        priority: 5,
        checklist: ["Used a headline", "Named the problem", "Wrote the turn", "Edited once"],
      },
      {
        id: "sat-script",
        title: "Script rehearsal",
        subtitle: "Then go knock doors",
        category: "skill",
        days: [6],
        start: hm(9, 0),
        duration: p >= 3 ? 90 : 60,
        minDuration: 30,
        type: "droppable",
        priority: 4,
        checklist: ["Full run-through", "Handled 3 objections", "Recorded one take"],
      },
    );
  }
  if (p >= 3) {
    t.push(
      {
        id: "speaking",
        title: "Speaking",
        subtitle: "Record it. Listen back.",
        category: "skill",
        days: WEEKDAYS,
        start: hm(19, 30),
        duration: 15,
        minDuration: 15,
        type: "flexible",
        priority: 5,
        checklist: ["Recorded it", "Listened back", "Picked one thing to fix"],
      },
      {
        id: "summary",
        title: "Reading summary",
        subtitle: "Write it, then say it",
        category: "reading",
        days: WEEKDAYS,
        start: hm(20, 30),
        duration: 15,
        minDuration: 15,
        type: "flexible",
        priority: 3,
      },
      {
        id: "meal-prep",
        title: "Meal prep",
        subtitle: "Cook once, eat all week",
        category: "chore",
        days: [0],
        start: hm(14, 0),
        duration: 120,
        minDuration: 60,
        type: "flexible",
        priority: 3,
      },
    );
  }
  return t;
}

/** Your own blocks (added with + Add, weekly) survive a change of phase. */
export const isCustom = (id: string) => id.startsWith("tpl-");
