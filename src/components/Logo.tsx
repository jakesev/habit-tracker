import { APP, useTheme, type Theme } from "../lib/identity";

export function Glyph({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: APP.glyph }} />;
}

/** The app mark: the ensō on a tile in the theme's accent. */
export function Logo({ size = 26, theme }: { size?: number; theme?: Theme }) {
  const current = useTheme();
  const t = theme ?? current;
  return (
    <span className="grid shrink-0 place-items-center" style={{ width: size, height: size, borderRadius: size * 0.31, background: `rgb(${t.rgb.join(" ")})` }}>
      <Glyph size={size * 0.62} />
    </span>
  );
}
