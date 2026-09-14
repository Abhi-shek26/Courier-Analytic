// Deterministic 25k seeder — seeded RNG, tiered signals for RCA stories.
// Run: npm run generate  → writes CSVs to ./output/
// Intentional signals (do NOT randomize away):
//  - Bluedart x Tier-3 → weight inflation 18-32%
//  - Shiprocket x festival week → settlement delay 18-28d (overdue)
//  - Delhivery x COD>3000 → settled 92-97% (COD short)
//  - DELIVERED subset → phantom RTO ₹100-250
//  - Kwikship x Tier-3 → ETA breach 1.4x-2x
//  - DTDC → forward charge 1.2x slab
//  - 1% duplicate AWB across batches
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) =>
  a.startsWith('--') ? [a.slice(2), arr[i + 1]] : []).filter(Boolean));
const N_ORDERS = parseInt(args.orders || '25000', 10);
const N_DAYS = parseInt(args.days || '90', 10);

const couriers = [
  { courier_id: 1, courier_name: 'Delhivery', base_rate_rs: 45, sla_hours: 72 },
  { courier_id: 2, courier_name: 'Bluedart', base_rate_rs: 68, sla_hours: 48 },
  { courier_id: 3, courier_name: 'Shiprocket', base_rate_rs: 38, sla_hours: 96 },
  { courier_id: 4, courier_name: 'DTDC', base_rate_rs: 40, sla_hours: 96 },
  { courier_id: 5, courier_name: 'Kwikship', base_rate_rs: 35, sla_hours: 72 },
];
const geos = [
  { geo_id: 1, city: 'Mumbai', tier: 'Tier-1', zone: 'West' },
  { geo_id: 2, city: 'Delhi', tier: 'Tier-1', zone: 'North' },
  { geo_id: 3, city: 'Pune', tier: 'Tier-2', zone: 'West' },
  { geo_id: 4, city: 'Indore', tier: 'Tier-2', zone: 'Central' },
  { geo_id: 5, city: 'Jaipur', tier: 'Tier-3', zone: 'North' },
  { geo_id: 6, city: 'Lucknow', tier: 'Tier-3', zone: 'North' },
];
const cats = ['Grocery', 'Food', 'Pharmacy', 'D2C'];
const merchants = Array.from({ length: 20 }, (_, i) => ({
  merchant_id: `M-${String(i + 1).padStart(3, '0')}`,
  merchant_name: `Merchant-${i + 1}`,
  category: cats[i % cats.length],
}));

const today = new Date();
today.setHours(0, 0, 0, 0);
const dayISO = (d) => d.toISOString().slice(0, 10);
// Festival week = 30..37 days ago (Diwali-like spike)
const isFestival = (orderDate) => {
  const diff = Math.floor((today - orderDate) / 86400000);
  return diff >= 30 && diff <= 37;
};
const slab = (w) => (w <= 1 ? 42 : w <= 3 ? 65 : 95);

const outDir = path.join(__dirname, 'output');
fs.mkdirSync(outDir, { recursive: true });

const orderRows = ['order_id,awb_number,courier_id,merchant_id,geo_id,order_date,delivery_date,order_status,payment_mode,cod_amount,declared_weight,order_value,promised_eta_hrs,actual_eta_hrs'];
const settleRows = ['settlement_id,awb_number,batch_id,courier_id,settlement_date,settled_cod,charged_weight,forward_charge,rto_charge,cod_fee'];
const batches = ['BATCH-A', 'BATCH-B', 'BATCH-C', 'BATCH-D'];

let dupCount = 0;
for (let i = 0; i < N_ORDERS; i++) {
  const courier = pick(couriers);
  const geo = pick(geos);
  const merchant = pick(merchants);
  const daysAgo = Math.floor(rand() * N_DAYS);
  const orderDate = new Date(today.getTime() - daysAgo * 86400000);
  const delivered = rand() > 0.28;
  const status = delivered ? 'DELIVERED' : pick(['RTO', 'IN_TRANSIT', 'LOST']);
  const prepaid = rand() > 0.55;
  const cod = prepaid ? 0 : Math.floor(400 + rand() * 5600);
  const declW = +(0.4 + rand() * 8).toFixed(3);
  const orderVal = cod > 0 ? cod : Math.floor(300 + rand() * 4000);
  const promised = courier.sla_hours;
  let actual = delivered ? promised * (0.6 + rand() * 0.6) : '';
  // Kwikship Tier-3 ETA breach signal
  if (courier.courier_name === 'Kwikship' && geo.tier === 'Tier-3' && delivered && rand() < 0.45) {
    actual = promised * (1.4 + rand() * 0.6);
  }
  const awb = `AWB${String(100000 + i)}`;
  const orderId = `ORD${String(100000 + i)}`;
  const delDate = delivered ? dayISO(new Date(orderDate.getTime() + (actual || promised) * 3600000)) : '';
  orderRows.push([orderId, awb, courier.courier_id, merchant.merchant_id, geo.geo_id,
    dayISO(orderDate), delDate, status, prepaid ? 'Prepaid' : 'COD',
    cod, declW, orderVal, promised, actual === '' ? '' : (+actual).toFixed(1)].join(','));

  // ---- settlement side with signals ----
  let settled = cod;
  let charged = declW;
  let rto = status === 'RTO' ? Math.floor(50 + rand() * 150) : 0;
  let fwd = slab(declW);
  let settleDelay = 2 + Math.floor(rand() * 8);

  if (courier.courier_name === 'Bluedart' && geo.tier === 'Tier-3' && rand() < 0.55) {
    charged = +(declW * (1.18 + rand() * 0.14)).toFixed(3); // 18-32% inflation
  }
  if (courier.courier_name === 'Delhivery' && cod > 3000 && rand() < 0.5) {
    settled = Math.floor(cod * (0.92 + rand() * 0.05)); // 92-97%
  }
  if (status === 'DELIVERED' && rand() < 0.09) {
    rto = Math.floor(100 + rand() * 150); // phantom
  }
  if (isFestival(orderDate) && courier.courier_name === 'Shiprocket') {
    settleDelay = 18 + Math.floor(rand() * 10); // overdue spike
  }
  if (courier.courier_name === 'DTDC' && rand() < 0.35) {
    fwd = Math.floor(slab(declW) * 1.2); // excess forward
  }
  const settleDate = new Date(orderDate.getTime() + settleDelay * 86400000);
  const fee = cod > 0 ? Math.floor(cod * 0.02) : 0;
  settleRows.push([`STL${String(100000 + i)}`, awb, pick(batches), courier.courier_id,
    dayISO(settleDate), settled, charged, fwd, rto, fee].join(','));

  // 1% duplicate: same AWB second batch
  if (rand() < 0.01) {
    dupCount++;
    settleRows.push([`STL9${String(100000 + i)}`, awb, 'BATCH-DUP', courier.courier_id,
      dayISO(settleDate), settled, charged, fwd, rto, fee].join(','));
  }
}

fs.writeFileSync(path.join(outDir, 'dim_courier.csv'),
  'courier_id,courier_name,base_rate_rs,sla_hours\n' + couriers.map(c => [c.courier_id, c.courier_name, c.base_rate_rs, c.sla_hours].join(',')).join('\n'));
fs.writeFileSync(path.join(outDir, 'dim_geography.csv'),
  'geo_id,city,tier,zone\n' + geos.map(g => [g.geo_id, g.city, g.tier, g.zone].join(',')).join('\n'));
fs.writeFileSync(path.join(outDir, 'dim_merchant.csv'),
  'merchant_id,merchant_name,category\n' + merchants.map(m => [m.merchant_id, m.merchant_name, m.category].join(',')).join('\n'));
fs.writeFileSync(path.join(outDir, 'fact_orders.csv'), orderRows.join('\n'));
fs.writeFileSync(path.join(outDir, 'fact_settlements.csv'), settleRows.join('\n'));
fs.writeFileSync(path.join(outDir, '_stats.json'), JSON.stringify({
  orders: N_ORDERS, settlementRows: settleRows.length - 1, duplicatesInjected: dupCount,
  days: N_DAYS, seed: 42, signals: 'bluedart-tier3-weight, shiprocket-festival-overdue, delhivery-cod-short, phantom-rto, kwikship-eta, dtdc-forward, 1pct-dup'
}, null, 2));
console.log(`Seeded ${N_ORDERS} orders, ${settleRows.length - 1} settlement rows (${dupCount} dups) → ./output/`);
