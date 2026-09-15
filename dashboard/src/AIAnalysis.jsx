import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { analyzeChart } from './ai.js';

const HEADS = ['What it shows', 'Why it matters', 'Recommended action'];

function renderRich(text) {
  // minimal markdown: **bold** + paragraphs + bold leading section heads
  return (text || '').split(/\n\s*\n/).map((p, i) => {
    let head = null;
    let rest = p;
    for (const h of HEADS) {
      if (rest.startsWith(h)) { head = h; rest = rest.slice(h.length).replace(/^[:\-.–—\s]+/, ''); break; }
    }
    const parts = rest.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith('**') && seg.endsWith('**')
        ? <b key={j}>{seg.slice(2, -2)}</b>
        : <span key={j}>{seg.replace(/^#+\s*/, '')}</span>);
    return <p key={i}>{head ? <b className="ai-sec">{head} — </b> : null}{parts}</p>;
  });
}

/* ---- shared side-dock: one fixed panel serves every chart, so results
   never change page layout and the chart stays visible beside it ---- */
let current = null;
const listeners = new Set();
const emit = () => { listeners.forEach((l) => l()); };
export function openDock(p) { current = p; emit(); }
export function closeDock() { current = null; emit(); }
const subscribe = (l) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => current;

/* True while the dock is open — App uses it to make room beside the dock. */
export function useDockOpen() {
  const d = useSyncExternalStore(subscribe, getSnapshot);
  return !!d;
}

export function AIDock() {
  const d = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    if (!d) return;
    const onKey = (e) => { if (e.key === 'Escape') closeDock(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [d]);
  if (!d) return null;
  return (
    <aside className="ai-dock" role="complementary" aria-label="AI analysis panel">
      <div className="ai-dock-head">
        <div>
          <div className="ai-dock-kicker">✨ AI analysis{!d.loading && d.cached ? ' · cached' : ''}</div>
          <b>{d.title}</b>
        </div>
        <button className="ai-x" onClick={closeDock} aria-label="Close panel">✕</button>
      </div>
      <div className="ai-dock-body">
        {d.loading && !d.text ? '✨ Analysing…' : (
          <div>
            {d.loading && <div className="ai-regen">↻ Regenerating…</div>}
            {d.error && <div className="ai-box ai-err" style={{ marginBottom: 12 }}>{d.error}</div>}
            {d.text ? renderRich(d.text) : null}
          </div>
        )}
      </div>
      <div className="ai-dock-foot">
        <button className="ai-link" onClick={d.onRegenerate}>↻ Regenerate</button>
      </div>
    </aside>
  );
}

const errMsg = (m) => m === 'HTTP 503'
  ? 'Both Gemini models are temporarily overloaded. Wait ~30 seconds and retry.'
  : m === 'HTTP 429'
    ? 'Free-tier quota is exhausted for now — it resets, try again later.'
    : `AI request failed (${m || 'error'}). Retry in a moment.`;

export default function AIAnalysis({ id, title, data, focus }) {
  const [st, setSt] = useState({ status: 'idle' });
  const wrapRef = useRef(null);

  const scrollToCard = () => {
    requestAnimationFrame(() => {
      const card = wrapRef.current && wrapRef.current.closest('.card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const run = async (force) => {
    const prev = st.status === 'ready' ? st.text : null;
    if (force) {
      openDock({ id, title, text: prev, loading: true, cached: false, error: null, onRegenerate: () => run(true) });
    } else {
      setSt({ status: 'loading' });
    }
    try {
      const r = await analyzeChart({ chartId: id, chartTitle: title, data, focus, force });
      const payload = {
        id, title, text: r.text, loading: false, error: null,
        cached: r.cached && !force, onRegenerate: () => run(true),
      };
      setSt({ status: 'ready', text: r.text, cached: r.cached && !force });
      openDock(payload);
      scrollToCard();
    } catch (e) {
      const m = e && e.message ? e.message : 'error';
      if (m === 'no-key') {
        setSt({ status: 'nokey' });
      } else if (force && prev) {
        openDock({ id, title, text: prev, loading: false, cached: false, error: errMsg(m), onRegenerate: () => run(true) });
      } else {
        setSt({ status: 'error', error: m });
      }
    }
  };

  const view = () => {
    openDock({ id, title, text: st.text, loading: false, error: null, cached: st.cached, onRegenerate: () => run(true) });
    scrollToCard();
  };

  return (
    <div className="ai" ref={wrapRef}>
      {st.status === 'ready' ? (
        <button className="ai-btn" onClick={view}>✨ View analysis{st.cached ? ' ✓' : ''}</button>
      ) : st.status === 'loading' ? (
        <button className="ai-btn" disabled>✨ Analysing…</button>
      ) : (
        <button className="ai-btn" onClick={() => run(false)}>✨ AI analysis</button>
      )}
      {st.status === 'nokey' && (
        <div className="ai-box ai-err" style={{ marginTop: 10 }}>AI key is not configured (missing VITE_GEMINI_API_KEY at build time).</div>
      )}
      {st.status === 'error' && (
        <div className="ai-box ai-err" style={{ marginTop: 10 }}>{errMsg(st.error)}</div>
      )}
    </div>
  );
}
