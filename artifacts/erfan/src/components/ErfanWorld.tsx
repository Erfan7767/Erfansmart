import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import OverviewPanel from './OverviewPanel';
import OrbParticleCore from './OrbParticleCore';
import { OrbRing, OrbStatusBar } from './OrbRing';
import ShaderBackground from './ShaderBackground';

export type OrbState = 'idle' | 'thinking' | 'speaking';
type Agent = { key: string; name: string; color: string; layer: 'consultant' | 'doer' | 'tool'; x: number; y: number; live: boolean; bend: number; radius: number; role: string; caps: string[]; asks?: string[] };
type SelectedAgent = Pick<Agent, 'key' | 'name' | 'color'>;

/* Agent constellation and role summaries are adapted from APEX-UI's MIT-licensed
 * ReasoningWeb source. Kept in sync with the accessible agent list below. */
const AGENTS: Agent[] = [
  { key: 'chief_of_staff', name: 'Chief of staff', color: '#00e5ff', layer: 'consultant', x: 250, y: 212, live: true, bend: 18, radius: 9, role: 'Personal coordinator', caps: ['Plans and prioritizes your day', 'Routes requests to relevant specialists', 'Keeps open tasks visible'], asks: ['What needs attention today?', 'Review my open tasks'] },
  { key: 'memory', name: 'Memory', color: '#00e5ff', layer: 'consultant', x: 452, y: 250, live: true, bend: -18, radius: 8, role: 'Context archive', caps: ['Organizes project and decision context', 'Keeps useful information easy to retrieve', 'Surfaces prior notes'], asks: ['Find a past decision', 'Summarize project context'] },
  { key: 'strategist', name: 'Strategist', color: '#00e5ff', layer: 'consultant', x: 296, y: 118, live: true, bend: -22, radius: 6.5, role: 'Planning specialist', caps: ['Structures goals and milestones', 'Explores options and trade-offs', 'Surfaces possible risks'], asks: ['Map a project plan'] },
  { key: 'researcher', name: 'Researcher', color: '#00e5ff', layer: 'consultant', x: 182, y: 150, live: true, bend: 24, radius: 6.5, role: 'Research specialist', caps: ['Organizes research questions', 'Compares source material', 'Prepares concise findings'], asks: ['Compare these sources', 'Outline a research brief'] },
  { key: 'finance', name: 'Finance', color: '#00e5ff', layer: 'consultant', x: 436, y: 148, live: true, bend: -20, radius: 6.5, role: 'Financial analysis', caps: ['Structures budgets and estimates', 'Reviews pricing assumptions', 'Summarizes financial inputs'], asks: ['Review this estimate'] },
  { key: 'editor', name: 'Editor', color: '#00e5ff', layer: 'consultant', x: 584, y: 208, live: true, bend: -26, radius: 6.5, role: 'Writing and review', caps: ['Tightens drafts for clarity', 'Checks consistency and tone', 'Prepares copy for review'], asks: ['Polish a draft', 'Tighten this note'] },
  { key: 'sales', name: 'Sales', color: '#f5a623', layer: 'doer', x: 158, y: 266, live: true, bend: 22, radius: 6.5, role: 'Sales workflow profile', caps: ['Organizes follow-up notes', 'Drafts outreach for review', 'Keeps opportunity details together'], asks: ['Draft a follow-up'] },
  { key: 'marketing', name: 'Marketing', color: '#f5a623', layer: 'doer', x: 195, y: 298, live: true, bend: 22, radius: 6.5, role: 'Marketing workflow profile', caps: ['Organizes campaign ideas', 'Maps content themes', 'Compares positioning options'], asks: ['Plan a content week'] },
  { key: 'ops', name: 'Ops', color: '#f5a623', layer: 'doer', x: 232, y: 330, live: true, bend: 20, radius: 6.5, role: 'Operations workflow profile', caps: ['Structures project scope', 'Organizes timelines and dependencies', 'Collects supplier details'], asks: ['Draft a project scope'] },
  { key: 'social_media', name: 'Social', color: '#f5a623', layer: 'doer', x: 330, y: 374, live: true, bend: -16, radius: 6.5, role: 'Social content profile', caps: ['Drafts social captions', 'Structures short-form scripts', 'Plans publishing calendars'], asks: ['Draft a caption'] },
  { key: 'engineering', name: 'Engineering', color: '#f5a623', layer: 'doer', x: 426, y: 350, live: true, bend: -18, radius: 6.5, role: 'Engineering workflow profile', caps: ['Organizes technical requirements', 'Compares design constraints', 'Documents build decisions'], asks: ['Review these requirements'] },
  { key: 'design', name: 'Design', color: '#f5a623', layer: 'doer', x: 502, y: 312, live: true, bend: -22, radius: 6.5, role: 'Design workflow profile', caps: ['Structures visual feedback', 'Organizes creative briefs', 'Tracks asset requirements'], asks: ['Review a creative brief'] },
  { key: 'developer', name: 'Developer', color: '#f5a623', layer: 'doer', x: 118, y: 356, live: false, bend: 26, radius: 6, role: 'Build journal', caps: ['Keeps development notes organized', 'Summarizes completed work', 'Tracks future build ideas'], asks: ['Summarize the build log'] },
  { key: 'analytics', name: 'Analytics', color: '#7f9bb3', layer: 'tool', x: 256, y: 388, live: false, bend: 20, radius: 5.5, role: 'Metrics profile', caps: ['Collects metrics for later review', 'Structures performance summaries'] },
  { key: 'crm', name: 'CRM', color: '#7f9bb3', layer: 'tool', x: 414, y: 392, live: true, bend: -18, radius: 5.5, role: 'Relationship profile', caps: ['Organizes contact notes', 'Maps relationship stages'] },
  { key: 'calendar', name: 'Calendar', color: '#7f9bb3', layer: 'tool', x: 560, y: 356, live: true, bend: -24, radius: 5.5, role: 'Schedule profile', caps: ['Organizes schedule details', 'Tracks timing and reminders'] },
  { key: 'email', name: 'Email', color: '#7f9bb3', layer: 'tool', x: 608, y: 286, live: false, bend: -26, radius: 5.5, role: 'Inbox profile', caps: ['Organizes message context', 'Prepares response drafts'] },
  { key: 'drive', name: 'Drive', color: '#7f9bb3', layer: 'tool', x: 582, y: 132, live: false, bend: 24, radius: 5.5, role: 'Files profile', caps: ['Organizes file references', 'Keeps document context close'] },
];

function ReasoningWeb({ state, onSelect }: { state: OrbState; onSelect: (agent: SelectedAgent) => void }) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTime((t) => t + .04), 40);
    return () => window.clearInterval(id);
  }, []);
  const center = { x: 340, y: 240 };
  const path = (agent: Agent) => {
    const mx = (center.x + agent.x) / 2;
    const my = (center.y + agent.y) / 2;
    const dx = agent.x - center.x;
    const dy = agent.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    return `M${center.x} ${center.y} Q${mx - dy / length * agent.bend} ${my + dx / length * agent.bend} ${agent.x} ${agent.y}`;
  };
  const activeColor = (state === 'speaking' ? .9 : state === 'thinking' ? .72 : .48);
  return (
    <svg className="reasoning-web" viewBox="0 0 680 480" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Erfan reasoning graph with eighteen agent nodes">
      <g aria-hidden="true">
        {[72, 128, 186].map((r) => <circle key={r} cx="340" cy="240" r={r} fill="none" stroke="#1b5f78" strokeWidth="1" strokeDasharray="1 7" opacity=".32" />)}
        {[-1, 1].flatMap((side) => Array.from({ length: 6 }, (_, i) => {
          const y = 240 + (i - 2.5) * 52;
          const from = 340 + side * (126 + i * 3);
          const turn = side < 0 ? 58 + i * 7 : 622 - i * 7;
          const endpoint = side < 0 ? 14 + i * 5 : 666 - i * 5;
          return <g key={`${side}-${i}`} opacity=".52"><path d={`M${from} ${y} H${turn} V${y + (i % 2 ? 8 : -8)} H${endpoint}`} fill="none" stroke="#1c5f7a" strokeWidth="1" /><circle cx={endpoint} cy={y + (i % 2 ? 8 : -8)} r="2.3" fill="#37d6ef" /><circle cx={from} cy={y} r="1.3" fill="#2bd0e6" opacity=".7" /></g>;
        }))}
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          const r = 203 + (i % 4) * 9;
          const x = 340 + Math.cos(a) * r;
          const y = 240 + Math.sin(a) * r * .68;
          return <g key={`mesh-${i}`} opacity=".16"><line x1={x} y1={y} x2={340 + Math.cos(a + .42) * r} y2={240 + Math.sin(a + .42) * r * .68} stroke="#2bd0e6" /><circle cx={x} cy={y} r="1" fill="#5fe0f2" /></g>;
        })}
      </g>
      {AGENTS.map((agent, i) => {
        const minor = !agent.live || agent.layer === 'tool';
        const dx = agent.x - center.x;
        const dy = agent.y - center.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d;
        const uy = dy / d;
        const above = uy > .82;
        const rr = agent.live ? agent.radius : 5.5;
        const labelX = above ? agent.x : agent.x + ux * (rr + 11);
        const labelY = above ? agent.y - rr - 9 : agent.y + uy * (rr + 11) + (Math.abs(uy) < .3 ? 4 : 0);
        return (
          <g key={agent.key} className="agent-node" style={{ animationDelay: `${i * .13}s` }}>
            <path d={path(agent)} fill="none" stroke={agent.color} strokeWidth={state === 'idle' ? 1 : 1.25} opacity={agent.live ? activeColor : .24} />
            <circle cx={agent.x} cy={agent.y} r={rr + 2} fill={agent.color} filter="url(#node-glow)" opacity={agent.live ? .32 + Math.sin(time * 1.4 + i) * .08 : .12} />
            <circle cx={agent.x} cy={agent.y} r={rr} fill="none" stroke={agent.color} strokeWidth={agent.live ? 2 : 1.3} strokeDasharray={agent.live ? undefined : '2 2'} opacity={agent.live ? 1 : .58} />
            <text x={labelX} y={labelY} textAnchor={above ? 'middle' : ux > .3 ? 'start' : ux < -.3 ? 'end' : 'middle'} fontSize={minor ? 9.5 : 12} fill={!agent.live ? '#718596' : minor ? '#9cb2c2' : '#e0ebf2'} opacity={!agent.live ? .72 : 1}>{agent.name}</text>
          </g>
        );
      })}
      <defs><filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4" /></filter></defs>
    </svg>
  );
}

function AgentOverview({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [agent.key, onClose]);
  const x = Math.max(14, Math.min(window.innerWidth - 354, window.innerWidth / 2 - 170));
  const y = Math.max(86, Math.min(window.innerHeight - 440, window.innerHeight * .16));
  return (
    <div ref={dialogRef} className="agent-dialog" role="dialog" aria-modal="true" aria-label={`${agent.name} profile`} style={{ '--agent-color': agent.color, left: x, top: y } as CSSProperties} data-testid={`dialog-agent-${agent.key}`}>
      <header>
        <div className="agent-orb-icon"><span /></div>
        <div><div className="agent-name">{agent.name}</div><div className="agent-role">{agent.role}</div></div>
        <button type="button" className="agent-close" aria-label="Close profile" onClick={onClose} data-testid="button-close-agent">×</button>
      </header>
      <div className="agent-dialog-body">
        <section>
          <div className="agent-eyebrow">PROFILE SCOPE</div>
          {agent.caps.map((cap) => <div key={cap} className="agent-capability">{cap}</div>)}
        </section>
        {agent.asks && <section><div className="agent-eyebrow">EXAMPLE PROMPTS · ILLUSTRATIVE</div><div className="agent-prompts">{agent.asks.map((ask) => <span key={ask} className="agent-prompt">{ask}</span>)}</div></section>}
        <div className="agent-status" style={{ '--status-color': agent.live ? '#34d399' : '#7f9bb3' } as CSSProperties}>
          <span className="agent-status-dot" /> DEMO PROFILE · NO CONNECTED AI BACKEND
        </div>
      </div>
    </div>
  );
}

export default function ErfanWorld() {
  const [selected, setSelected] = useState<Agent | null>(null);
  const [state, setState] = useState<OrbState>('idle');
  const [reducedMotion, setReducedMotion] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const boost = () => {
    setState((old) => {
      const next = old === 'idle' ? 'thinking' : old === 'thinking' ? 'speaking' : 'idle';
      return next;
    });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 8000);
  };
  const openAgent = (agent: SelectedAgent) => setSelected(AGENTS.find((item) => item.key === agent.key) ?? null);
  const close = useCallback(() => setSelected(null), []);
  return (
    <main id="main" className="erfan-app">
      <div className="world">
        <div className="world-base" aria-hidden="true" />
        {!reducedMotion && <ShaderBackground opacity={.12} voiceActive={state === 'speaking'} />}
        <div className="world-light" data-speaking={state === 'speaking'} aria-hidden="true" />
        <ReasoningWeb state={state} onSelect={openAgent} />
        <nav className="agent-list-hidden" aria-label="Erfan agents">
          <ul>{AGENTS.map((agent) => <li key={agent.key}><button type="button" onClick={() => setSelected(agent)} data-testid={`list-agent-${agent.key}`}>{agent.name} — {agent.role}</button></li>)}</ul>
        </nav>
        <div className="core-stage" aria-hidden="true">
          <OrbRing state={state} />
          <OrbParticleCore state={state} reducedMotion={reducedMotion} />
        </div>
        <button
          className="orb-hit"
          type="button"
          onClick={boost}
          aria-label={`Erfan orb is ${state}; activate to cycle state`}
          data-testid="button-orb-cycle"
        />
        <svg className="agent-hit-layer" viewBox="0 0 680 480" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {AGENTS.map((agent) => <circle key={agent.key} className="agent-hit" cx={agent.x} cy={agent.y} r={Math.max(agent.radius + 13, 17)} fill="transparent" onClick={() => openAgent(agent)} data-testid={`graph-agent-${agent.key}`} />)}
        </svg>
        <OrbStatusBar state={state} />
        {selected && <AgentOverview agent={selected} onClose={close} />}
      </div>
      <OverviewPanel />
      <div style={{ position: 'fixed', top: 112, left: 11, zIndex: 12, color: 'rgba(195,220,232,.35)', font: '8px var(--app-font-mono)', letterSpacing: '.12em', pointerEvents: 'none' }} data-testid="text-demo-disclaimer">
        ERFAN · INTERFACE DEMO · NO AI BACKEND
      </div>
      <a className="source-link" href="https://github.com/RubenM1990/APEX-UI" target="_blank" rel="noopener noreferrer" data-testid="link-source-credit">SOURCE REPOSITORY ↗</a>
    </main>
  );
}
