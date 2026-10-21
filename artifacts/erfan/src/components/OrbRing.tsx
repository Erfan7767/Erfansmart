import type { OrbState } from './ErfanWorld';

const GOLD = '#f5a623';
const BRIGHT = '#ffd080';

export function OrbRing({ state }: { state: OrbState }) {
  const cx = 450;
  const cy = 260;
  const radii = [178, 194, 212, 230, 250];
  return (
    <svg className="ring-art" viewBox="0 0 900 520" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="erfan-ring-fill">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
          <stop offset="70%" stopColor={GOLD} stopOpacity=".04" />
          <stop offset="88%" stopColor={GOLD} stopOpacity=".18" />
          <stop offset="100%" stopColor={BRIGHT} stopOpacity=".5" />
        </radialGradient>
        <radialGradient id="erfan-ambient">
          <stop offset="0%" stopColor={GOLD} stopOpacity=".08" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <filter id="erfan-ring-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g className="orb-frame" data-state={state}>
        <ellipse cx={cx} cy={cy} rx="285" ry="245" fill="url(#erfan-ambient)" className="orb-breathe" />
        {radii.map((r, i) => <circle key={r} cx={cx} cy={cy} r={r} stroke={GOLD} strokeWidth={i === 0 ? '.8' : '.4'} strokeOpacity={.15 - i * .02} strokeDasharray={i % 2 ? '3 7' : undefined} />)}
        <line x1={cx} y1={cy - 260} x2={cx} y2={cy - 240} stroke={GOLD} opacity=".3" />
        <line x1={cx} y1={cy + 240} x2={cx} y2={cy + 260} stroke={GOLD} opacity=".3" />
        {[0, 1, 2, 3].map((wave) => <circle key={wave} cx={cx} cy={cy} r="155" stroke={GOLD} fill="none" className="orb-wave" />)}
        {state === 'thinking' && <circle cx={cx} cy={cy} r="177" stroke={GOLD} strokeWidth="1" strokeOpacity=".45" strokeDasharray="8 14" className="orb-rotate" />}
        <circle cx={cx} cy={cy} r="155" fill="url(#erfan-ring-fill)" className="orb-breathe" />
        <circle cx={cx} cy={cy} r="155" stroke={GOLD} strokeWidth="18" strokeOpacity=".08" filter="url(#erfan-ring-blur)" fill="none" className="orb-breathe" />
        <circle cx={cx} cy={cy} r="155" stroke={GOLD} strokeWidth="6" strokeOpacity=".4" filter="url(#erfan-ring-blur)" fill="none" />
        <circle cx={cx} cy={cy} r="155" stroke={BRIGHT} strokeWidth="2.5" strokeOpacity=".95" fill="none" className="orb-breathe" />
        <circle cx={cx} cy={cy} r="90" stroke={GOLD} strokeWidth="1.5" strokeOpacity={state === 'idle' ? '.15' : '.45'} strokeDasharray="55 25" className="orb-rotate" />
        <circle cx={cx} cy={cy} r="54" stroke={GOLD} strokeWidth="1" strokeOpacity={state === 'idle' ? '.1' : '.3'} strokeDasharray="28 18" className="orb-rotate-rev" />
      </g>
    </svg>
  );
}

export function OrbStatusBar({ state }: { state: OrbState }) {
  const active = state !== 'idle';
  const label = state === 'thinking' ? 'PROCESSING' : state === 'speaking' ? 'SPEAKING' : 'STANDBY';
  const bars = Array.from({ length: 28 }, (_, i) => {
    const height = active ? 8 + Math.abs(Math.sin(i * .8)) * 26 : 3 + Math.abs(Math.sin(i * .6)) * 5;
    const x = 210 - 85 + i * (164 / 27);
    return <rect key={i} x={x} y={48 - height / 2} width="3" height={height} rx="1.5" fill={GOLD} opacity={active ? '.85' : '.3'} className="equalizer-bar" style={{ animationDelay: `${(i % 7) * .07}s` }} />;
  });
  return (
    <div className="status-bar" aria-live="polite" data-testid="status-orb-state">
      <svg width="100%" viewBox="0 0 420 130" fill="none" role="img" aria-label={`Erfan is ${label.toLowerCase()}`}>
        <defs><filter id="status-blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <line x1="60" y1="48" x2="182" y2="48" stroke={GOLD} opacity={active ? '.5' : '.18'} strokeDasharray="4 3" />
        <line x1="238" y1="48" x2="360" y2="48" stroke={GOLD} opacity={active ? '.5' : '.18'} strokeDasharray="4 3" />
        {bars}
        <circle cx="210" cy="48" r="20" stroke={GOLD} strokeWidth="1.5" strokeOpacity=".7" fill="#030200" filter="url(#status-blur)" />
        <circle cx="210" cy="48" r="6" fill={BRIGHT} />
        <text x="210" y="92" textAnchor="middle" fill={GOLD} className="status-label">{label}</text>
        {[0, 1, 2].map((i) => <circle key={i} cx={198 + i * 12} cy="110" r="2.5" fill={GOLD} className="status-dot" style={{ animationDelay: `${i * .4}s` }} />)}
        {!active && <text x="210" y="126" textAnchor="middle" fill={GOLD} fontSize="8" fontFamily="var(--app-font-mono)" letterSpacing=".14em" opacity=".38">TAP THE CORE · SELECT AN AGENT</text>}
      </svg>
    </div>
  );
}
