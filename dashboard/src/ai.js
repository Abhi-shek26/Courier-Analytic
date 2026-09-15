/* AI copilot for Courier-Analytic charts.
   Key lives in dashboard/.env as VITE_GEMINI_API_KEY (git-ignored, never
   committed) and applies to the entire project. Results are cached per
   chart in localStorage. */

const CACHE_PREFIX = 'courier-analytic-ai-cache:';

const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
/* Lite first (fewer overloads on free tier), full Flash as fallback. */
const MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

export const PROJECT_CONTEXT = `You are the analytics copilot for Courier-Analytic, a COD settlement reconciliation and leakage-RCA system for e-commerce logistics.

What the project is: a shopkeeper ships parcels via couriers (Shiprocket, Delhivery, Bluedart, Kwikship, DTDC). Couriers collect cash on delivery and later settle money back minus charges. The system compares courier settlement files against shop order records, catches mismatches, prices each in rupees, and explains where money leaks.

How it works: (1) 25k orders + 25k settlements in an MSSQL star-schema warehouse (CourierAnalytic). (2) A 7-rule engine (stored procedure sp_reconcile_batch, idempotent) flags COD_SHORT_REMITTANCE, WEIGHT_DISPUTE, PHANTOM_RTO_CHARGE, OVERDUE_REMITTANCE (>14d DSO), DUPLICATE_SETTLEMENT, ETA_SLA_BREACH, EXCESS_FORWARD_CHARGE — each with rupee variance and HIGH/MEDIUM/LOW severity. (3) Python statistics (Welch t-test, chi-square, courier reliability scorecard, Ridge leakage forecast) separate signals from noise. (4) Kafka streams discrepancy.events; React dashboard + PowerBI serve decisions.

Headline facts: Rs 22.3 lakh leakage across 5,774 disputed AWBs (23.1%) over 90 days. Duplicates Rs 9.08L and overdue Rs 7.72L dominate. Shiprocket leaks most (Rs 10.09L, 45%) yet scores most reliable (72.2); DTDC scores worst (63.7) with ~40% dispute rate. Bluedart Tier-3 weight inflation +12.98% (p~6e-256); festival weeks dispute 36.7% vs 21.8% (chi2 p~2e-56). Forecast: +Rs 7k/week trend (Ridge R2=0.32). A second dataset — Olist, 99,441 real Brazilian e-commerce orders — validates the same logic: 8.1% late, late orders get 65.3% bad reviews vs 17.2% on-time.

The same warehouse, rules, queries and stats run on real company courier CSVs with the same columns (about 80% transfers directly); the rest is hardening (API ingestion, rate cards, auth, managed Kafka, dispute-recovery loop).`;

export async function analyzeChart({ chartId, chartTitle, data, focus, force }) {
  if (!API_KEY) throw new Error('no-key');
  const payload = JSON.stringify(data);
  const cacheKey = CACHE_PREFIX + chartId;
  if (!force) {
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey));
      if (c && c.payload === hash(payload)) return { text: c.text, cached: true };
    } catch { /* miss */ }
  }
  let res;
  let lastErr = new Error('HTTP 503');
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: 450,
            messages: [
              { role: 'system', content: PROJECT_CONTEXT },
              {
                role: 'user',
                content: `Chart: ${chartTitle}\nChart data (JSON):\n${payload}\nTask: ${focus}\nRespond in exactly three short sections titled 'What it shows', 'Why it matters', 'Recommended action'. Under 140 words total. Format rupees like Rs 10.09L and percents with one decimal.`,
              },
            ],
          }),
        });
      } catch {
        lastErr = new Error('network/cors');
        break; // connectivity issue — other model won't help
      }
      if (res.ok) {
        const j = await res.json();
        const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').trim() || 'No response.';
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ payload: hash(payload), text }));
        } catch { /* storage full — ignore */ }
        return { text, cached: false };
      }
      lastErr = new Error(`HTTP ${res.status}`);
      if (res.status === 429 || res.status === 401 || res.status === 403) throw lastErr; // quota/auth — don't retry
      if (res.status === 503 && attempt === 0) { await sleep(2000); continue; } // transient overload — one retry
      break; // try next model on 5xx / model errors
    }
  }
  throw lastErr;
}
