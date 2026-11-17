import { AnimatePresence, motion } from "framer-motion";
import { GhostButton, Icon, PrimaryButton } from "../components/ui";
import { haptic, sound } from "../lib/feedback";
import { clearBlockNotifications, snoozeNative } from "../lib/native";
import { fmtRange, nowMin } from "../lib/time";
import { selectBlock, useStore } from "../store/store";
import { useUI } from "../store/ui";

/** Full-screen alarm for a non-negotiable. Done or snooze; nothing else. */
export function AlarmScreen() {
  const ref = useUI((s) => s.alarm);
  const open = useUI((s) => s.open);
  const b = useStore((s) => (ref ? selectBlock(s, ref.date, ref.id) : undefined));
  const markDone = useStore((s) => s.markDone);
  const close = () => open("alarm", null);

  return (
    <AnimatePresence>
      {ref && b && (
        <motion.div
          key="alarm"
          className="fixed inset-0 z-[80] flex flex-col bg-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-label={`${b.title} alarm`}
        >
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 60% at 50% 35%, rgb(var(--ember-rgb) / 0.28), transparent 70%)", animation: "breathe 1.4s ease-in-out infinite" }} />
          <div className="relative mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-6 text-center">
            <motion.span
              animate={{ rotate: [0, -12, 12, -10, 10, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.6 }}
              className="grid h-20 w-20 place-items-center rounded-full bg-ember text-black"
            >
              <Icon name="bell" size={38} stroke={2.2} />
            </motion.span>
            <div className="eyebrow mt-8 text-ember-hi">Non-negotiable</div>
            <h1 className="mt-2 text-[40px] leading-tight font-semibold tracking-[-0.03em]">{b.title}</h1>
            <p className="num mt-2 text-[17px] text-mute">{fmtRange(b.start, b.duration)}</p>
            <p className="mt-6 text-[16px] text-mute">Get up. Do it now.</p>
          </div>
          <div className="relative mx-auto w-full max-w-[520px] px-6 pb-[calc(28px+var(--safe-bottom))]">
            {b.status === "planned" || b.status === "missed" ? (
              <>
                <PrimaryButton
                  className="h-16 text-[18px]"
                  onClick={() => {
                    markDone(ref.date, ref.id, Math.floor(nowMin()));
                    clearBlockNotifications(ref.date, ref.id);
                    haptic("success");
                    sound("tick");
                    close();
                    setTimeout(() => open("checkin", ref), 300);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon name="check" size={20} stroke={2.6} /> Done
                  </span>
                </PrimaryButton>
                <GhostButton
                  className="mt-2 h-14 w-full"
                  onClick={() => {
                    snoozeNative(ref.date, ref.id, 10);
                    close();
                  }}
                >
                  Snooze 10 min
                </GhostButton>
              </>
            ) : (
              <GhostButton
                className="h-14 w-full"
                onClick={() => {
                  clearBlockNotifications(ref.date, ref.id);
                  close();
                }}
              >
                Already done · close
              </GhostButton>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
