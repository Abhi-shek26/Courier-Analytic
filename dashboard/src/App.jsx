import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

const get = (f) => fetch(`data/${f}`).then((r) => r.json());
const rs = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function useData() {
  const [d, setD] = useState({});
  useEffect(() => {
    Promise.all(['kpis.json', 'trend.json', 'pareto.json', 'funnel.json',
      'scorecard.json', 'rca_cells.json', 'merchants.json', 'tier_entry.json']
      .map(get)).then(([kpis, trend, pareto, funnel, scorecard, cells, merchants, tiers]) =>
      setD({ kpis, trend, pareto, funnel, scorecard, cells, merchants, tiers }));
  }, []);
  return d;
}

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
      <h3>RCA Workbench — where is the money leaking?</h3>
      <div className="filters">
        <label>Courier <select value={courier} onChange={(e) => setCourier(e.target.value)}>
          {couriers.map((c) => <option key={c}>{c}</option>)}
        </select></label>
        <label>Tier <select value={tier} onChange={(e) => setTier(e.target.value)}>
          {['all', 'Tier-1', 'Tier-2', 'Tier-3'].map((t) => <option key={t}>{t}</option>)}
        </select></label>
      </div>
      {top && (
        <p className="why">
          5-Why read: leakage concentrates in <b>{top.courier_} × {top.tier} × {top.dtype}</b> —{' '}
          {top.cases_} cases, {rs(top.leakage)}. Fix this cell first; it is the
          largest explainable chunk of the {courier === 'all' ? 'overall' : courier} drop.
        </p>
      )}
      <table>
        <thead><tr><th>Courier</th><th>Tier</th><th>Type</th><th>Cases</th><th>Leakage</th><th>Avg loss</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td>{r.courier_}</td><td>{r.tier}</td><td>{r.dtype}</td>
            <td>{r.cases_}</td><td>{rs(r.leakage)}</td><td>{rs(r.avg_loss)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function App() {
  const { kpis, trend, pareto, funnel, scorecard, cells, merchants, tiers } = useData();
  if (!kpis) return <div className="loading">Loading Courier-Analytic…</div>;
  return (
    <div className="wrap">
      <header>
        <h2>Courier-Analytic — COD Leakage RCA</h2>
        <p>25k shipments · 90 days · MSSQL + Kafka + Python validated</p>
      </header>

      <div className="kpis">
        <div className="kpi hot"><span>Recoverable leakage</span><b>{rs(kpis.leakage_rs)}</b></div>
        <div className="kpi"><span>Dispute rate</span><b>{kpis.dispute_rate_pct}%</b></div>
        <div className="kpi"><span>Disputed AWBs</span><b>{kpis.disputed_awbs.toLocaleString('en-IN')}</b></div>
        <div className="kpi"><span>Avg DSO</span><b>{kpis.avg_dso_days} days</b></div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Weekly leakage trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="wk" tickFormatter={(v) => v.slice(5)} minTickGap={30} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => rs(v)} />
              <Line type="monotone" dataKey="leakage" stroke="#6b46c1" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Pareto — leakage by courier</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pareto}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="courier_" interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => rs(v)} />
              <Bar dataKey="leakage" fill="#2b6cb0" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Funnel — orders to disputes</h3>
          <table><tbody>{funnel.map((f) => (
            <tr key={f.stage}><td>{f.stage}</td><td><b>{f.n.toLocaleString('en-IN')}</b></td></tr>
          ))}</tbody></table>
          <h3 style={{ marginTop: 16 }}>Tier entry math (expansion case input)</h3>
          <table><thead><tr><th>Tier</th><th>Orders</th><th>Leakage % GMV</th><th>Avg delay</th></tr></thead>
            <tbody>{tiers.map((t) => (
              <tr key={t.tier}><td>{t.tier}</td><td>{t.orders_.toLocaleString('en-IN')}</td>
                <td>{(100 * t.leakage / t.gmv).toFixed(2)}%</td><td>{t.delay?.toFixed(1)}h</td></tr>
            ))}</tbody></table>
        </div>
        <div className="card">
          <h3>Courier reliability scorecard</h3>
          <table><thead><tr><th>#</th><th>Courier</th><th>Score</th><th>Dispute %</th><th>Leakage</th></tr></thead>
            <tbody>{scorecard.map((s) => (
              <tr key={s.courier_}><td>{s.rank}</td><td>{s.courier_}</td><td><b>{s.reliability.toFixed(1)}</b></td>
                <td>{(100 * s.dispute).toFixed(1)}%</td><td>{rs(s.leakage)}</td></tr>
            ))}</tbody></table>
        </div>
      </div>

      <RcaWorkbench cells={cells} />

      <div className="card">
        <h3>Merchant health (top by GMV)</h3>
        <table><thead><tr><th>Merchant</th><th>Category</th><th>Orders</th><th>Health</th><th>Quartile</th></tr></thead>
          <tbody>{merchants.slice(0, 10).map((m) => (
            <tr key={m.merchant_}><td>{m.merchant_}</td><td>{m.category}</td>
              <td>{m.orders_}</td><td>{m.health}</td><td>{m.value_quartile}</td></tr>
          ))}</tbody></table>
      </div>
    </div>
  );
}
