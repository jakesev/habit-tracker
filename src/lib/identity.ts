import { useEffect } from "react";
import { useStore } from "../store/store";

export type IdentityId = "shugyo" | "vow";

export interface Identity {
  id: IdentityId;
  name: string;
  meaning: string;
  line: string;
  glyph: string; // svg inner markup, 24×24, drawn in the dark ink colour
  rgb: [number, number, number];
  hi: [number, number, number];
}

const INK = "#0b0b0c";

export const IDENTITIES: Identity[] = [
  {
    id: "shugyo",
    name: "Shugyo",
    meaning: "修行 · austere training",
    line: "Daily, deliberate discomfort that forges the spirit, not just the skill.",
    // Ensō: the open brush circle of Zen practice. Never closed, never finished.
    glyph: `<path d="M18.66 7.10 L19.09 7.58 L19.49 8.09 L19.85 8.64 L20.17 9.22 L20.45 9.82 L20.68 10.46 L20.86 11.11 L20.99 11.78 L21.07 12.46 L21.10 13.15 L21.07 13.85 L20.99 14.54 L20.85 15.23 L20.66 15.92 L20.41 16.59 L20.11 17.24 L19.76 17.87 L19.36 18.48 L18.91 19.05 L18.41 19.59 L17.87 20.09 L17.29 20.55 L16.67 20.96 L16.02 21.32 L15.34 21.63 L14.63 21.89 L13.90 22.10 L13.16 22.24 L12.41 22.33 L11.65 22.35 L10.89 22.32 L10.13 22.22 L9.38 22.07 L8.65 21.86 L7.93 21.59 L7.24 21.26 L6.57 20.88 L5.94 20.44 L5.34 19.96 L4.78 19.43 L4.27 18.86 L3.80 18.26 L3.38 17.61 L3.02 16.94 L2.71 16.24 L2.46 15.52 L2.26 14.79 L2.13 14.04 L2.05 13.29 L2.04 12.53 L2.08 11.78 L2.18 11.04 L2.33 10.30 L2.54 9.59 L2.81 8.89 L3.12 8.22 L3.49 7.58 L3.90 6.97 L4.36 6.40 L4.85 5.86 L5.38 5.37 L5.95 4.92 L6.55 4.51 L7.17 4.16 L7.82 3.85 L8.48 3.59 L9.16 3.39 L9.85 3.24 L10.55 3.14 L11.25 3.09 L11.95 3.10 L12.64 3.16 L12.47 5.65 L11.96 5.65 L11.46 5.68 L10.96 5.75 L10.47 5.85 L9.99 5.99 L9.52 6.17 L9.07 6.38 L8.63 6.62 L8.21 6.89 L7.82 7.20 L7.44 7.53 L7.10 7.88 L6.78 8.27 L6.48 8.67 L6.22 9.10 L5.99 9.54 L5.80 10.00 L5.64 10.48 L5.51 10.96 L5.42 11.45 L5.37 11.95 L5.36 12.45 L5.38 12.96 L5.44 13.46 L5.54 13.95 L5.67 14.44 L5.84 14.92 L6.04 15.38 L6.27 15.83 L6.54 16.27 L6.84 16.68 L7.17 17.07 L7.53 17.44 L7.92 17.78 L8.33 18.09 L8.77 18.37 L9.23 18.62 L9.71 18.84 L10.20 19.02 L10.71 19.16 L11.23 19.26 L11.75 19.33 L12.29 19.36 L12.82 19.34 L13.36 19.29 L13.89 19.19 L14.42 19.06 L14.93 18.89 L15.44 18.67 L15.92 18.42 L16.39 18.13 L16.84 17.80 L17.26 17.44 L17.66 17.05 L18.03 16.63 L18.37 16.18 L18.67 15.70 L18.93 15.20 L19.16 14.67 L19.35 14.13 L19.50 13.58 L19.61 13.01 L19.67 12.43 L19.69 11.85 L19.66 11.27 L19.59 10.69 L19.48 10.11 L19.32 9.54 L19.12 8.98 L18.88 8.44 L18.59 7.91 L18.26 7.41Z" fill="${INK}"/>`,
    rgb: [240, 80, 46],
    hi: [247, 118, 79],
  },
  {
    id: "vow",
    name: "Vow",
    meaning: "a promise kept",
    line: "A promise to yourself, kept when no one is watching. Don't break the chain.",
    // A chain link: the bond, and the streak.
    glyph: `<path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3.4-3.4a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3.4 3.4a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    rgb: [233, 185, 73],
    hi: [243, 207, 122],
  },
];

export const identityOf = (id: string | undefined) => IDENTITIES.find((i) => i.id === id) ?? IDENTITIES[0];

export function useIdentity() {
  return identityOf(useStore((s) => s.settings.identity));
}

/** Accent as an rgb() string with alpha, for values framer-motion animates. */
export function useAccent() {
  const i = useIdentity();
  return (a = 1) => `rgba(${i.rgb[0]}, ${i.rgb[1]}, ${i.rgb[2]}, ${a})`;
}

/** Push the chosen identity into CSS variables, the page title and the theme colour. */
export function useApplyIdentity() {
  const i = useIdentity();
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--ember-rgb", i.rgb.join(" "));
    r.style.setProperty("--ember-hi-rgb", i.hi.join(" "));
    r.dataset.identity = i.id;
    document.title = i.name;
  }, [i]);
}
