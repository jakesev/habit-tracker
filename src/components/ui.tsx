import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useReducedMotion, useTransform, type HTMLMotionProps } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { haptic } from "../lib/feedback";

export const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
export const softSpring = { type: "spring", stiffness: 300, damping: 32 } as const;

/* ------------------------------------------------------------------ Pressable */

type PressableProps = HTMLMotionProps<"button"> & { haptics?: boolean; scale?: number };

/** Every tap: quick press-down scale, springy release, light haptic. */
export function Pressable({ haptics = true, scale = 0.96, onClick, children, ...rest }: PressableProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale }}
      transition={spring}
      onClick={(e) => {
        if (haptics) haptic("tap");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function PrimaryButton({ className = "", children, ...rest }: PressableProps) {
  return (
    <Pressable
      className={`relative h-14 w-full rounded-2xl bg-ember font-semibold text-[16px] text-black tracking-[-0.01em] shadow-[0_10px_30px_-10px_rgb(var(--ember-rgb)/0.7),inset_0_1px_0_rgb(255_255_255/0.35)] disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export function GhostButton({ className = "", children, ...rest }: PressableProps) {
  return (
    <Pressable
      className={`h-12 rounded-2xl border border-line bg-white/[0.04] px-4 text-[15px] font-medium text-ink ${className}`}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ CountUp */

export function CountUp({ value, decimals = 0, duration = 0.9, className = "" }: { value: number; decimals?: number; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, duration, mv, reduce]);
  return <motion.span className={`num ${className}`}>{text}</motion.span>;
}

/* ------------------------------------------------------------------ Ring */

export function Ring({
  value,
  size = 120,
  stroke = 10,
  color = "var(--color-ember)",
  track = "rgb(255 255 255 / 0.07)",
  glow = false,
  children,
  arc = 1,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  glow?: boolean;
  children?: ReactNode;
  /** 1 = full circle, 0.75 = gauge arc */
  arc?: number;
}) {
  const r = (size - stroke) / 2;
  const rotate = arc < 1 ? 90 + (360 * (1 - arc)) / 2 : -90;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0" style={{ transform: `rotate(${rotate}deg)`, overflow: "visible" }}>
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${arc} 1`}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.0001, v * arc), opacity: v > 0.002 ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 60, damping: 18, mass: 1 }}
          style={glow ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined}
        />
      </svg>
      <div className="relative z-10 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Sheet */

export function Sheet({
  open,
  onClose,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  const controls = useDragControls();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[92vh] max-w-[520px] overflow-y-auto no-scrollbar rounded-t-[28px] border-t border-line-strong bg-[#121215] pb-[calc(20px+var(--safe-bottom))] shadow-[0_-30px_60px_-20px_rgb(0_0_0/0.8)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => {
              if (i.offset.y > 120 || i.velocity.y > 600) onClose();
            }}
          >
            <div
              className="sticky top-0 z-10 flex cursor-grab touch-none justify-center bg-[#121215] pt-3 pb-3"
              onPointerDown={(e) => controls.start(e)}
            >
              <div className="h-1.5 w-10 rounded-full bg-white/15" />
            </div>
            <div className="px-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Scale 1–10 */

export function Scale({
  value,
  onChange,
  lo,
  hi,
  invert = false,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  lo: string;
  hi: string;
  /** colour the high end as "good" (energy) instead of "hard" */
  invert?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-[5px]">
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const on = value === n;
          const t = (invert ? 10 - n : n - 1) / 9; // 0 easy … 1 hard
          return (
            <Pressable
              key={n}
              scale={0.88}
              aria-label={`${n}`}
              aria-pressed={on}
              onClick={() => onChange(on ? null : n)}
              className="relative h-11 rounded-[12px] text-[14px] font-semibold num"
              style={{
                background: on ? `color-mix(in oklab, var(--color-ember) ${40 + t * 60}%, #2a2a30)` : "rgb(255 255 255 / 0.05)",
                color: on ? "#0b0b0c" : "var(--color-mute)",
                boxShadow: on ? `0 6px 18px -6px rgb(var(--ember-rgb) / ${0.3 + t * 0.5})` : "inset 0 0 0 1px rgb(255 255 255 / 0.05)",
              }}
            >
              {n}
            </Pressable>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-faint">
        <span>1 · {lo}</span>
        <span>{hi} · 10</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Segmented */

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  id,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className="flex rounded-2xl bg-white/[0.05] p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            scale={0.94}
            onClick={() => onChange(o.value)}
            className={`relative h-10 flex-1 rounded-xl text-[14px] font-medium transition-colors ${on ? "text-ink" : "text-faint"}`}
          >
            {on && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-xl bg-lift shadow-[0_4px_12px_-4px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.06)]" />}
            <span className="relative num">{o.label}</span>
          </Pressable>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Toggle */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      role="switch"
      aria-checked={on}
      aria-label={label}
      scale={0.92}
      onClick={() => onChange(!on)}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ember" : "bg-white/12"}`}
    >
      <motion.span
        className="absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow-md"
        animate={{ x: on ? 20 : 0 }}
        transition={spring}
      />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Toast */

export function useToast() {
  const [toast, setToast] = useState<{ id: number; title: string; line?: string; tone?: "hard" | "plain" } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "hard" ? 3600 : 2400);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, show: (title: string, line?: string, tone: "hard" | "plain" = "plain") => setToast({ id: Date.now(), title, line, tone }) };
}

/* ------------------------------------------------------------------ Icons */

const paths: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  today: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M4 10h16M8.5 14.5l2 2 4-4" />
    </>
  ),
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3 2-5.3 3.4-6.8.4 1.9 1.5 3 2.6 3.4-.2-3.3 1.3-6 3.5-7.9.3 2.6 1.6 4.2 2.9 5.8 1.2 1.5 2.1 3.2 2.1 5.5 0 3.6-2.6 6.2-6.5 6.2h-1.5Z" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  play: <path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.2-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  note: <path d="M5 5h14v10l-4 4H5zM15 19v-4h4M8.5 9.5h7M8.5 12.5h4" />,
  skip: <path d="M6 6l8 6-8 6zM17 6v12" />,
  left: <path d="m14.5 6-6 6 6 6" />,
  chevron: <path d="m6 9.5 6 6 6-6" />,
  right: <path d="m9.5 6 6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  shield: <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z" />,
  undo: <path d="M9 8 5 12l4 4M5 12h9.5a4.5 4.5 0 0 1 0 9H12" />,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  sparkle: <path d="M12 3.5c.6 4.3 2.2 6 6.5 6.5-4.3.6-6 2.2-6.5 6.5-.6-4.3-2.2-6-6.5-6.5 4.3-.6 6-2.2 6.5-6.5Z" />,
};

export function Icon({ name, size = 22, stroke = 1.8, className = "", fill = false }: { name: keyof typeof paths | string; size?: number; stroke?: number; className?: string; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export const CATEGORY_COLOR: Record<string, string> = {
  skill: "var(--color-skill)",
  reading: "var(--color-reading)",
  family: "var(--color-family)",
  chore: "var(--color-chore)",
  anchor: "var(--color-anchor)",
  event: "var(--color-event)",
};

export const CATEGORY_LABEL: Record<string, string> = {
  skill: "Skill",
  reading: "Reading",
  family: "Family",
  chore: "Chore",
  anchor: "Anchor",
  event: "Event",
};
