// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#65a30d'];

// ─── State ────────────────────────────────────────────────────────────────────
let nextId = 1;
let scenarios = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function val(id) { return document.getElementById(id)?.value ?? ''; }

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 4, maximumFractionDigits: 4 });
function brl(v) { return brlFmt.format(v); }
function pct(v) { return pctFmt.format(v); }

// ─── Scenario management ──────────────────────────────────────────────────────
function nextMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function saveAllFromDOM() {
  scenarios.forEach(s => {
    if (document.getElementById(`name-${s.id}`)) readScenarioFromDOM(s.id);
  });
}

function addScenario(defaults = {}) {
  saveAllFromDOM();
  const id = nextId++;
  const color = COLORS[scenarios.length % COLORS.length];
  scenarios.push({
    id, color,
    name:         defaults.name         ?? `Cenário ${id}`,
    amount:       defaults.amount       ?? 270000,
    rate:         defaults.rate         ?? 12.5,
    rateType:     defaults.rateType     ?? 'annual',
    installments: defaults.installments ?? 420,
    type:         defaults.type         ?? 'SAC',
    startDate:    defaults.startDate    ?? nextMonthDate(),
    amortEntries: defaults.amortEntries ? defaults.amortEntries.map(e => ({...e})) : [],
  });
  renderScenarios();
}

function removeScenario(id) {
  saveAllFromDOM();
  scenarios = scenarios.filter(s => s.id !== id);
  renderScenarios();
}

function duplicateScenario(id) {
  saveAllFromDOM();
  const orig = scenarios.find(s => s.id === id);
  addScenario({ ...orig, name: orig.name + ' (cópia)', amortEntries: orig.amortEntries.map(e => ({...e})) });
}

function readScenarioFromDOM(id) {
  const s = scenarios.find(s => s.id === id);
  if (!s) return;
  s.name         = val(`name-${id}`);
  s.amount       = parseFloat(val(`amount-${id}`)) || 0;
  s.rate         = parseFloat(val(`rate-${id}`).replace(',', '.')) || 0;
  s.rateType     = val(`rateType-${id}`);
  s.installments = parseInt(val(`installments-${id}`)) || 0;
  s.type         = val(`type-${id}`);
  s.startDate    = val(`startDate-${id}`);
  // amortEntries managed separately
}

// ─── Render scenarios ─────────────────────────────────────────────────────────
function renderScenarios() {
  const container = document.getElementById('scenarios');
  container.innerHTML = scenarios.map(s => scenarioCardHtml(s)).join('');
  scenarios.forEach(s => renderAmortEntries(s.id));
  saveToStorage();
}

function scenarioCardHtml(s) {
  return `
  <div class="scenario-card" id="card-${s.id}" style="--accent-color:${s.color}">
    <div class="scenario-header">
      <span class="dot" style="background:${s.color}"></span>
      <h3 id="title-${s.id}">${escHtml(s.name)}</h3>
      <span class="badge badge-${s.type.toLowerCase()}" id="badge-${s.id}">${s.type}</span>
    </div>
    <div class="scenario-body">
      <div class="fields">
        <div class="field" style="grid-column:span 2">
          <label>Nome do cenário</label>
          <input id="name-${s.id}" type="text" value="${escHtml(s.name)}"
            oninput="scenarios.find(x=>x.id==${s.id}).name=this.value;document.getElementById('title-${s.id}').textContent=this.value;" />
        </div>
        <div class="field">
          <label>Valor financiado (R$)</label>
          <input id="amount-${s.id}" type="number" min="0" step="1000" value="${s.amount}" />
        </div>
        <div class="field">
          <label>Nº de parcelas</label>
          <input id="installments-${s.id}" type="number" min="1" max="600" step="1" value="${s.installments}" />
        </div>
        <div class="field">
          <label>Taxa de juros</label>
          <div class="rate-row">
            <input id="rate-${s.id}" type="number" min="0" step="0.01" value="${s.rate}" />
            <select id="rateType-${s.id}">
              <option value="annual"  ${s.rateType==='annual'  ? 'selected':''}>% a.a.</option>
              <option value="monthly" ${s.rateType==='monthly' ? 'selected':''}>% a.m.</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Sistema</label>
          <select id="type-${s.id}" onchange="
            scenarios.find(x=>x.id==${s.id}).type=this.value;
            document.getElementById('badge-${s.id}').className='badge badge-'+this.value.toLowerCase();
            document.getElementById('badge-${s.id}').textContent=this.value;">
            <option value="SAC"   ${s.type==='SAC'   ? 'selected':''}>SAC</option>
            <option value="Price" ${s.type==='Price' ? 'selected':''}>Price</option>
          </select>
        </div>
        <div class="field">
          <label>Data 1ª parcela</label>
          <input id="startDate-${s.id}" type="date" value="${s.startDate}" />
        </div>
      </div>

      <!-- ── Amortizações Extras ── -->
      <div class="amort-extra-header" onclick="toggleAmortSection(${s.id})">
        <span class="amort-extra-arrow" id="amort-arrow-${s.id}">▶</span>
        Amortizações Extras
        <span class="badge badge-amort" id="amort-count-${s.id}" style="margin-left:.3rem">
          ${s.amortEntries.length > 0 ? s.amortEntries.length + ' entrada(s)' : 'Nenhuma'}
        </span>
      </div>
      <div id="amort-section-${s.id}" style="display:none">
        <div class="amort-extra-body">
          <!-- Entries list -->
          <div id="amort-entries-${s.id}"></div>

          <!-- Sequence generator -->
          <details class="seq-gen">
            <summary>Gerador de sequência de parcelas</summary>
            <div class="seq-gen-fields">
              Começando em
              <input type="number" id="seq-start-${s.id}" min="1" value="1">
              a cada
              <input type="number" id="seq-step-${s.id}" min="1" value="12">
              até a parcela
              <input type="number" id="seq-end-${s.id}" min="1" value="${s.installments}">
              <button class="btn btn-ghost btn-sm" onclick="generateSequence(${s.id})">Copiar para parcelas</button>
            </div>
          </details>

          <!-- Add form -->
          <div class="add-amort-form">
            <div class="field">
              <label>Amortizar após parcelas</label>
              <input id="amort-expr-${s.id}" type="text" placeholder="ex: 5,8,12,20-30,40" />
            </div>
            <div class="field">
              <label id="amort-amount-label-${s.id}">Valor fixo (R$)</label>
              <input id="amort-amount-${s.id}" type="number" min="0" step="100" placeholder="0,00" />
            </div>
            <div class="field">
              <label>Tipo</label>
              <select id="amort-mode-${s.id}" onchange="updateAmortLabel(${s.id})">
                <option value="prazo">Por prazo</option>
                <option value="parcela">Por parcela</option>
                <option value="orcamento">Orçamento fixo — Por prazo</option>
                <option value="orcamento-parcela">Orçamento fixo — Por parcela</option>
              </select>
            </div>
            <div class="field" style="justify-content:flex-end">
              <button class="btn btn-primary btn-sm" onclick="addAmortEntry(${s.id})">+ Adicionar</button>
            </div>
          </div>
        </div>
      </div>

      <div class="scenario-actions">
        ${scenarios.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="removeScenario(${s.id})">✕ Remover</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="duplicateScenario(${s.id})">⎘ Duplicar</button>
      </div>
    </div>
  </div>`;
}

// ─── Amort entry management ───────────────────────────────────────────────────
function toggleAmortSection(id) {
  const section = document.getElementById(`amort-section-${id}`);
  const arrow   = document.getElementById(`amort-arrow-${id}`);
  if (!section) return;
  const open = section.style.display !== 'none';
  section.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
}

function renderAmortEntries(scenarioId) {
  const s = scenarios.find(s => s.id === scenarioId);
  const container = document.getElementById(`amort-entries-${scenarioId}`);
  const badge     = document.getElementById(`amort-count-${scenarioId}`);
  if (!container || !s) return;

  if (badge) badge.textContent = s.amortEntries.length > 0 ? s.amortEntries.length + ' entrada(s)' : 'Nenhuma';

  if (s.amortEntries.length === 0) {
    container.innerHTML = '<p class="no-entries">Nenhuma amortização extra. Use o formulário abaixo para adicionar.</p>';
    return;
  }

  container.innerHTML = `
    <table class="entries-table">
      <thead><tr>
        <th>Parcelas</th><th>Valor</th><th>Tipo</th><th></th>
      </tr></thead>
      <tbody>
        ${s.amortEntries.map((e, i) => `
          <tr>
            <td><code>${escHtml(e.expr)}</code></td>
            <td>${brl(e.amount)}</td>
            <td>${e.mode === 'prazo' ? 'Por prazo' : e.mode === 'parcela' ? 'Por parcela' : e.mode === 'orcamento-parcela' ? 'Orçamento fixo — Por parcela' : 'Orçamento fixo — Por prazo'}</td>
            <td><button class="btn btn-danger btn-xs" onclick="removeAmortEntry(${scenarioId},${i})">✕</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function addAmortEntry(scenarioId) {
  readScenarioFromDOM(scenarioId);
  const expr   = val(`amort-expr-${scenarioId}`).trim();
  const amount = parseFloat(val(`amort-amount-${scenarioId}`)) || 0;
  const mode   = val(`amort-mode-${scenarioId}`) || 'prazo';

  if (!expr) { alert('Informe as parcelas (ex: 5,8,12,20-30,40).'); return; }
  if (amount <= 0) { alert('Informe um valor de amortização maior que zero.'); return; }

  const s = scenarios.find(s => s.id === scenarioId);
  s.amortEntries.push({ expr, amount, mode });

  document.getElementById(`amort-expr-${scenarioId}`).value   = '';
  document.getElementById(`amort-amount-${scenarioId}`).value = '';

  renderAmortEntries(scenarioId);
  saveToStorage();
}

function removeAmortEntry(scenarioId, idx) {
  const s = scenarios.find(s => s.id === scenarioId);
  s.amortEntries.splice(idx, 1);
  renderAmortEntries(scenarioId);
  saveToStorage();
}

function updateAmortLabel(scenarioId) {
  const mode  = val(`amort-mode-${scenarioId}`);
  const label = document.getElementById(`amort-amount-label-${scenarioId}`);
  if (!label) return;
  label.textContent = (mode === 'orcamento' || mode === 'orcamento-parcela') ? 'Orçamento mensal (R$)' : 'Valor fixo (R$)';
}

function generateSequence(scenarioId) {
  const start = parseInt(val(`seq-start-${scenarioId}`)) || 0;
  const step  = parseInt(val(`seq-step-${scenarioId}`))  || 0;
  const end   = parseInt(val(`seq-end-${scenarioId}`))   || 0;
  if (start < 1 || step < 1 || end < start) { alert('Verifique os valores do gerador de sequência.'); return; }
  const parts = [];
  for (let i = start; i <= end; i += step) parts.push(i);
  const el = document.getElementById(`amort-expr-${scenarioId}`);
  if (el) el.value = parts.join(',');
}

// ─── Parse installment expression ─────────────────────────────────────────────
function parseInstallments(expr) {
  const result = new Set();
  for (const part of String(expr).split(',').map(s => s.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(s => parseInt(s.trim()));
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) result.add(i);
      }
    } else {
      const n = parseInt(part);
      if (!isNaN(n) && n >= 1) result.add(n);
    }
  }
  return [...result].sort((a, b) => a - b);
}

// Build Map<period, {amount, mode}[]> from scenario amortEntries
function buildAmortPlan(amortEntries) {
  const plan = new Map();
  for (const entry of amortEntries) {
    for (const inst of parseInstallments(entry.expr)) {
      if (!plan.has(inst)) plan.set(inst, []);
      plan.get(inst).push({ amount: entry.amount, mode: entry.mode });
    }
  }
  return plan;
}

// ─── Chart state ──────────────────────────────────────────────────────────────
let _chartComputed = null;
let _chartInstance = null;
let _activeChartFields = new Set(['closeBalance']);

const CHART_FIELDS = [
  { key: 'closeBalance',  label: 'Saldo Devedor',  dash: []      },
  { key: 'installment',   label: 'Prestação',      dash: [6,3]   },
  { key: 'interest',      label: 'Juros',          dash: [3,3]   },
  { key: 'amortization',  label: 'Amortização',    dash: [10,4]  },
  { key: 'extraAmort',    label: 'Amort. Extra',   dash: [2,2]   },
];

function chartSectionHtml(computed) {
  const hasExtra = computed.some(c => c.rows.some(r => r.extraAmort > 0));
  const fields   = hasExtra ? CHART_FIELDS : CHART_FIELDS.filter(f => f.key !== 'extraAmort');
  return `
    <div class="chart-section">
      <div class="section-title">Evolução ao longo do tempo</div>
      <div class="chart-toolbar">
        ${fields.map(f => `
          <button class="chart-field-btn ${_activeChartFields.has(f.key) ? 'active' : ''}"
            onclick="toggleChartField('${f.key}')" data-field="${f.key}">${f.label}</button>
        `).join('')}
      </div>
      <div class="chart-wrap"><canvas id="main-chart"></canvas></div>
    </div>`;
}

function toggleChartField(field) {
  if (_activeChartFields.has(field)) {
    if (_activeChartFields.size === 1) return;
    _activeChartFields.delete(field);
  } else {
    _activeChartFields.add(field);
  }
  document.querySelectorAll('.chart-field-btn').forEach(btn => {
    btn.classList.toggle('active', _activeChartFields.has(btn.dataset.field));
  });
  renderChart();
}

function renderChart() {
  const canvas = document.getElementById('main-chart');
  if (!canvas || !_chartComputed) return;
  if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }

  const maxN        = Math.max(..._chartComputed.map(c => c.rows.length));
  const labels      = Array.from({ length: maxN }, (_, i) => i + 1);
  const activeFields = CHART_FIELDS.filter(f => _activeChartFields.has(f.key));
  const multiField  = activeFields.length > 1;
  const datasets    = [];

  _chartComputed.forEach(c => {
    activeFields.forEach(field => {
      const data = c.rows.map(r => r[field.key]);
      while (data.length < maxN) data.push(null);
      datasets.push({
        label:           multiField ? `${escHtml(c.name)} — ${field.label}` : escHtml(c.name),
        data,
        borderColor:     c.color,
        backgroundColor: c.color + '1a',
        borderWidth:     2,
        borderDash:      field.dash,
        pointRadius:     0,
        pointHoverRadius: 4,
        tension:         0.3,
        fill:            false,
        spanGaps:        false,
      });
    });
  });

  _chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color:           '#9aa0c0',
            font:            { family: "'IBM Plex Mono', monospace", size: 11 },
            usePointStyle:   true,
            pointStyleWidth: 20,
          },
        },
        tooltip: {
          backgroundColor: '#10142e',
          borderColor:     'rgba(255,255,255,.12)',
          borderWidth:     1,
          titleColor:      '#e8eaf2',
          bodyColor:       '#9aa0c0',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${brl(ctx.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#6b7499', font: { family: "'IBM Plex Mono', monospace", size: 10 }, maxTicksLimit: 20 },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
        y: {
          ticks: { color: '#6b7499', font: { family: "'IBM Plex Mono', monospace", size: 10 }, callback: v => brl(v) },
          grid:  { color: 'rgba(255,255,255,.04)' },
        },
      },
    },
  });
}

// ─── Color helper ─────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)].join(',');
}

// ─── Rate: effective annual → monthly via compound formula ────────────────────
// (1 + annual)^(1/12) − 1  — matches the reference site calculation
function monthlyRate(rate, rateType) {
  return rateType === 'monthly' ? rate / 100 : Math.pow(1 + rate / 100, 1 / 12) - 1;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function installmentDate(startDate, offset) {
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, d);
  // Handle month-end overflow (e.g. Jan 31 + 1 month → Feb 28)
  const targetMonth = ((m - 1 + offset) % 12 + 12) % 12;
  if (date.getMonth() !== targetMonth) date.setDate(0);
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}

// ─── SAC calculation ──────────────────────────────────────────────────────────
// "Por prazo"  / "orcamento":          interest on actualBalance; installment kept equal to
//                                       original scheduled installment → interest savings
//                                       become extra amortization → loan ends sooner.
// "Por parcela" / "orcamento-parcela": after extra, scheduledBalance synced to actualBalance,
//                                       constAmort recalculated → installments shrink, same term.
function calcSAC(amount, mRate, n, startDate, amortPlan) {
  let constAmort       = amount / n;
  let scheduledBalance = amount;   // follows original no-extra schedule (for installment reference)
  let actualBalance    = amount;   // real outstanding debt
  const rows = [];

  for (let period = 1; period <= n + 500 && actualBalance > 0.005; period++) {
    const openBalance  = actualBalance;
    // Interest on actual balance; amortization absorbs the interest savings vs original schedule
    const interest     = actualBalance * mRate;
    const amortization = Math.min(constAmort + (scheduledBalance - actualBalance) * mRate, actualBalance);

    actualBalance    = Math.max(0, actualBalance    - amortization);
    scheduledBalance = Math.max(0, scheduledBalance - constAmort);
    if (actualBalance    < 0.005) actualBalance    = 0;
    if (scheduledBalance < 0.005) scheduledBalance = 0;

    const installment = amortization + interest;

    let extraAmort = 0;
    for (const extra of (amortPlan.get(period) || [])) {
      if (actualBalance <= 0) break;
      const isOrcamento = extra.mode === 'orcamento' || extra.mode === 'orcamento-parcela';
      const rawAmt = isOrcamento
        ? Math.max(0, extra.amount - installment)
        : extra.amount;
      if (rawAmt <= 0) continue;
      const amt = Math.min(rawAmt, actualBalance);
      actualBalance = Math.max(0, actualBalance - amt);
      if (actualBalance < 0.005) actualBalance = 0;
      extraAmort += amt;

      if (extra.mode === 'parcela' || extra.mode === 'orcamento-parcela') {
        // Sync scheduled to actual; recalculate constAmort → future installments shrink
        scheduledBalance = actualBalance;
        const rem = n - period;
        if (rem > 0 && actualBalance > 0) constAmort = actualBalance / rem;
      }
      // 'prazo' / 'orcamento': scheduledBalance unchanged → installment fixed to original schedule, loan ends sooner
    }

    rows.push({ period, date: installmentDate(startDate, period - 1), openBalance, amortization, interest, installment, extraAmort, closeBalance: actualBalance });
  }
  return rows;
}

// ─── Price calculation ────────────────────────────────────────────────────────
// "Por prazo"  / "orcamento":          interest on scheduledBalance → same fixedInst,
//                                       loan ends sooner (actual balance hits 0 first).
// "Por parcela" / "orcamento-parcela": scheduledBalance synced to actualBalance after extra,
//                                       fixedInst recalculated → installments shrink, same term.
function calcPrice(amount, mRate, n, startDate, amortPlan) {
  let fixedInst     = mRate === 0 ? amount / n
    : amount * (mRate * Math.pow(1 + mRate, n)) / (Math.pow(1 + mRate, n) - 1);
  let actualBalance = amount;
  const rows = [];

  for (let period = 1; period <= n + 500 && actualBalance > 0.005; period++) {
    const openBalance  = actualBalance;
    const interest     = actualBalance * mRate;
    const amortization = Math.min(Math.max(0, fixedInst - interest), actualBalance);

    actualBalance = Math.max(0, actualBalance - amortization);
    if (actualBalance < 0.005) actualBalance = 0;

    const installment = amortization + interest;

    let extraAmort = 0;
    for (const extra of (amortPlan.get(period) || [])) {
      if (actualBalance <= 0) break;
      const isOrcamento = extra.mode === 'orcamento' || extra.mode === 'orcamento-parcela';
      const rawAmt = isOrcamento
        ? Math.max(0, extra.amount - installment)
        : extra.amount;
      if (rawAmt <= 0) continue;
      const amt = Math.min(rawAmt, actualBalance);
      actualBalance = Math.max(0, actualBalance - amt);
      if (actualBalance < 0.005) actualBalance = 0;
      extraAmort += amt;

      if (extra.mode === 'parcela' || extra.mode === 'orcamento-parcela') {
        const rem = n - period;
        if (rem > 0 && actualBalance > 0) {
          fixedInst = mRate === 0 ? actualBalance / rem
            : actualBalance * (mRate * Math.pow(1 + mRate, rem)) / (Math.pow(1 + mRate, rem) - 1);
        }
      }
      // 'prazo' / 'orcamento': fixedInst unchanged → same installments, loan ends sooner
    }

    rows.push({ period, date: installmentDate(startDate, period - 1), openBalance, amortization, interest, installment, extraAmort, closeBalance: actualBalance });
  }
  return rows;
}

// ─── Compute scenario ─────────────────────────────────────────────────────────
function computeScenario(s) {
  const mRate     = monthlyRate(s.rate, s.rateType);
  const startDate = s.startDate || nextMonthDate();
  const amortPlan = buildAmortPlan(s.amortEntries || []);

  const rows = s.type === 'SAC'
    ? calcSAC(s.amount, mRate, s.installments, startDate, amortPlan)
    : calcPrice(s.amount, mRate, s.installments, startDate, amortPlan);

  const totalInterest     = rows.reduce((a, r) => a + r.interest, 0);
  const totalExtraAmort   = rows.reduce((a, r) => a + r.extraAmort, 0);
  const totalRegularPaid  = rows.reduce((a, r) => a + r.installment, 0);
  const totalPaid         = totalRegularPaid + totalExtraAmort;
  const firstInstallment  = rows[0]?.installment ?? 0;
  const lastInstallment   = rows[rows.length - 1]?.installment ?? 0;
  const actualInstallments = rows.length;

  return { ...s, rows, mRate, totalInterest, totalExtraAmort, totalRegularPaid, totalPaid, firstInstallment, lastInstallment, actualInstallments };
}

// ─── Simulate ─────────────────────────────────────────────────────────────────
function simulate() {
  saveAllFromDOM();
  const computed = scenarios.map(computeScenario);

  const minTotalPaid     = Math.min(...computed.map(c => c.totalPaid));
  const minTotalInterest = Math.min(...computed.map(c => c.totalInterest));

  let html = `
    <div class="results-header">
      <h2>Resultados</h2>
      <div class="results-header-line"></div>
      <button class="btn btn-ghost btn-sm no-print" onclick="exportPdf()">⬇ Exportar PDF</button>
    </div>`;

  _chartComputed = computed;

  // ── Summary cards ──
  html += '<div class="summary-grid">';
  computed.forEach(c => {
    const bestPaid     = c.totalPaid     === minTotalPaid     && computed.length > 1;
    const bestInterest = c.totalInterest === minTotalInterest && computed.length > 1;
    const termDiff     = c.installments - c.actualInstallments;
    html += `
      <div class="summary-card" style="--card-accent:${c.color}">
        <div class="sc-name">
          <span class="dot" style="background:${c.color}"></span>
          ${escHtml(c.name)}
          <span class="badge badge-${c.type.toLowerCase()}" style="margin-left:auto">${c.type}</span>
        </div>
        <table>
          <tr><td class="label-cell">Valor financiado</td><td>${brl(c.amount)}</td></tr>
          <tr><td class="label-cell">Parcelas pagas</td><td>
            ${c.actualInstallments}x
            ${termDiff > 0 ? `<span class="term-reduced">▼ ${termDiff} a menos</span>` : ''}
          </td></tr>
          <tr><td class="label-cell">Taxa mensal</td><td>${pct(c.mRate)}</td></tr>
          <tr><td class="label-cell">Taxa anual (efetiva)</td><td>${pct(Math.pow(1 + c.mRate, 12) - 1)}</td></tr>
          <tr><td class="label-cell">1ª parcela</td><td>${brl(c.firstInstallment)}</td></tr>
          <tr><td class="label-cell">Última parcela</td><td>${brl(c.lastInstallment)}</td></tr>
          ${c.totalExtraAmort > 0 ? `<tr><td class="label-cell">Amort. extras</td><td class="highlight-extra">${brl(c.totalExtraAmort)}</td></tr>` : ''}
          <tr><td class="label-cell">Total de juros</td>
              <td class="${bestInterest ? 'highlight-best' : ''}">${brl(c.totalInterest)}</td></tr>
          <tr><td class="label-cell">Total pago</td>
              <td class="${bestPaid ? 'highlight-best' : ''}">${brl(c.totalPaid)}</td></tr>
        </table>
      </div>`;
  });
  html += '</div>';

  // ── Chart ──
  html += chartSectionHtml(computed);

  // ── Side-by-side comparison table ──
  if (computed.length > 1) {
    const sameDate  = computed.every(c => c.startDate === computed[0].startDate);
    const anyExtra  = computed.some(c => c.totalExtraAmort > 0);
    const fixedCols = sameDate ? 2 : 1; // # + optional Data
    const COLS_PER  = 3; // Prestação | Juros | Saldo Devedor

    html += '<div class="comparison-section"><div class="section-title">Comparativo — Parcelas, Juros e Saldo Devedor</div>';
    html += '<div class="table-wrap"><table class="comp">';

    // ── Header row 1: scenario group labels ──
    html += '<thead>';
    html += `<tr><th rowspan="2" class="comp-fixed">#</th>${sameDate ? '<th rowspan="2" class="comp-fixed">Data</th>' : ''}`;
    computed.forEach(c => {
      const rgb = hexToRgb(c.color);
      html += `<th colspan="${COLS_PER}" style="background:rgba(${rgb},.08);border-bottom:3px solid ${c.color};border-left:3px solid ${c.color};text-align:center;color:${c.color}">
        <span class="dot" style="background:${c.color};width:8px;height:8px;margin-right:5px;vertical-align:middle;"></span>${escHtml(c.name)}&nbsp;<span class="badge badge-${c.type.toLowerCase()}" style="vertical-align:middle">${c.type}</span>
      </th>`;
    });
    html += '</tr>';

    // ── Header row 2: sub-column labels ──
    html += '<tr>';
    computed.forEach(c => {
      const rgb = hexToRgb(c.color);
      const bg  = `background:rgba(${rgb},.05);`;
      const bl  = `border-left:3px solid ${c.color};`;
      html += `<th style="${bl}${bg}">Prestação</th><th style="${bg}">Juros</th><th style="${bg}">Saldo Dev.</th>`;
    });
    html += '</tr></thead>';

    // ── Body ──
    html += '<tbody>';
    const maxN = Math.max(...computed.map(c => c.rows.length));
    for (let i = 0; i < maxN; i++) {
      const date = computed.find(c => c.rows[i])?.rows[i].date ?? '';

      html += `<tr><td class="comp-fixed">${i + 1}</td>${sameDate ? `<td class="comp-fixed">${date}</td>` : ''}`;
      computed.forEach(c => {
        const row = c.rows[i];
        const rgb = hexToRgb(c.color);
        const bl  = `border-left:3px solid ${c.color};`;
        const bg  = (i % 2 === 1) ? `background:rgba(${rgb},.04);` : '';
        if (!row) {
          html += `<td style="${bl}${bg}">—</td><td style="${bg}">—</td><td style="${bg}">—</td>`;
        } else {
          const extra = row.extraAmort > 0 ? `<br><small style="color:#7c3aed;font-weight:700">+${brl(row.extraAmort)}</small>` : '';
          html += `<td style="${bl}${bg}">${brl(row.installment)}${extra}</td>`;
          html += `<td style="${bg}">${brl(row.interest)}</td>`;
          html += `<td style="${bg}">${brl(row.closeBalance)}</td>`;
        }
      });
      html += '</tr>';
    }
    html += '</tbody>';

    // ── Footer totals ──
    html += '<tfoot>';
    const footRows = [
      { label: 'Total prestações', fn: c => brl(c.totalRegularPaid) },
      ...(anyExtra ? [{ label: 'Total amort. extras', fn: c => c.totalExtraAmort > 0 ? `<span style="color:#7c3aed">${brl(c.totalExtraAmort)}</span>` : '—' }] : []),
      { label: 'Total de juros',   fn: c => `<span class="${c.totalInterest === minTotalInterest ? 'highlight-best' : ''}">${brl(c.totalInterest)}</span>` },
      { label: 'Total geral pago', fn: c => `<span class="${c.totalPaid === minTotalPaid ? 'highlight-best' : ''}">${brl(c.totalPaid)}</span>` },
    ];
    footRows.forEach(row => {
      html += `<tr><td colspan="${fixedCols}" style="text-align:left">${row.label}</td>`;
      computed.forEach(c => {
        const rgb = hexToRgb(c.color);
        html += `<td colspan="${COLS_PER}" style="text-align:center;border-left:3px solid ${c.color};background:rgba(${rgb},.06)">${row.fn(c)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tfoot></table></div></div>';
  }

  // ── Full amortization tables ──
  html += '<div class="gold-line"></div><div class="section-title" style="margin-bottom:1rem">Tabelas de Amortização Detalhadas</div>';
  computed.forEach(c => {
    const toggleId = `toggle-${c.id}`;
    const tableId  = `amort-tbl-${c.id}`;
    const termDiff = c.installments - c.actualInstallments;
    const hasExtra = c.rows.some(r => r.extraAmort > 0);

    html += `
      <div class="amort-section">
        <div class="amort-toggle" id="${toggleId}" onclick="toggleAmortTbl('${toggleId}','${tableId}')">
          <span class="dot" style="background:${c.color}"></span>
          ${escHtml(c.name)} — <span class="badge badge-${c.type.toLowerCase()}">${c.type}</span>
          &nbsp;·&nbsp; ${c.actualInstallments} parcelas
          ${termDiff > 0 ? `<span class="term-reduced">▼ −${termDiff}</span>` : ''}
          &nbsp;·&nbsp; Juros: <strong>${brl(c.totalInterest)}</strong>
          &nbsp;·&nbsp; Total: <strong>${brl(c.totalPaid)}</strong>
          <span class="arrow">▼</span>
        </div>
        <div class="amort-table-wrap" id="${tableId}">
          <table class="amort">
            <thead><tr>
              <th>#</th><th>Data</th>
              <th>Saldo Devedor</th>
              <th>Amortização</th>
              <th>Juros</th>
              <th>Prestação</th>
              ${hasExtra ? '<th>Amort. Extra</th>' : ''}
              <th>Saldo Final</th>
            </tr></thead>
            <tbody>
              ${c.rows.map(r => `
                <tr class="${r.extraAmort > 0 ? 'row-extra' : ''}">
                  <td>${r.period}</td>
                  <td>${r.date}</td>
                  <td>${brl(r.openBalance)}</td>
                  <td>${brl(r.amortization)}</td>
                  <td>${brl(r.interest)}</td>
                  <td>${brl(r.installment)}</td>
                  ${hasExtra ? `<td class="${r.extraAmort > 0 ? 'extra-val' : ''}">${r.extraAmort > 0 ? brl(r.extraAmort) : '—'}</td>` : ''}
                  <td>${brl(r.closeBalance)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr>
              <td colspan="3">Total</td>
              <td>${brl(c.rows.reduce((a,r)=>a+r.amortization,0))}</td>
              <td>${brl(c.totalInterest)}</td>
              <td>${brl(c.totalRegularPaid)}</td>
              ${hasExtra ? `<td>${brl(c.totalExtraAmort)}</td>` : ''}
              <td>—</td>
            </tr></tfoot>
          </table>
        </div>
      </div>`;
  });

  document.getElementById('results').innerHTML = html;
  renderChart();
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exportPdf() {
  // Expand all amort tables so they appear in the PDF
  const wrappers = document.querySelectorAll('.amort-table-wrap');
  const toggles  = document.querySelectorAll('.amort-toggle');
  const states   = Array.from(wrappers).map(w => w.classList.contains('open'));

  wrappers.forEach((w, i) => { w.classList.add('open'); if (toggles[i]) toggles[i].classList.add('open'); });

  function restore() {
    wrappers.forEach((w, i) => {
      if (!states[i]) { w.classList.remove('open'); if (toggles[i]) toggles[i].classList.remove('open'); }
    });
    window.removeEventListener('afterprint', restore);
  }
  window.addEventListener('afterprint', restore);
  window.print();
}

function toggleAmortTbl(toggleId, tableId) {
  document.getElementById(toggleId).classList.toggle('open');
  document.getElementById(tableId).classList.toggle('open');
}

// ─── Persistence (localStorage) ───────────────────────────────────────────────
const STORAGE_KEY = 'amortizacao_v1';

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scenarios, nextId }));
  } catch(e) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { scenarios: saved, nextId: savedId } = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length === 0) return false;
    scenarios = saved;
    nextId    = savedId ?? (Math.max(...saved.map(s => s.id)) + 1);
    return true;
  } catch(e) { return false; }
}

function clearStorage() {
  if (!confirm('Apagar todos os cenários salvos e voltar ao padrão?')) return;
  localStorage.removeItem(STORAGE_KEY);
  scenarios = [];
  nextId    = 1;
  document.getElementById('results').innerHTML = '';
  loadDefaults();
}

function loadDefaults() {
  addScenario({ name: 'SAC — 12,5% a.a.',   type: 'SAC',   rate: 12.5, rateType: 'annual', amount: 270000, installments: 420, startDate: '2026-01-03' });
  addScenario({ name: 'Price — 12,5% a.a.', type: 'Price', rate: 12.5, rateType: 'annual', amount: 270000, installments: 420, startDate: '2026-01-03' });
}

// Save before the tab/window closes so even unsaved form edits are captured
window.addEventListener('beforeunload', () => { saveAllFromDOM(); saveToStorage(); });

// ─── Boot ─────────────────────────────────────────────────────────────────────
if (!loadFromStorage()) {
  loadDefaults();
} else {
  renderScenarios();
}
