import { useEffect } from "react";
import { useStore } from "../store/store";

export type IdentityId = "ember" | "callus" | "standard" | "forge";

export interface Identity {
  id: IdentityId;
  name: string;
  line: string;
  glyph: string; // svg inner markup, 24×24, drawn in the dark ink colour
  rgb: [number, number, number];
  hi: [number, number, number];
}

const INK = "#0b0b0c";

export const IDENTITIES: Identity[] = [
  {
    id: "ember",
    name: "Ember",
    line: "Your streak is a fire you keep fed.",
    glyph: `<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3 2-5.3 3.4-6.8.4 1.9 1.5 3 2.6 3.4-.2-3.3 1.3-6 3.5-7.9.3 2.6 1.6 4.2 2.9 5.8 1.2 1.5 2.1 3.2 2.1 5.5 0 3.6-2.6 6.2-6.5 6.2z" fill="${INK}"/>`,
    rgb: [255, 106, 43],
    hi: [255, 138, 76],
  },
  {
    id: "callus",
    name: "Callus",
    line: "Toughness built one hard rep at a time.",
    glyph: `<path d="M4 16.5 12 20l8-3.5M4 12.5 12 16l8-3.5M12 4 4 8.5 12 12l8-3.5z" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`,
    rgb: [242, 178, 76],
    hi: [248, 201, 125],
  },
  {
    id: "standard",
    name: "Standard",
    line: "Plant the flag. Hold the line every day.",
    glyph: `<path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`,
    rgb: [91, 140, 255],
    hi: [134, 169, 255],
  },
  {
    id: "forge",
    name: "Forge",
    line: "Discipline hammered out under heat.",
    glyph: `<path d="M3.5 7h12.5c0 2.4 2 3.6 4.5 3.6v1.4c-3 0-5 .8-6 2.5v1.5h2v3H7.5v-3h2v-1.5C8.5 12.8 6 11.5 3.5 11.5z" fill="${INK}"/>`,
    rgb: [255, 71, 87],
    hi: [255, 117, 129],
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
