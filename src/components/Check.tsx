import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { haptic, primeAudio, sound } from "../lib/feedback";
import type { BlockStatus } from "../lib/types";
import { useAccent } from "../lib/identity";
import { Icon, spring } from "./ui";

const RAYS = 10;

/** The tick box. Filling it is the most repeated action in the app, so it gets the most care. */
export function Check({
  status,
  onToggle,
  disabled,
  size = 30,
  label,
}: {
  status: BlockStatus;
  onToggle: () => void;
  disabled?: boolean;
  size?: number;
  label: string;
}) {
  const reduce = useReducedMotion();
  const accent = useAccent();
  const done = status === "done" || status === "partial";
  const [burst, setBurst] = useState(0);
  const prev = useRef(done);

  useEffect(() => {
    if (done && !prev.current) setBurst((b) => b + 1);
    prev.current = done;
  }, [done]);

  const missed = status === "missed";
  const skipped = status === "skipped";

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={done}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      transition={spring}
      onClick={(e) => {
        e.stopPropagation();
        primeAudio();
        if (!done) {
          haptic("success");
          sound("tick");
        } else haptic("tap");
        onToggle();
      }}
      className="relative grid shrink-0 place-items-center disabled:opacity-40"
      style={{ width: size + 14, height: size + 14 }}
    >
      {/* burst */}
      <AnimatePresence>
        {burst > 0 && !reduce && (
          <motion.span key={burst} className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.55, delay: 0.2 }}>
            <motion.span
              className="absolute inset-[7px] rounded-full border-2 border-ember"
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            />
            {Array.from({ length: RAYS }, (_, i) => {
              const a = (i / RAYS) * Math.PI * 2;
              const d = size * 0.95;
              return (
                <motion.span
                  key={i}
                  className="absolute top-1/2 left-1/2 h-[5px] w-[5px] rounded-full"
                  style={{ background: i % 3 === 0 ? "#fff" : "var(--color-ember)", marginLeft: -2.5, marginTop: -2.5 }}
                  initial={{ x: 0, y: 0, scale: 1 }}
                  animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0 }}
                  transition={{ duration: 0.5, ease: [0.1, 0.9, 0.3, 1] }}
                />
              );
            })}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.span
        className="relative grid place-items-center rounded-[10px]"
        style={{ width: size, height: size }}
        animate={{
          backgroundColor: done ? accent(1) : "rgba(255, 255, 255, 0)",
          boxShadow: done
            ? `inset 0 0 0 0px rgba(255, 255, 255, 0), 0 6px 18px -4px ${accent(0.65)}`
            : missed
              ? "inset 0 0 0 1.75px rgba(255, 255, 255, 0.14), 0 0px 0px 0px rgba(0, 0, 0, 0)"
              : "inset 0 0 0 1.75px rgba(255, 255, 255, 0.28), 0 0px 0px 0px rgba(0, 0, 0, 0)",
          scale: done ? [1, 1.18, 1] : 1,
        }}
        transition={{ duration: 0.28, scale: { type: "spring", stiffness: 600, damping: 14 } }}
      >
        <AnimatePresence initial={false}>
          {done && (
            <motion.svg
              key="tick"
              width={size * 0.62}
              height={size * 0.62}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b0b0c"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
            >
              <motion.path d="m5 12.5 4.2 4.2L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22, delay: 0.04, ease: "easeOut" }} />
            </motion.svg>
          )}
        </AnimatePresence>
        {!done && (missed || skipped) && <Icon name={skipped ? "skip" : "x"} size={size * 0.5} stroke={2.2} className="text-faint" />}
      </motion.span>
    </motion.button>
  );
}
