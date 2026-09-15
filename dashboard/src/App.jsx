import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Legend,
} from 'recharts';

const get = (f) => fetch(`data/${f}`).then((r) => r.json());
const rs = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const num = (n) => Number(n).toLocaleString('en-IN');

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
const DARK_TIP = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: 12 };

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
            <div><b>{rs(k.leakage_rs)}</b><span>leakage caught</span></div>
            <div><b>{num(k.disputed_awbs)}</b><span>disputed AWBs ({k.dispute_rate_pct}%)</span></div>
            <div><b>{num(k.settled_awbs)}</b><span>shipments · 90 days</span></div>
            <div><b>{k.avg_dso_days}d</b><span>avg DSO</span></div>
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
        <h2>How it works</h2>
        <div className="pipe">
          <div><b>CSV seed</b><span>25k orders + 25k settlements, deterministic signals</span></div>
          <div><b>MSSQL warehouse</b><span>star schema · 8 tables · CourierAnalytic</span></div>
          <div><b>7-rule engine</b><span>sp_reconcile_batch, idempotent → fact_discrepancies</span></div>
          <div><b>Kafka</b><span>discrepancy.events · KRaft · localhost:29092</span></div>
          <div><b>Python stats</b><span>t-test · χ² · scorecard · Ridge forecast</span></div>
          <div><b>Serve</b><span>React dashboard + PowerBI (7 CSVs · 12 DAX)</span></div>
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
          <button className="btn primary" onClick={() => goAnalyse('warehouse')}>Start analysing →</button>
        </div>
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
  return (
    <div>
      <div className="kpis">
        <div className="kpi hot"><span>Recoverable leakage</span><b>{rs(kpis.leakage_rs)}</b></div>
        <div className="kpi"><span>Dispute rate</span><b>{kpis.dispute_rate_pct}%</b></div>
        <div className="kpi"><span>Disputed AWBs</span><b>{num(kpis.disputed_awbs)}</b></div>
        <div className="kpi"><span>Avg DSO</span><b>{kpis.avg_dso_days} days</b></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Weekly leakage trend · 25k settlements</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <defs><linearGradient id="gLeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.7} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="wk" tickFormatter={(v) => v.slice(5)} minTickGap={32} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v) => rs(v)} />
              <Area type="monotone" dataKey="leakage" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gLeak)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="muted">Forecast (Ridge R²=0.32, +₹7k/week): {forecast.map((f) => `${f.wk.slice(5)} ${rs(f.leakage)}`).join(' → ')}</p>
        </div>
        <div className="card">
          <h3>Pareto — leakage by courier + cumulative %</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={paretoRun}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="courier_" interval={0} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="l" tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v, n) => (n === 'running' ? `${v}%` : rs(v))} />
              <Bar yAxisId="l" dataKey="leakage" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              <Line yAxisId="r" type="monotone" dataKey="running" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="muted">Shiprocket ₹10.09L (45%) · Duplicates ₹9.08L top type · Overdue ₹7.72L.</p>
        </div>
      </div>

      <div className="grid3">
        <div className="card">
          <h3>Leakage by type</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart><Pie data={byType} dataKey="value" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={2}>
              {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie><Tooltip contentStyle={DARK_TIP} formatter={(v) => rs(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Leakage by tier</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart><Pie data={byTier} dataKey="value" nameKey="name" innerRadius={52} outerRadius={85} paddingAngle={3}>
              {byTier.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
            </Pie><Tooltip contentStyle={DARK_TIP} formatter={(v) => rs(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
          </ResponsiveContainer>
          <p className="muted">Tier-1 ₹8.74L · Tier-2 ₹6.95L · Tier-3 ₹6.65L.</p>
        </div>
        <div className="card">
          <h3>Reliability scorecard</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={[...scorecard].sort((a, b) => b.reliability - a.reliability)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" domain={[55, 75]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="courier_" width={80} tick={{ fill: '#e2e8f0', fontSize: 12 }} />
              <Tooltip contentStyle={DARK_TIP} />
              <Bar dataKey="reliability" fill="#10b981" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Funnel — orders → disputes</h3>
          {funnel.map((f) => (
            <div className="funnel-row" key={f.stage}>
              <span>{f.stage}</span>
              <div className="funnel-bar"><div style={{ width: `${(100 * f.n) / maxFunnel}%` }} /></div>
              <b>{num(f.n)}</b>
            </div>
          ))}
          <h3 style={{ marginTop: 14 }}>Tier entry math</h3>
          <table className="tbl"><thead><tr><th>Tier</th><th>Orders</th><th>Leakage % GMV</th></tr></thead>
            <tbody>{tiers.map((t) => <tr key={t.tier}><td>{t.tier}</td><td>{num(t.orders_)}</td><td>{(100 * t.leakage / t.gmv).toFixed(2)}%</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <h3>Courier scorecard (detail)</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>#</th><th>Courier</th><th>Score</th><th>Dispute %</th><th>Leakage</th></tr></thead>
            <tbody>{scorecard.map((s) => <tr key={s.courier_}><td>{s.rank}</td><td>{s.courier_}</td><td><b>{Number(s.reliability).toFixed(1)}</b></td><td>{(100 * s.dispute).toFixed(1)}%</td><td>{rs(s.leakage)}</td></tr>)}</tbody></table></div>
          <h3 style={{ marginTop: 14 }}>Merchant health (top by GMV)</h3>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Merchant</th><th>Cat</th><th>Orders</th><th>Health</th></tr></thead>
            <tbody>{merchants.slice(0, 8).map((m) => <tr key={m.merchant_}><td>{m.merchant_}</td><td>{m.category}</td><td>{m.orders_}</td><td><span className={`pill ${m.health}`}>{m.health}</span></td></tr>)}</tbody></table></div>
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
  const lift = (100 * (o.bad_review_late - o.bad_review_ontime)).toFixed(1);
  return (
    <div>
      <div className="real-strip">Same 7-rule logic, real 99,441 Brazilian e-commerce orders — SLA moves CSAT.</div>
      <div className="kpis">
        <div className="kpi hot"><span>Late rate (ETA-breach analogue)</span><b>{(100 * o.late_rate).toFixed(1)}%</b></div>
        <div className="kpi"><span>Bad reviews: late vs on-time</span><b>{(100 * o.bad_review_late).toFixed(1)}% / {(100 * o.bad_review_ontime).toFixed(1)}%</b></div>
        <div className="kpi"><span>Lift</span><b>+{lift} pp</b></div>
        <div className="kpi"><span>Sellers scored · worst late</span><b>{o.sellers_scored} · {(100 * o.worst_seller_late_rate).toFixed(1)}%</b></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Monthly orders vs late orders (seasonality spikes)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="ym" tickFormatter={(v) => v.slice(2)} minTickGap={28} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={DARK_TIP} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="orders" name="orders" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="late" name="late orders" stroke="#ef4444" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Late → bad reviews (stacked)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={reviews}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="flag" tick={{ fill: '#e2e8f0', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={DARK_TIP} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Bad" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Good" stackId="a" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="muted">Late: 4,994 bad of 7,633 · On-time: 15,087 bad of 87,966 (χ²=9833, p≈0).</p>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Worst sellers by late rate (scorecard analogue)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.olistSellers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" domain={[0, 0.35]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="seller" width={70} tick={{ fill: '#e2e8f0', fontSize: 11 }} />
              <Tooltip contentStyle={DARK_TIP} formatter={(v) => `${(100 * v).toFixed(1)}%`} />
              <Bar dataKey="late_rate" fill="#f59e0b" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
  const goAnalyse = (which) => { setDs(which || 'warehouse'); setPage('analyse'); window.scrollTo(0, 0); };
  if (!d) return <div className="loading">Loading Courier-Analytic…</div>;
  if (d.error) return <div className="loading">Could not load data/*.json — run the site from dashboard/ build.</div>;
  return (
    <div className="app">
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
    </div>
  );
}
