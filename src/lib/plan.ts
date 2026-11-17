import { STEP } from "./time";
import type { DayBlock, Min } from "./types";

export type ChangeKind = "moved" | "shrunk" | "moved+shrunk" | "dropped" | "same";

export interface Change {
  id: string;
  title: string;
  kind: ChangeKind;
  from: { start: Min; duration: Min };
  to?: { start: Min; duration: Min };
}

export interface PlanResult {
  homeAt: Min;
  blocks: DayBlock[];
  changes: Change[];
  /** Plain-English one-liner for the top of the proposal. */
  summary: string;
}

/** Snap an arrival time to the 15-minute grid: down if within 5 minutes of a quarter, otherwise up. */
export function snapArrival(m: number): Min {
  const over = m % STEP;
  return over <= 5 ? m - over : m - over + STEP;
}

const target = (b: DayBlock) => b.origDuration ?? b.duration;
const origin = (b: DayBlock) => b.origStart ?? b.start;
const isOpen = (b: DayBlock) => b.status === "planned" || (b.status === "missed" && !b.skipReason);

/**
 * "I'm home" re-plan. Pure: same input, same plan.
 *
 * 1. Fixed blocks (dogs, wind down) never move.
 * 2. Home anchors (shower, dinner) go first, right when you walk in.
 * 3. Everything else keeps its order. If the evening is too short, flexible blocks shrink
 *    15 minutes at a time (lowest priority first, never below their minimum), then the
 *    lowest-priority blocks drop out. Protected blocks (family) are never cut by the app.
 * 4. Blocks keep their original time when there's room, so getting home early
 *    doesn't drag the whole evening forward.
 */
export function planHome(blocks: DayBlock[], arrival: Min, opts: { usualHome: Min; bedTime: Min }): PlanResult {
  const H = snapArrival(arrival);
  const evening = (b: DayBlock) => b.homeAnchor || origin(b) + target(b) > opts.usualHome;

  const candidates = blocks.filter((b) => isOpen(b) && evening(b));
  const fixed = candidates.filter((b) => b.type === "fixed" && !b.homeAnchor && origin(b) >= H);
  const movable = candidates.filter((b) => !(b.type === "fixed" && !b.homeAnchor));
  // Fixed blocks already behind us stay as they are (auto-miss handles them).

  // Free gaps from arrival to bed, around fixed blocks.
  const busy = fixed.map((b) => [origin(b), origin(b) + target(b)] as const).sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let c = H;
  for (const [s, e] of busy) {
    if (s > c) gaps.push([c, Math.min(s, opts.bedTime)]);
    c = Math.max(c, e);
  }
  if (c < opts.bedTime) gaps.push([c, opts.bedTime]);
  const capacity = gaps.reduce((a, [s, e]) => a + Math.max(0, e - s), 0);

  // Order: home anchors first (template order), then the rest by original time.
  const order = [...movable].sort((a, b) => {
    if (!!a.homeAnchor !== !!b.homeAnchor) return a.homeAnchor ? -1 : 1;
    return origin(a) - origin(b);
  });

  const dur = new Map(order.map((b) => [b.id, target(b)]));
  const dropped = new Set<string>();
  const need = () => order.reduce((a, b) => a + (dropped.has(b.id) ? 0 : dur.get(b.id)!), 0);
  const byWeakest = (list: DayBlock[]) =>
    [...list].sort((a, b) => a.priority - b.priority || origin(b) - origin(a));

  // Shrink, one 15-minute step at a time.
  while (need() > capacity) {
    const shrinkable = byWeakest(order.filter((b) => !dropped.has(b.id) && b.type !== "protected" && dur.get(b.id)! - STEP >= b.minDuration));
    if (!shrinkable.length) break;
    const b = shrinkable[0];
    dur.set(b.id, dur.get(b.id)! - STEP);
  }
  // Drop, droppable first, then the weakest.
  while (need() > capacity) {
    const pool = order.filter((b) => !dropped.has(b.id) && b.type !== "protected" && !b.homeAnchor);
    if (!pool.length) break;
    const droppable = pool.filter((b) => b.type === "droppable");
    dropped.add(byWeakest(droppable.length ? droppable : pool)[0].id);
  }

  // Lay out in order. Free time can be split by fixed blocks, so a block may not fit
  // even when the total does: then drop the weakest other block and try again.
  const layout = () => {
    const placed = new Map<string, Min>();
    const misfits: DayBlock[] = [];
    let gi = 0;
    let cursor = gaps[0]?.[0] ?? H;
    for (const b of order) {
      if (dropped.has(b.id)) continue;
      const d = dur.get(b.id)!;
      let done = false;
      for (let g = gi; g < gaps.length; g++) {
        const [gs, end] = gaps[g];
        const from = Math.max(cursor, gs);
        const preferred = b.homeAnchor ? from : Math.max(from, origin(b));
        const start = preferred + d <= end ? preferred : from + d <= end ? from : null;
        if (start != null) {
          placed.set(b.id, start);
          cursor = start + d;
          gi = g;
          done = true;
          break;
        }
      }
      if (!done) misfits.push(b);
    }
    return { placed, misfits };
  };

  let { placed, misfits } = layout();
  for (let guard = 0; misfits.length && guard < 20; guard++) {
    const m = misfits[0];
    const others = order.filter((b) => !dropped.has(b.id) && b !== m && b.type !== "protected" && !b.homeAnchor);
    // A weak block that doesn't fit just goes; a protected one or a home anchor makes room first.
    if (m.type !== "protected" && !m.homeAnchor) dropped.add(m.id);
    else if (others.length) dropped.add(byWeakest(others)[0].id);
    else dropped.add(m.id); // no room tonight at all: flagged, the user decides
    ({ placed, misfits } = layout());
  }
  for (const m of misfits) dropped.add(m.id);

  const changes: Change[] = [];
  const next = blocks.map((b): DayBlock => {
    if (!candidates.includes(b) || (b.type === "fixed" && !b.homeAnchor)) return b;
    const from = { start: b.start, duration: b.duration };
    const keep = { origStart: origin(b), origDuration: target(b) };
    if (dropped.has(b.id)) {
      changes.push({ id: b.id, title: b.title, kind: "dropped", from });
      return { ...b, ...keep, status: "skipped", skipReason: "event", excused: true, dropped: true };
    }
    const to = { start: placed.get(b.id)!, duration: dur.get(b.id)! };
    const moved = to.start !== from.start;
    const shrunk = to.duration !== from.duration;
    changes.push({ id: b.id, title: b.title, kind: moved && shrunk ? "moved+shrunk" : moved ? "moved" : shrunk ? "shrunk" : "same", from, to });
    return { ...b, ...keep, start: to.start, duration: to.duration, status: "planned", dropped: undefined };
  });

  next.sort((a, b) => a.start - b.start);

  const nDropped = changes.filter((c) => c.kind === "dropped").length;
  const nShrunk = changes.filter((c) => c.kind.includes("shrunk")).length;
  const summary =
    nDropped === 0 && nShrunk === 0
      ? "Everything still fits. Shower, eat, then go."
      : [nShrunk ? `${nShrunk} block${nShrunk > 1 ? "s" : ""} shortened` : "", nDropped ? `${nDropped} dropped, excused` : ""]
          .filter(Boolean)
          .join(" · ") + ". Fixed anchors stay put.";

  return { homeAt: H, blocks: next, changes: changes.sort((a, b) => (a.to?.start ?? 9999) - (b.to?.start ?? 9999)), summary };
}
