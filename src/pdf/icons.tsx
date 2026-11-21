import { Circle, Ellipse, Path, Polyline, Rect, Svg } from "@react-pdf/renderer";

/* Tiny vector icons for the contact block (24x24 drawing grid). */

const SIZE = 9;
const INK = "#2B2B2B";

export function PinIcon({ background }: { background: string }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Path d="M12 1.5C7.6 1.5 4.5 4.7 4.5 9c0 5.6 7.5 13.5 7.5 13.5S19.5 14.6 19.5 9c0-4.3-3.1-7.5-7.5-7.5z" fill={INK} />
      <Circle cx={12} cy={9} r={2.8} fill={background} />
    </Svg>
  );
}

export function PhoneIcon() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Path
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
        fill={INK}
      />
    </Svg>
  );
}

export function MailIcon() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Rect x={2.5} y={4.5} width={19} height={15} rx={2} stroke={INK} strokeWidth={2} fill="none" />
      <Polyline points="3,6 12,13 21,6" stroke={INK} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export function GlobeIcon() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9.5} stroke={INK} strokeWidth={2} fill="none" />
      <Ellipse cx={12} cy={12} rx={4} ry={9.5} stroke={INK} strokeWidth={1.6} fill="none" />
      <Path d="M2.5 12h19" stroke={INK} strokeWidth={1.6} />
    </Svg>
  );
}
