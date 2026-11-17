import { motion } from "framer-motion";
import { haptic } from "../lib/feedback";
import { useAccent } from "../lib/identity";
import { Icon, spring } from "./ui";

export const LEAD_OPTIONS = [5, 10, 15, 30, 60];

const label = (m: number) => (m >= 60 ? `${m / 60}h` : `${m}m`);

/** Pick any number of heads-ups. Each one lights up when it's on. */
export function LeadPicker({ value, onChange, id }: { value: number[]; onChange: (v: number[]) => void; id: string }) {
  const set = new Set(value);
  const accent = useAccent();
  return (
    <div>
      <div className="grid grid-cols-5 gap-2" role="group" aria-label="Remind me before">
        {LEAD_OPTIONS.map((m) => {
          const on = set.has(m);
          return (
            <motion.button
              key={m}
              type="button"
              id={`${id}-${m}`}
              aria-pressed={on}
              aria-label={`${m} minutes before`}
              whileTap={{ scale: 0.9 }}
              transition={spring}
              onClick={() => {
                haptic("tap");
                const next = new Set(set);
                on ? next.delete(m) : next.add(m);
                onChange([...next].sort((a, b) => b - a));
              }}
              className="relative h-12 rounded-[14px] text-[14px] font-semibold"
              animate={{
                backgroundColor: on ? accent(0.16) : "rgba(255, 255, 255, 0.04)",
                boxShadow: on
                  ? `inset 0 0 0 1.5px ${accent(0.75)}, 0 0 18px -4px ${accent(0.7)}`
                  : "inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 0px 0px rgba(0, 0, 0, 0)",
              }}
              style={{ color: on ? "var(--color-ember-hi)" : "var(--color-mute)" }}
            >
              <span className="num">{label(m)}</span>
              {on && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={spring}
                  className="absolute -top-1.5 -right-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-ember text-black shadow-[0_2px_8px_rgb(0_0_0/0.5)]"
                >
                  <Icon name="check" size={11} stroke={3.4} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-faint">
        {value.length === 0
          ? "No heads-up. You'll still get one when it starts."
          : `Heads-up ${value.map(label).join(", ")} before. Tap to add or remove.`}
      </p>
    </div>
  );
}
