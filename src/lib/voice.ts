/**
 * Tone: tough on the next action, kind about the past.
 * Short sentences. No fluff. Misses are data, never shame.
 */

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(Math.floor(seed)) % arr.length];

export const voice = {
  greeting(hour: number, seed: number) {
    if (hour < 5) return pick(["You're up before the excuses.", "Dark outside. Clear head. Go."], seed);
    if (hour < 12) return pick(["Nobody is coming to save you.", "Win the morning. Own the day.", "The plan doesn't care how you feel."], seed);
    if (hour < 17) return pick(["Do the work. Then go home and do the work.", "Stay on the plan.", "You said you'd do it. Prove it."], seed);
    if (hour < 21) return pick(["This is where it counts.", "Evening shift. Clock in.", "Start the timer. Feelings can come along."], seed);
    return pick(["Lights out. Tomorrow you go again.", "Rest is part of the work."], seed);
  },

  allDone: ["Every box ticked. That's who you are now.", "Done. All of it. Remember this feeling.", "Clean sweep. Go to bed proud."],
  nothingPlanned: "Nothing on the board today. Rest is part of the work.",

  checkIn: {
    title: "Quick check-in",
    sub: "Ten seconds. Every question is optional.",
    resistance: { q: "How loud was the excuse in your head?", lo: "Silence", hi: "Deafening" },
    energy: { q: "What was in the tank?", lo: "Fumes", hi: "Full" },
    start: { q: "How hard was it to get moving?", lo: "Just started", hi: "Dragged myself" },
  },

  stayedHard: { title: "Stayed hard", line: "The mind quit first. You didn't." },

  timer: {
    ready: "No one is coming to save you. Start the timer.",
    running: ["Stay in it.", "Callous your mind.", "Hard is the point.", "Nobody's watching. Do it anyway."],
    half: "Halfway. Don't you dare coast.",
    twoMin: "Two minutes. Finish strong.",
    ended: "Time. Be honest.",
    ask: "Did you complete it?",
  },

  skip: {
    title: "Why are you skipping?",
    sub: "Honest answer. Misses are data, not a verdict.",
  },

  missed: "Not done. It counts as zero. Tomorrow it counts again.",
  restPass: {
    title: "Use your rest pass?",
    sub: "Life happens. One a week keeps the chain alive. Say why.",
  },
} as const;

export const SKIP_OPTIONS = [
  { id: "event", label: "Had an event on", group: "excused" },
  { id: "obstacle", label: "Real obstacle", hint: "Sickness, emergency", group: "excused" },
  { id: "energy", label: "Low energy", group: "miss" },
  { id: "distracted", label: "Got distracted", group: "miss" },
  { id: "chose-else", label: "Chose something else", group: "miss" },
] as const;
