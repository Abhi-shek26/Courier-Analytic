import { useEffect, useMemo, useState } from 'react';
import AIAnalysis, { AIDock, useDockOpen } from './AIAnalysis.jsx';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Legend,
  Treemap, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';

const get = (f) => fetch(`data/${f}`).then((r) => r.json());
const rs = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const num = (n) => Number(n).toLocaleString('en-IN');

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#f472b6'];
const BAR_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'];
const TYPE_COLORS = {
  DUPLICATE_SETTLEMENT: '#8b5cf6', OVERDUE_REMITTANCE: '#3b82f6',
  PHANTOM_RTO_CHARGE: '#06b6d4', COD_SHORT_REMITTANCE: '#10b981',
  WEIGHT_DISPUTE: '#f59e0b', EXCESS_FORWARD_CHARGE: '#ef4444', ETA_SLA_BREACH: '#94a3b8',
};
const DARK_TIP = { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, color: '#0f172a', fontSize: 12, padding: '8px 12px' };
const AXIS = { fill: '#64748b', fontSize: 12 };

/* Animated count-up for KPI numbers. */
function Count({ to, fmt, dur = 1000 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return <span>{fmt(v)}</span>;
}

/* Treemap leaf: coloured by rule type, labelled when it fits. */
function TreeLeaf({ x, y, width, height, depth, payload }) {
  if (depth < 2 || width < 4 || height < 4) return null;
  const color = (payload && TYPE_COLORS[payload.type]) || '#64748b';
  const label = payload ? `${payload.tier} · ₹${(payload.size / 100000).toFixed(1)}L` : '';
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={7} fill={color} fillOpacity={0.92} stroke="#ffffff" strokeWidth={2.5} />
      {width > 96 && height > 44 && (
        <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700}>{label}</text>
      )}
    </g>
  );
}

/* Bubble-scatter tooltip: which cell the bubble is. */
function ScatterTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={DARK_TIP}>
      <b>{p.courier} · {p.tier}</b><br />
      <code>{p.dtype}</code><br />
      {p.x} cases · {rs(p.y)} avg · {rs(p.z)} total
    </div>
  );
}

function useData() {
  const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all(['kpis.json', 'trend.json', 'pareto.json', 'funnel.json',
      'scorecard.json', 'rca_cells.json', 'merchants.json', 'tier_entry.json',
      'olist.json', 'olist_monthly.json', 'olist_reviews.json', 'olist_sellers.json',
      'forecast.json'].map(get))
      .then(([kpis, trend, pareto, funnel, scorecard, cells, merchants, tiers, olist, olistMonthly, olistReviews, olistSellers, forecast]) =>
        setD({ kpis, trend, pareto, funnel, scorecard, cells, merchants, tiers, olist, olistMonthly, olistReviews, olistSellers, forecast }))
      .catch(() => setD({ error: true }));
  }, []);
  return d;
}

const RULES = [
  ['COD_SHORT_REMITTANCE', 'Settled < COD − min(2%, ₹10). Variance = shortfall.'],
  ['WEIGHT_DISPUTE', 'Charged > declared × 1.10. Variance = excess kg × ₹60.'],
  ['PHANTOM_RTO_CHARGE', 'RTO fee > 0 on DELIVERED. Variance = RTO charge.'],
  ['OVERDUE_REMITTANCE', 'DSO > 14 days. Variance = cash stuck.'],
  ['DUPLICATE_SETTLEMENT', 'AWB in > 1 batch. Variance = settled COD. HIGH.'],
  ['ETA_SLA_BREACH', 'Actual > promised × 1.3. Variance 0, hits dispute rate.'],
  ['EXCESS_FORWARD_CHARGE', 'Forward > slab × 1.15. Variance = excess.'],
];

/* Plain-language takeaways now come from the ✨ AI analysis button under each chart. */

/* ---------------- Landing ---------------- */
function Landing({ d, goAnalyse }) {
  const k = d?.kpis;
  return (
    <div>
      <section className="hero">
        <div className="hero-badge">MSSQL · Kafka KRaft · Python stats · React + PowerBI</div>
        <h1>Courier-Analytic</h1>
        <p className="sub">The shopkeeper's watchdog — COD settlement reconciliation + leakage RCA for e-commerce logistics.</p>
        {k && (
          <div className="hero-kpis">
            <div><b><Count to={k.leakage_rs} fmt={rs} /></b><span>leakage caught</span></div>
            <div><b><Count to={k.disputed_awbs} fmt={num} /></b><span>disputed AWBs ({k.dispute_rate_pct}%)</span></div>
            <div><b><Count to={k.settled_awbs} fmt={num} /></b><span>shipments · 90 days</span></div>
            <div><b><Count to={k.avg_dso_days} fmt={(v) => `${v.toFixed(1)}d`} /></b><span>avg DSO</span></div>
          </div>
        )}
        <div className="hero-cta">
          <button className="btn primary" onClick={() => goAnalyse('warehouse')}>Open Analyse →</button>
          <button className="btn ghost" onClick={() => goAnalyse('olist')}>See real-data proof (99k orders)</button>
        </div>
        <p className="hero-note">Two datasets, one engine: synthetic 25k warehouse + real Olist 99k Brazilian e-commerce orders.</p>
      </section>

      <section className="section">
        <h2>The real-world problem</h2>
        <p>You order shoes worth ₹2,000 Cash on Delivery. The agent collects ₹2,000 and hands it to the courier (Delhivery, Bluedart…). Later the courier must <b>settle</b> — transfer that ₹2,000 to the shopkeeper minus delivery charges.</p>
        <p>A shopkeeper shipping 25,000 parcels a month through 5 couriers gets a big CSV from each courier: "here's what we delivered, here's the money." Someone must check: <i>did I get the right money for every parcel?</i> Nobody checks properly. Money leaks:</p>
        <div className="leak-grid">
          <div><b>COD shortfall</b><span>Collected ₹2,000, transferred ₹1,850</span></div>
          <div><b>Weight dispute</b><span>Billed 2.5 kg on a 2 kg parcel</span></div>
          <div><b>Phantom RTO</b><span>Delivered, yet a "return" fee charged</span></div>
          <div><b>Overdue</b><span>Money arrives day 25 instead of day 7</span></div>
          <div><b>Duplicate</b><span>Same parcel settled twice</span></div>
        </div>
        <div className="parcel">
          <b>One parcel, walked through —</b> Shop record: <code>AWB100001 · COD ₹5,000 · 2 kg · DELIVERED</code> →
          Courier file: <code>transferred ₹4,600 · charged 2.5 kg · RTO ₹150</code> →
          Verdict: <b>COD short ₹400 + weight inflated 25% + phantom RTO ₹150.</b> Scale to thousands of parcels → <b>₹22.3 lakh across 5,774 parcels.</b>
        </div>
      </section>

      <section className="section">
        <h2>What this project does</h2>
        <p>It answers one question a shopkeeper actually asks: <b>did I receive the right money for every parcel I shipped?</b> Four steps, end to end:</p>
        <div className="does-grid">
          <div className="does-card"><span className="n">1</span><b>Ingest shipments + settlements</b><span>25k shop orders and 25k courier settlement rows land in a star-schema warehouse — one row per AWB per batch.</span><code>warehouse/seed → MSSQL</code></div>
          <div className="does-card"><span className="n">2</span><b>Reconcile with 7 rules</b><span>An idempotent stored procedure prices every mismatch in rupees with HIGH / MEDIUM / LOW severity.</span><code>sp_reconcile_batch</code></div>
          <div className="does-card"><span className="n">3</span><b>Prove it with statistics</b><span>t-tests, chi-square, a courier scorecard and a leakage forecast separate real signals from noise.</span><code>python/scripts 01–04</code></div>
          <div className="does-card"><span className="n">4</span><b>Serve it for decisions</b><span>This site, plus a PowerBI report and Kafka event stream so finance and ops can act on it.</span><code>dashboard + powerbi + Kafka</code></div>
        </div>
      </section>

      <section className="section">
        <h2>What this project includes</h2>
        <p>Everything below ships in the repo and is wired into this site — nothing on this page is a mockup.</p>
        <div className="inv-grid">
          <div className="inv"><b>Warehouse · MSSQL star schema</b><ul><li>8 tables: dims + facts + daily KPI mart</li><li>6 analyst queries (RANK, LAG, NTILE…)</li><li>25k deterministic seed with injected signals</li></ul><code>warehouse/ddl, queries, seed, models</code></div>
          <div className="inv"><b>Reconciliation engine</b><ul><li>7 T-SQL rules, rupee variance, idempotent</li><li>Python runner → JSONL → Kafka topic</li><li>6,456 discrepancy events verified</li></ul><code>engine/sql, reconcile.py, Kafka KRaft</code></div>
          <div className="inv"><b>Python analytics</b><ul><li>EDA + Welch t / χ² + scorecard + Ridge forecast</li><li>Olist real-data validation (99k orders)</li><li>Charts + dashboard JSON exports</li></ul><code>python/scripts 01–07, outputs/</code></div>
          <div className="inv"><b>This website</b><ul><li>Landing explainer + Analyse dashboards</li><li>Warehouse 25k and Olist 99k views</li><li>RCA workbench with 5-Why reads</li></ul><code>dashboard/src, public/data</code></div>
          <div className="inv"><b>PowerBI pack</b><ul><li>7 ready CSVs (4 warehouse + 3 Olist)</li><li>12 DAX measures + 25-min build guide</li><li>Shipped report + overview screenshot</li></ul><code>powerbi/dataset, measures.dax, .pbix</code></div>
          <div className="inv"><b>Case studies + docs</b><ul><li>Revenue-drop RCA, Tier-2 entry, glossary, guesstimate</li><li>Plain-language explainer + demo path</li><li>Real-world readiness (80/20) note</li></ul><code>case-studies/, docs/</code></div>
        </div>
      </section>

      <section className="section grid2">
        <div>
          <h2>7 reconciliation rules</h2>
          <table className="tbl"><tbody>{RULES.map(([n, s]) => <tr key={n}><td><code>{n}</code></td><td>{s}</td></tr>)}</tbody></table>
          <p className="muted">Severity: HIGH &gt; ₹500 · MEDIUM &gt; ₹100 · else LOW. Severity + rupee variance on every mismatch.</p>
        </div>
        <div>
          <h2>Statistics, not gut feel</h2>
          <ul className="stats">
            <li><b>Bluedart Tier-3 +12.98%</b> weight inflation vs +0.00% rest (Welch t=41.2, p≈6e-256) → systematic overcharge, raise dispute.</li>
            <li><b>Festival 36.7% vs 21.8%</b> dispute rate (χ²=250, p≈2e-56) → capacity / process RCA.</li>
            <li><b>Delhivery COD shortfall</b> on high-value COD (χ²=3063, p≈0) → hold high-value COD, follow up.</li>
            <li><b>Scorecard:</b> Shiprocket 72.2 → Delhivery 70.2 → Bluedart 69.7 → Kwikship 68.4 → DTDC 63.7.</li>
            <li><b>Forecast:</b> Ridge(t, festival) R²=0.32, leakage trending +₹7k/week.</li>
          </ul>
        </div>
      </section>

      <section className="section">
        <h2>Two datasets, same rules</h2>
        <div className="ds-grid">
          <div className="ds">
            <b>Warehouse · synthetic 25k</b>
            <span>5 couriers · Tier-1/2/3 · Grocery/Food/Pharmacy · COD/Prepaid · Diwali-week flag. Injected signals: Bluedart Tier-3 weight +13%, Shiprocket festival overdue spike, Delhivery high-value COD shortfall, phantom RTO on DELIVERED.</span>
          </div>
          <div className="ds real">
            <b>Olist · real 99,441 orders</b>
            <span>Kaggle brazilian-ecommerce: 8.1% late (avg 9.6d), 249 payment mismatches, 983 freight outliers. Late → 65.3% bad reviews vs 17.2% on-time (χ²=9833). 462 sellers scored, worst 32.1% late.</span>
          </div>
        </div>
      </section>

      <section className="section real-box">
        <h2>Will this work on real company data? Yes — ~80% transfers directly.</h2>
        <p>Same schema, same 7 rules, same queries, same statistics, same dashboard and Kafka pattern. Point it at real courier CSVs with the same columns and it runs. The warehouse is a real star schema (dim_courier, dim_geo, dim_merchant, dim_date, fact_orders, fact_settlements, fact_discrepancies, fct_daily_kpis) — exactly how logistics analytics teams model settlements.</p>
        <p className="muted">Remaining 20% to harden for production: daily auto-fetch from courier portals/APIs, real per-courier rate cards (the ₹60/kg proxy is a placeholder), logins + audit trail, managed Kafka, and a dispute-recovery loop (file claims, track money recovered).</p>
      </section>

      <section className="section grid2">
        <div>
          <h2>Case studies</h2>
          <ul className="stats">
            <li><b>rca_revenue_drop</b> — revenue −7% drill-down with LAG / contribution math.</li>
            <li><b>tier2_city_expansion</b> — Tier-2 entry cost using tier leakage % GMV + delay.</li>
            <li><b>metrics_glossary</b> — dispute %, DSO, reliability, leakage definitions.</li>
            <li><b>guesstimate_cod_leakage</b> — back-of-envelope COD leakage sizing.</li>
          </ul>
        </div>
        <div>
          <h2>PowerBI + local run</h2>
          <ul className="stats">
            <li><b>PowerBI:</b> 7 CSVs (4 warehouse + 3 Olist), 12 DAX measures, ~25-min build guide. Report: <code>powerbi/Courier-Analytic.pbix</code>.</li>
            <li><b>Run:</b> <code>schema.sql → generate + load_mssql → sp_reconcile_batch → fct_daily_kpis → 01–05 python → compose up kafka → reconcile.py → npm run dev</code></li>
          </ul>
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to explore the numbers?</h2>
        <p>Switch to the Analyse view — warehouse and real-data charts, side by side.</p>
        <button className="btn primary" onClick={() => goAnalyse('warehouse')}>Start analysing →</button>
      </section>
    </div>
  );
}

/* ---------------- Analyse: warehouse ---------------- */
function RcaWorkbench({ cells }) {
  const [courier, setCourier] = useState('all');
  const [tier, setTier] = useState('all');
  const couriers = useMemo(() => ['all', ...new Set(cells.map((c) => c.courier_))], [cells]);
  const rows = cells
    .filter((c) => (courier === 'all' || c.courier_ === courier) && (tier === 'all' || c.tier === tier))
    .slice(0, 15);
  const top = rows[0];
  return (
    <div className="card">
      <h3>RCA workbench — where is the money leaking?</h3>
      <div className="filters">
        <label>Courier <select value={courier} onChange={(e) => setCourier(e.target.value)}>{couriers.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Tier <select value={tier} onChange={(e) => setTier(e.target.value)}>{['all', 'Tier-1', 'Tier-2', 'Tier-3'].map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      {top && <p className="why">5-Why read: leakage concentrates in <b>{top.courier_} × {top.tier} × {top.dtype}</b> — {top.cases_} cases, {rs(top.leakage)}. Fix this cell first.</p>}
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Courier</th><th>Tier</th><th>Type</th><th>Cases</th><th>Leakage</th><th>Avg loss</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td>{r.courier_}</td><td>{r.tier}</td><td><code>{r.dtype}</code></td><td>{r.cases_}</td><td>{rs(r.leakage)}</td><td>{rs(r.avg_loss)}</td></tr>)}</tbody></table></div>
      <AIAnalysis id="rca-workbench" title="RCA workbench — worst courier x tier x type cells" data={rows} focus="Given the selected courier/tier filter, name the single cell to fix first, quantify its share, and lay out the 5-Why chain down to the operational root cause and owner." />
    </div>
  );
}

function Warehouse({ d }) {
  const { kpis, trend, pareto, funnel, scorecard, cells, merchants, tiers, forecast } = d;
  const byType = useMemo(() => {
    const m = {};
    cells.forEach((c) => { m[c.dtype] = m[c.dtype] || { name: c.dtype, cases: 0, value: 0 }; m[c.dtype].cases += c.cases_; m[c.dtype].value += c.leakage; });
    return Object.values(m).sort((a, b) => b.value - a.value);
  }, [cells]);
  const byTier = useMemo(() => {
    const m = {};
    cells.forEach((c) => { m[c.tier] = m[c.tier] || { name: c.tier, value: 0 }; m[c.tier].value += c.leakage; });
    return Object.values(m);
  }, [cells]);
  const paretoRun = pareto.map((p) => ({ ...p, running: Number(p.running_pct) }));
  const maxFunnel = Math.max(...funnel.map((f) => f.n));
  const avgByType = useMemo(() =>
    byType.filter((t) => t.value > 0).map((t) => ({ ...t, avg: t.value / t.cases })).sort((a, b) => b.avg - a.avg),
    [byType]);
  const disputeByCourier = useMemo(() =>
    [...scorecard].map((s) => ({ courier_: s.courier_, dispute_pct: 100 * s.dispute, leakage: s.leakage })).sort((a, b) => b.dispute_pct - a.dispute_pct),
    [scorecard]);
  const treemapData = useMemo(() => {
    const byType = {};
    cells.forEach((c) => {
      (byType[c.dtype] = byType[c.dtype] || []).push({ name: c.tier, tier: c.tier, type: c.dtype, size: Math.round(c.leakage) });
    });
    return Object.entries(byType)
      .map(([dtype, children]) => ({ name: dtype, children: children.sort((a, b) => b.size - a.size) }))
      .sort((a, b) => b.children.reduce((s, x) => s + x.size, 0) - a.children.reduce((s, x) => s + x.size, 0));
  }, [cells]);
  const radarData = useMemo(() => {
    const defs = [
      { m: 'Reliability', f: (s) => s.reliability },
      { m: 'On-time %', f: (s) => 100 * s.ontime },
      { m: 'Clean %', f: (s) => 100 * (1 - s.dispute) },
      { m: 'No-phantom %', f: (s) => 100 * (1 - s.phantom) },
    ];
    return defs.map(({ m, f }) => ({ m, ...Object.fromEntries(scorecard.map((s) => [s.courier_, +f(s).toFixed(1)])) }));
  }, [scorecard]);
  const scatterGroups = useMemo(() => {
    const g = {};
    cells.forEach((c) => {
      (g[c.dtype] = g[c.dtype] || []).push({
        x: c.cases_, y: Math.round(c.avg_loss), z: Math.round(c.leakage),
        courier: c.courier_, tier: c.tier, dtype: c.dtype,
      });
    });
    return Object.entries(g).sort((a, b) =>
      b[1].reduce((s, p) => s + p.z, 0) - a[1].reduce((s, p) => s + p.z, 0));
  }, [cells]);
  return (
    <div>
      <div className="kpis">
        <div className="kpi hot"><span>Recoverable leakage</span><b><Count to={kpis.leakage_rs} fmt={rs} /></b></div>
        <div className="kpi"><span>Dispute rate</span><b><Count to={kpis.dispute_rate_pct} fmt={(v) => `${v.toFixed(1)}%`} /></b></div>
        <div className="kpi"><span>Disputed AWBs</span><b><Count to={kpis.disputed_awbs} fmt={num} /></b></div>
        <div className="kpi"><span>Avg DSO</span><b><Count to={kpis.avg_dso_days} fmt={(v) => `${v.toFixed(1)} days`} /></b></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Weekly leakage trend</h3>
          <p className="chart-sub">Rupees leaked per settlement week · right axis = disputed AWBs</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={trend} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gLeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.65} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.04} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
              <XAxis dataKey="wk" tickFormatter={(v) => v.slice(5)} minTickGap={40} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={AXIS} axisLine={false} tickLine={false} width={48} />
              <YAxis yAxisId="r" orientation="right" tick={AXIS} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n) => (n === 'disputes' ? [num(v), 'disputes'] : [rs(v), 'leakage'])} labelFormatter={(v) => `week of ${v}`} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area yAxisId="l" type="monotone" dataKey="leakage" name="leakage" stroke="#8b5cf6" strokeWidth={3} fill="url(#gLeak)" />
              <Line yAxisId="r" type="monotone" dataKey="disputes" name="disputes" stroke="#22d3ee" strokeWidth={2} dot={false} strokeDasharray="6 4" />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>Forecast (Ridge R²=0.32, +₹7k/week): {forecast.map((f) => `${f.wk.slice(5)} ${rs(f.leakage)}`).join(' → ')}</p>
          <AIAnalysis id="wh-trend" title="Weekly leakage trend with forecast" data={{ trend, forecast }} focus="Describe the trend and the riskiest weeks, judge whether leakage is rising structurally, and recommend when finance should escalate disputes." />
        </div>
        <div className="card">
          <h3>Pareto — leakage by courier</h3>
          <p className="chart-sub">Bars = rupees leaked · orange line = cumulative share</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={paretoRun} margin={{ top: 10, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
              <XAxis dataKey="courier_" interval={0} tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={AXIS} axisLine={false} tickLine={false} width={52} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={AXIS} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n) => (n === 'running' ? [`${v}%`, 'cumulative'] : [rs(v), 'leakage'])} />
              <Bar yAxisId="l" dataKey="leakage" name="leakage" radius={[10, 10, 4, 4]} maxBarSize={64}>
                {paretoRun.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
              <Line yAxisId="r" type="monotone" dataKey="running" name="cumulative" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3.5, fill: '#f59e0b' }} />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>Shiprocket ₹10.09L (45%) · Duplicates ₹9.08L top type · Overdue ₹7.72L.</p>
          <AIAnalysis id="wh-pareto" title="Pareto — leakage by courier with cumulative share" data={pareto} focus="Which couriers should be disputed first, what share of the Rs 22.3L does each represent, and what negotiation stance fits each?" />
        </div>
      </div>

      <div className="grid3">
        <div className="card">
          <h3>Leakage by type</h3>
          <p className="chart-sub">Share of ₹22.3L across 7 rules</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3} stroke="#ffffff" strokeWidth={3}>
                {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n, p) => [rs(v), `${p?.payload?.name} · ${((100 * v) / kpis.leakage_rs).toFixed(1)}%`]} />
              <Legend wrapperStyle={{ fontSize: 11.5, lineHeight: '20px' }} />
            </PieChart>
          </ResponsiveContainer>
          </div>
          <AIAnalysis id="wh-bytype" title="Leakage by discrepancy type" data={byType} focus="Rank the 7 rule types by recovery priority, explain the total-vs-average tradeoff, and split them into claim-now vs fix-the-process buckets." />
        </div>
        <div className="card">
          <h3>Leakage by tier</h3>
          <p className="chart-sub">Where geography hurts most</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byTier} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4} stroke="#ffffff" strokeWidth={3}>
                {byTier.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n, p) => [rs(v), `${p?.payload?.name} · ${((100 * v) / kpis.leakage_rs).toFixed(1)}%`]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>Tier-1 ₹8.74L · Tier-2 ₹6.95L · Tier-3 ₹6.65L.</p>
          <AIAnalysis id="wh-bytier" title="Leakage by city tier with GMV context" data={{ byTier, tiers }} focus="Which tier needs dispute claims vs preventive controls, and what should a Tier-2 city expansion budget for leakage and safeguards?" />
        </div>
        <div className="card">
          <h3>Reliability scorecard</h3>
          <p className="chart-sub">Higher = more reliable (volume-weighted)</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[...scorecard].sort((a, b) => b.reliability - a.reliability)} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" horizontal={false} />
              <XAxis type="number" domain={[55, 75]} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="courier_" width={88} tick={{ fill: '#334155', fontSize: 13 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n, p) => (n === 'reliability' ? [Number(v).toFixed(1), `score · ${p?.payload?.courier_}`] : v)} />
              <Bar dataKey="reliability" name="score" radius={[4, 10, 10, 4]} maxBarSize={26}>
                {[...scorecard].sort((a, b) => b.reliability - a.reliability).map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          <AIAnalysis id="wh-scorecard" title="Courier reliability scorecard" data={scorecard} focus="Which courier deserves more volume, which needs an audit or de-prioritisation, balancing reliability score against total leakage?" />
        </div>
      </div>

      

      <div className="grid2">
        <div className="card">
          <h3>Average leakage per case, by type</h3>
          <p className="chart-sub">Which rule gives the biggest recovery per claim filed</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={avgByType} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke="#e8edf5" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="name" width={168} tick={{ fill: '#334155', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n, p) => (n === 'avg' ? [rs(v), `avg/case · ${p?.payload?.cases} cases`] : v)} />
              <Bar dataKey="avg" name="avg" radius={[4, 10, 10, 4]} maxBarSize={22}>
                {avgByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          <AIAnalysis id="wh-avgloss" title="Average leakage per case by discrepancy type" data={avgByType} focus="In what order should the finance team file claims to maximise recovery per unit of effort, and which types need process fixes instead?" />
        </div>
        <div className="card">
          <h3>Dispute rate by courier</h3>
          <p className="chart-sub">Share of each courier's AWBs that end disputed</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={disputeByCourier} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid stroke="#e8edf5" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 45]} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="courier_" width={88} tick={{ fill: '#334155', fontSize: 13 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n, p) => [`${Number(v).toFixed(1)}% · ${rs(p?.payload?.leakage)}`, 'dispute rate']} />
              <Bar dataKey="dispute_pct" name="dispute %" radius={[4, 10, 10, 4]} maxBarSize={26}>
                {disputeByCourier.map((_, i) => <Cell key={i} fill={i === 0 ? '#ef4444' : '#3b82f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          <AIAnalysis id="wh-dispute-rate" title="Dispute rate by courier" data={disputeByCourier} focus="Which courier is a frequency problem vs a severity problem, and what concrete routing or penalty action fits each courier?" />
        </div>
      </div>

      <div className="card">
        <h3>Claim value vs volume — every RCA cell</h3>
        <p className="chart-sub">Each bubble is a courier × tier × type cell · x = cases · y = avg loss · size = total leakage</p>
        <div className="chart-box">
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis type="number" dataKey="x" name="cases" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
            <YAxis type="number" dataKey="y" name="avg loss" tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
            <ZAxis type="number" dataKey="z" range={[50, 500]} name="leakage" />
            <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }} content={<ScatterTip />} />
            <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 8 }} />
            {scatterGroups.map(([dtype, pts], i) => (
              <Scatter key={dtype} name={dtype} data={pts} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.75} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        </div>
        <AIAnalysis id="wh-scatter" title="Bubble scatter of RCA cells by case count and average loss" data={scatterGroups.slice(0, 4).flatMap(([, pts]) => pts).sort((a, b) => b.z - a.z).slice(0, 40)} focus="Which cells are high-value low-volume claims versus high-volume process problems, and what action fits each cluster?" />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Funnel — orders → disputes</h3>
          <p className="chart-sub">23.1% of settled AWBs end disputed</p>
          {funnel.map((f) => (
            <div className="funnel-row" key={f.stage}>
              <span>{f.stage}</span>
              <div className="funnel-bar"><div style={{ width: `${(100 * f.n) / maxFunnel}%` }} /></div>
              <b>{num(f.n)}</b>
            </div>
          ))}
          <h3 className="sub-h">Tier entry math</h3>
          <table className="tbl"><thead><tr><th>Tier</th><th>Orders</th><th>Leakage % GMV</th></tr></thead>
            <tbody>{tiers.map((t) => <tr key={t.tier}><td>{t.tier}</td><td>{num(t.orders_)}</td><td>{(100 * t.leakage / t.gmv).toFixed(2)}%</td></tr>)}</tbody></table>
          <AIAnalysis id="wh-funnel" title="Funnel from orders to disputes with tier entry math" data={{ funnel, tiers }} focus="What does this funnel conversion imply for how a company should design its reconciliation process and Tier-2 expansion controls?" />
        </div>
        <div className="card">
          <h3>Courier scorecard (detail)</h3>
          <p className="chart-sub">Rank · dispute % · rupees leaked</p>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>#</th><th>Courier</th><th>Score</th><th>Dispute %</th><th>Leakage</th></tr></thead>
            <tbody>{scorecard.map((s) => <tr key={s.courier_}><td>{s.rank}</td><td>{s.courier_}</td><td><b>{Number(s.reliability).toFixed(1)}</b></td><td>{(100 * s.dispute).toFixed(1)}%</td><td>{rs(s.leakage)}</td></tr>)}</tbody></table></div>
          <h3 className="sub-h">Merchant health (top by GMV)</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Merchant</th><th>Cat</th><th>Orders</th><th>Health</th></tr></thead>
            <tbody>{merchants.slice(0, 8).map((m) => <tr key={m.merchant_}><td>{m.merchant_}</td><td>{m.category}</td><td>{m.orders_}</td><td><span className={`pill ${m.health}`}>{m.health}</span></td></tr>)}</tbody></table></div>
          <AIAnalysis id="wh-merchants" title="Merchant health of top merchants by GMV" data={merchants.slice(0, 10)} focus="Which merchants need attention first given leakage, dispute rate and health flags, and what should the account team do for each?" />
        </div>
      </div>

      <RcaWorkbench cells={cells} />
    </div>
  );
}

/* ---------------- Analyse: Olist ---------------- */
function Olist({ d }) {
  const o = d.olist;
  const monthly = d.olistMonthly;
  const reviews = useMemo(() => {
    const m = { 'On-time': { flag: 'On-time', Bad: 0, Good: 0 }, Late: { flag: 'Late', Bad: 0, Good: 0 } };
    d.olistReviews.forEach((r) => { const k = r.late_flag === 'Late' ? 'Late' : 'On-time'; m[k][r.sentiment] = Number(r.orders_); });
    return Object.values(m);
  }, [d]);
  const liftNum = 100 * (o.bad_review_late - o.bad_review_ontime);
  const reviewMix = useMemo(() => d.olistReviews
    .map((r) => ({ name: `${r.late_flag === 'Late' ? 'Late' : 'On-time'} · ${r.sentiment}`, value: +r.orders_ }))
    .sort((a, b) => b.value - a.value), [d]);
  const MIX_COLORS = { 'On-time · Good': '#10b981', 'On-time · Bad': '#f59e0b', 'Late · Bad': '#ef4444', 'Late · Good': '#94a3b8' };
  return (
    <div>
      <div className="real-strip">Same 7-rule logic, real 99,441 Brazilian e-commerce orders — SLA moves CSAT.</div>
      <div className="kpis">
        <div className="kpi hot"><span>Late rate (ETA-breach analogue)</span><b><Count to={100 * o.late_rate} fmt={(v) => `${v.toFixed(1)}%`} /></b></div>
        <div className="kpi"><span>Bad reviews: late vs on-time</span><b><Count to={100 * o.bad_review_late} fmt={(v) => `${v.toFixed(1)}%`} /> / <Count to={100 * o.bad_review_ontime} fmt={(v) => `${v.toFixed(1)}%`} /></b></div>
        <div className="kpi"><span>Lift</span><b><Count to={liftNum} fmt={(v) => `+${v.toFixed(1)} pp`} /></b></div>
        <div className="kpi"><span>Sellers scored · worst late</span><b><Count to={o.sellers_scored} fmt={(v) => `${Math.round(v)}`} /> · <Count to={100 * o.worst_seller_late_rate} fmt={(v) => `${v.toFixed(1)}%`} /></b></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Monthly orders vs late orders</h3>
          <p className="chart-sub">Volume bars · red line = late deliveries (seasonality spikes)</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 10, right: 8, left: 4, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
              <XAxis dataKey="ym" tickFormatter={(v) => v.slice(2)} minTickGap={36} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} />
              <Tooltip contentStyle={DARK_TIP} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="orders" name="orders" fill="#3b82f6" radius={[8, 8, 4, 4]} maxBarSize={38} />
              <Line type="monotone" dataKey="late" name="late orders" stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444' }} />
              <Line type="monotone" dataKey="avg_late_days" name="avg days late" stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="6 4" />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
          <AIAnalysis id="olist-monthly" title="Olist monthly orders vs late orders with average days late" data={monthly} focus="When do late deliveries spike, does lateness get deeper or just broader at peaks, and what capacity action follows?" />
        </div>
        <div className="card">
          <h3>Late → bad reviews</h3>
          <p className="chart-sub">Stacked counts · late buyers rate badly far more often</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reviews} margin={{ top: 10, right: 8, left: 4, bottom: 0 }} barCategoryGap="32%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
              <XAxis dataKey="flag" tick={{ fill: '#334155', fontSize: 13 }} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v) => num(v)} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="Bad" stackId="a" name="bad reviews" fill="#ef4444" maxBarSize={72} />
              <Bar dataKey="Good" stackId="a" name="good reviews" fill="#10b981" radius={[10, 10, 4, 4]} maxBarSize={72} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>Late: 4,994 bad of 7,633 · On-time: 15,087 bad of 87,966 (χ²=9833, p≈0).</p>
          <AIAnalysis id="olist-reviews" title="Olist review impact of late delivery" data={reviews} focus="Quantify how much lateness hurts reviews in absolute orders, suggest an SLA target, and estimate the review saving from halving late deliveries." />
        </div>
      </div>

      <div className="grid2">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3>Worst sellers by late rate</h3>
          <p className="chart-sub">Scorecard analogue · top 15 of 462 sellers</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={d.olistSellers} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" horizontal={false} />
              <XAxis type="number" domain={[0, 0.35]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="seller" width={76} tick={{ fill: '#334155', fontSize: 11.5 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n, p) => [`${(100 * v).toFixed(1)}% · ${p?.payload?.orders} orders`, 'late rate']} />
              <Bar dataKey="late_rate" name="late rate" radius={[4, 10, 10, 4]} maxBarSize={20}>
                {d.olistSellers.map((_, i) => <Cell key={i} fill={i < 3 ? '#ef4444' : '#f59e0b'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          <AIAnalysis id="olist-sellers" title="Worst Olist sellers by late rate" data={d.olistSellers} focus="Which sellers should be warned, supported or delisted first, and is the tail a coaching problem or a delist problem?" />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Review mix — all 99k orders</h3>
          <p className="chart-sub">Size = orders · colour = lateness × sentiment</p>
          <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={reviewMix} dataKey="value" nameKey="name" innerRadius={64} outerRadius={98} paddingAngle={3} stroke="#ffffff" strokeWidth={3}>
                {reviewMix.map((r) => <Cell key={r.name} fill={MIX_COLORS[r.name] || '#64748b'} />)}
              </Pie>
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n, p) => [`${num(v)} orders · ${((100 * v) / o.orders).toFixed(1)}%`, p?.payload?.name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          </div>
          <AIAnalysis id="olist-mix" title="Olist review mix donut across lateness and sentiment" data={reviewMix} focus="What share of all reviews comes from late buyers, and what does that imply for how much delivery investment is justified?" />
        </div>
        <div className="card">
          <h3>Settlement analogues on real data</h3>
          <table className="tbl"><tbody>
            <tr><td>Late delivery (ETA breach)</td><td><b>8.1%</b> · avg 9.6 days late · {num(o.late_n)} orders</td></tr>
            <tr><td>Payment-vs-bill mismatch</td><td><b>249 orders</b> (0.25%) · R$3,262</td></tr>
            <tr><td>Freight outliers</td><td><b>983 orders</b> freight &gt; 146% of price</td></tr>
            <tr><td>Review impact</td><td><b>65.3% bad late vs 17.2% on-time</b></td></tr>
          </tbody></table>
          <p className="why">Why it matters: the warehouse + rules + stats port directly to company CSVs with the same columns. Olist is the proof.</p>
          <AIAnalysis id="olist-analogues" title="Settlement analogues on real Olist data" data={{ late_rate: o.late_rate, mismatch_orders: 249, freight_outliers: o.freight_outliers, bad_review_late: o.bad_review_late, bad_review_ontime: o.bad_review_ontime }} focus="How do these real-data patterns validate running the same warehouse and 7-rule approach on company courier data?" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- App shell ---------------- */
export default function App() {
  const d = useData();
  const [page, setPage] = useState('home');
  const [ds, setDs] = useState('warehouse');
  const dockOpen = useDockOpen();
  const goAnalyse = (which) => { setDs(which || 'warehouse'); setPage('analyse'); window.scrollTo(0, 0); };
  if (!d) return <div className="loading">Loading Courier-Analytic…</div>;
  if (d.error) return <div className="loading">Could not load data/*.json — run the site from dashboard/ build.</div>;
  return (
    <div className={dockOpen ? 'app dock-open' : 'app'}>
      <nav className="nav">
        <div className="nav-in">
          <button className="logo" onClick={() => setPage('home')}>◈ Courier-Analytic</button>
          <div className="nav-links">
            <button className={page === 'home' ? 'on' : ''} onClick={() => setPage('home')}>Overview</button>
            <button className={page === 'analyse' ? 'on' : ''} onClick={() => goAnalyse('warehouse')}>Analyse</button>
            <span className="nav-tag">₹22.3L · 25k + 99k orders</span>
          </div>
        </div>
      </nav>
      <main className="wrap">
        {page === 'home'
          ? <Landing d={d} goAnalyse={goAnalyse} />
          : (
            <div>
              <div className="tabs">
                <button className={ds === 'warehouse' ? 'on' : ''} onClick={() => setDs('warehouse')}>Warehouse · synthetic 25k</button>
                <button className={ds === 'olist' ? 'on' : ''} onClick={() => setDs('olist')}>Real data · Olist 99k</button>
              </div>
              {ds === 'warehouse' ? <Warehouse d={d} /> : <Olist d={d} />}
            </div>
          )}
        <footer className="foot">
          Courier-Analytic · MSSQL star schema + sp_reconcile_batch (7 rules) + Kafka KRaft + Python stats ·
          PowerBI <code>powerbi/Courier-Analytic.pbix</code> · Same warehouse runs on real company CSVs.
        </footer>
      </main>
      <AIDock />
    </div>
  );
}
