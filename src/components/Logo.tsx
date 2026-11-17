import { useIdentity, type Identity } from "../lib/identity";

export function Glyph({ identity, size }: { identity: Identity; size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: identity.glyph }} />;
}

/** The app mark: a rounded tile in the accent with the identity's glyph. */
export function Logo({ size = 26, identity }: { size?: number; identity?: Identity }) {
  const current = useIdentity();
  const i = identity ?? current;
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{ width: size, height: size, borderRadius: size * 0.31, background: `rgb(${i.rgb.join(" ")})` }}
    >
      <Glyph identity={i} size={size * 0.62} />
    </span>
  );
}
