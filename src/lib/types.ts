/** Minutes since midnight, always on the 15-minute grid. */
export type Min = number;

/** ISO date, local time: "2026-11-17". */
export type DateKey = string;

/** "event" = something on your calendar (dentist, client). Busy time, not a habit: no tick, no score. */
export type Category = "skill" | "reading" | "family" | "chore" | "anchor" | "event";

/** How the re-planner (Phase 2) is allowed to treat a block. */
export type BlockType = "fixed" | "flexible" | "droppable" | "protected";

export type BlockStatus =
  | "planned" // not done yet, window still open
  | "done"
  | "partial" // timer ended with "partly done"
  | "skipped" // user tapped Skip and gave a reason
  | "missed"; // window closed without a tick: auto Not done

export type SkipReason =
  | "event" // excused
  | "obstacle" // excused: sickness, emergency
  | "energy" // real miss
  | "distracted" // real miss
  | "chose-else"; // real miss

export const EXCUSED_REASONS: SkipReason[] = ["event", "obstacle"];

export interface TemplateBlock {
  id: string;
  title: string;
  subtitle?: string;
  category: Category;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  start: Min;
  duration: Min;
  minDuration: Min;
  type: BlockType;
  priority: 1 | 2 | 3 | 4 | 5;
  checklist?: string[];
  /** Placed the moment you get home (shower, dinner), in template order. */
  homeAnchor?: boolean;
}

export interface Correction {
  at: number; // epoch ms
  field: string;
  from: unknown;
  to: unknown;
}

export interface DayBlock {
  id: string;
  templateId: string;
  title: string;
  subtitle?: string;
  category: Category;
  type: BlockType;
  priority: number;
  start: Min;
  duration: Min;
  minDuration: Min;
  checklist?: string[];
  homeAnchor?: boolean;
  /** The template's time and length, kept when a re-plan moves or shrinks the block. */
  origStart?: Min;
  origDuration?: Min;
  /** Dropped by a re-plan (no time left). Excused, shown apart from the timeline. */
  dropped?: boolean;

  status: BlockStatus;
  note?: string;
  skipReason?: SkipReason;
  excused?: boolean;

  /** "How loud was the excuse?" 1 silence … 10 deafening */
  resistance?: number | null;
  /** "What was in the tank?" 1 fumes … 10 fully charged */
  energy?: number | null;
  /** "How hard was it to get moving?" 1 just started … 10 dragged myself */
  startDifficulty?: number | null;
  didItAnyway?: boolean;

  reminderLead: number;
  checklistDone?: number[];

  actualStart?: number;
  focusedMinutes?: number;
  timerCompleted?: boolean;
  completedAt?: number;
  corrections?: Correction[];
}

export interface RestPass {
  reason: string;
  at: number;
}

export interface Day {
  date: DateKey;
  blocks: DayBlock[];
  restPass?: RestPass;
  /** When you tapped "I'm home", and the plan before it, for undo. */
  homeAt?: Min;
  beforeHome?: DayBlock[];
  /** Share of the plan (%) this day needed to count. Set from your level when the day began, then frozen. */
  standard?: number;
}

export type QuestionTiming = "after" | "before";

export interface Settings {
  /** Fallback standard for days saved before standards were per-day. Not user-set. */
  streakThreshold: number;
  /** Unused since rest passes follow your level; kept so old backups load. */
  restPassesPerWeek: number;
  defaultReminderLead: number; // minutes
  questionTiming: QuestionTiming;
  haptics: boolean;
  sound: boolean;
  notifications: boolean;
  familyNight: number; // weekday for the weekly family block
  identity: "shugyo" | "vow";
  /** Usual time home from work (minutes), and bed time. */
  homeTime: number;
  bedTime: number;
}

/** A running (or paused) focus session. Stored as timestamps so it survives reloads. */
export interface FocusSession {
  date: DateKey;
  blockId: string;
  totalMs: number;
  startedAt: number; // first start
  /** When running: epoch ms the countdown hits zero. */
  endsAt: number | null;
  /** When paused: ms left. */
  pausedRemaining: number | null;
  buzzedHalf?: boolean;
  buzzedTwo?: boolean;
  alarmed?: boolean;
}
