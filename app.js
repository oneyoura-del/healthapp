/* ---------- Storage ---------- */
const STORAGE_KEY = "dailyTrackerData_v1";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt data */ }
  return { records: {} };
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}
const DATA = loadData();

function exportData() {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dailytracker-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importDataFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (e) {
      alert("올바른 백업 파일이 아니에요.");
      return;
    }
    if (!parsed || typeof parsed.records !== "object") {
      alert("올바른 백업 파일이 아니에요.");
      return;
    }
    if (!confirm("현재 기기의 데이터를 이 백업 파일 내용으로 덮어씁니다. 계속할까요?")) return;
    DATA.records = parsed.records;
    saveData();
    const activeTab = document.querySelector(".tab-btn.active").dataset.tab;
    renderTab(activeTab);
    alert("데이터를 불러왔어요.");
  };
  reader.readAsText(file);
}

function emptyRecord() {
  return { weight: null, drank: false, exercised: false, exerciseTypes: [], todos: [], pomodoroCount: 0 };
}
function getRecord(dateStr) {
  if (!DATA.records[dateStr]) DATA.records[dateStr] = emptyRecord();
  const r = DATA.records[dateStr];
  if (r.pomodoroCount === undefined) r.pomodoroCount = 0;
  if (r.todos === undefined) r.todos = [];
  if (r.exerciseTypes === undefined) {
    r.exerciseTypes = r.exerciseType ? [r.exerciseType === "pt" ? "pilates" : r.exerciseType] : [];
    delete r.exerciseType;
  }
  return r;
}

const EXERCISE_TYPES = [
  { key: "golf", label: "골프", icon: "⛳", varColor: "--series-golf" },
  { key: "gx", label: "PT", icon: "🏋️", varColor: "--series-gx" },
  { key: "pilates", label: "필라테스", icon: "🧘", varColor: "--series-pilates" },
  { key: "running", label: "러닝", icon: "🏃", varColor: "--series-running" },
];
function countExerciseDays(days, key) {
  return days.filter(d => d.rec && d.rec.exercised && d.rec.exerciseTypes && d.rec.exerciseTypes.includes(key)).length;
}
function updateRecord(dateStr, patch) {
  const r = getRecord(dateStr);
  Object.assign(r, patch);
  saveData();
  return r;
}

/* ---------- Date helpers ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/* ---------- Tabs ---------- */
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    tabPanels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    renderTab(btn.dataset.tab);
  });
});
function renderTab(tab) {
  if (tab === "today") renderToday();
  if (tab === "calendar") renderCalendar();
  if (tab === "monthly") renderMonthly();
  if (tab === "yearly") renderYearly();
  if (tab === "pomodoro") renderPomodoro();
}

/* ---------- Day form (shared by Today tab & Calendar day-detail) ---------- */
function renderDayForm(dateStr, container, opts) {
  opts = opts || {};
  const r = getRecord(dateStr);
  container.innerHTML = "";

  if (opts.title) {
    const h = document.createElement("div");
    h.className = "day-detail-title";
    h.textContent = opts.title;
    container.appendChild(h);
  }

  // Weight card
  const weightCard = document.createElement("div");
  weightCard.className = "card";
  weightCard.innerHTML = `<h3>체중</h3>`;
  const weightRow = document.createElement("div");
  weightRow.className = "field-row";
  weightRow.innerHTML = `<span class="field-label">오늘 체중 (kg)</span>`;
  const weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.step = "0.1";
  weightInput.min = "0";
  weightInput.placeholder = "예: 68.5";
  weightInput.value = r.weight ?? "";
  weightInput.addEventListener("change", () => {
    const v = parseFloat(weightInput.value);
    updateRecord(dateStr, { weight: isNaN(v) ? null : v });
    refreshDependentViews();
  });
  weightRow.appendChild(weightInput);
  weightCard.appendChild(weightRow);
  container.appendChild(weightCard);

  // Habits card
  const habitsCard = document.createElement("div");
  habitsCard.className = "card";
  habitsCard.innerHTML = `<h3>습관 체크</h3>`;

  const drinkRow = document.createElement("div");
  drinkRow.className = "field-row";
  drinkRow.innerHTML = `<span class="field-label">🍺 술 마셨어요</span>`;
  const drinkSwitch = makeSwitch(r.drank, (checked) => {
    updateRecord(dateStr, { drank: checked });
    refreshDependentViews();
  });
  drinkRow.appendChild(drinkSwitch);
  habitsCard.appendChild(drinkRow);

  const exRow = document.createElement("div");
  exRow.className = "field-row";
  exRow.innerHTML = `<span class="field-label">💪 운동했어요</span>`;
  const exSwitch = makeSwitch(r.exercised, (checked) => {
    updateRecord(dateStr, { exercised: checked, exerciseTypes: checked ? (r.exerciseTypes.length ? r.exerciseTypes : ["golf"]) : [] });
    refreshDependentViews();
    renderDayForm(dateStr, container, opts);
  });
  exRow.appendChild(exSwitch);
  habitsCard.appendChild(exRow);

  if (r.exercised) {
    const typeRow = document.createElement("div");
    typeRow.className = "field-row field-row-col";
    typeRow.innerHTML = `<span class="field-label">운동 종류 (복수 선택 가능)</span>`;
    const pillGroup = document.createElement("div");
    pillGroup.className = "pill-group";
    EXERCISE_TYPES.forEach(type => {
      const pill = document.createElement("button");
      const selected = r.exerciseTypes.includes(type.key);
      pill.className = `pill ${type.key}` + (selected ? " selected" : "");
      pill.textContent = `${type.icon} ${type.label}`;
      pill.addEventListener("click", () => {
        const set = new Set(r.exerciseTypes);
        if (set.has(type.key)) set.delete(type.key); else set.add(type.key);
        updateRecord(dateStr, { exerciseTypes: Array.from(set) });
        refreshDependentViews();
        renderDayForm(dateStr, container, opts);
      });
      pillGroup.appendChild(pill);
    });
    typeRow.appendChild(pillGroup);
    habitsCard.appendChild(typeRow);
  }
  container.appendChild(habitsCard);

  // Todo card
  const todoCard = document.createElement("div");
  todoCard.className = "card";
  todoCard.innerHTML = `<h3>할 일</h3>`;
  const addRow = document.createElement("div");
  addRow.className = "todo-add-row";
  const todoInput = document.createElement("input");
  todoInput.type = "text";
  todoInput.className = "todo-input";
  todoInput.placeholder = "할 일을 입력하세요";
  const addBtn = document.createElement("button");
  addBtn.className = "btn";
  addBtn.textContent = "추가";
  function addTodo() {
    const text = todoInput.value.trim();
    if (!text) return;
    r.todos.push({ id: Date.now() + Math.random().toString(16).slice(2), text, done: false });
    saveData();
    todoInput.value = "";
    renderDayForm(dateStr, container, opts);
    refreshDependentViews();
  }
  addBtn.addEventListener("click", addTodo);
  todoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addTodo(); });
  addRow.appendChild(todoInput);
  addRow.appendChild(addBtn);
  todoCard.appendChild(addRow);

  const list = document.createElement("ul");
  list.className = "todo-list";
  if (r.todos.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent = "등록된 할 일이 없어요.";
    todoCard.appendChild(hint);
  } else {
    r.todos.forEach(todo => {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.done ? " done" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = todo.done;
      cb.addEventListener("change", () => {
        todo.done = cb.checked;
        saveData();
        li.classList.toggle("done", todo.done);
        refreshDependentViews();
      });
      const span = document.createElement("span");
      span.textContent = todo.text;
      const del = document.createElement("button");
      del.className = "todo-del";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        r.todos = r.todos.filter(t => t.id !== todo.id);
        saveData();
        renderDayForm(dateStr, container, opts);
        refreshDependentViews();
      });
      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(del);
      list.appendChild(li);
    });
    todoCard.appendChild(list);
  }
  container.appendChild(todoCard);
}

function makeSwitch(checked, onChange) {
  const label = document.createElement("label");
  label.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const track = document.createElement("span");
  track.className = "switch-track";
  input.addEventListener("change", () => onChange(input.checked));
  label.appendChild(input);
  label.appendChild(track);
  return label;
}

function refreshDependentViews() {
  const activeTab = document.querySelector(".tab-btn.active").dataset.tab;
  if (activeTab === "calendar") renderCalendarGridOnly();
}

/* ---------- Today ---------- */
function renderToday() {
  const root = document.getElementById("today-root");
  const d = new Date();
  const title = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
  renderDayForm(todayStr(), root, { title });
}

/* ---------- Calendar ---------- */
let calYear, calMonth, selectedDay = null;
(function initCalState() {
  const t = new Date();
  calYear = t.getFullYear();
  calMonth = t.getMonth();
})();

document.getElementById("cal-prev").addEventListener("click", () => { shiftCalMonth(-1); });
document.getElementById("cal-next").addEventListener("click", () => { shiftCalMonth(1); });
function shiftCalMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  selectedDay = null;
  document.getElementById("day-detail").classList.add("hidden");
  renderCalendar();
}

function renderCalendar() {
  document.getElementById("cal-title").textContent = `${calYear}년 ${MONTH_NAMES[calMonth]}`;
  renderCalendarGridOnly();
}

function renderCalendarGridOnly() {
  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";
  DOW.forEach(d => {
    const el = document.createElement("div");
    el.className = "cal-dow";
    el.textContent = d;
    grid.appendChild(el);
  });
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const totalDays = daysInMonth(calYear, calMonth);
  const today = todayStr();

  for (let i = 0; i < firstDow; i++) {
    const el = document.createElement("div");
    el.className = "cal-cell empty";
    grid.appendChild(el);
  }
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}`;
    const rec = DATA.records[dateStr];
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (dateStr === today ? " today" : "") + (dateStr === selectedDay ? " selected" : "");

    const dateEl = document.createElement("div");
    dateEl.className = "cal-date";
    dateEl.textContent = day;
    cell.appendChild(dateEl);

    const icons = document.createElement("div");
    icons.className = "cal-icons";
    if (rec) {
      if (rec.weight != null) { const s = document.createElement("span"); s.className = "dot weight"; icons.appendChild(s); }
      if (rec.drank) { icons.appendChild(textSpan("🍺")); }
      if (rec.exercised && rec.exerciseTypes) {
        rec.exerciseTypes.forEach(key => {
          const type = EXERCISE_TYPES.find(t => t.key === key);
          if (type) icons.appendChild(textSpan(type.icon));
        });
      }
    }
    cell.appendChild(icons);

    if (rec && rec.todos && rec.todos.length > 0) {
      const done = rec.todos.filter(t => t.done).length;
      const tc = document.createElement("div");
      tc.className = "cal-todo-count";
      tc.textContent = `✓ ${done}/${rec.todos.length}`;
      cell.appendChild(tc);
    }

    cell.addEventListener("click", () => {
      selectedDay = dateStr;
      renderCalendarGridOnly();
      const detail = document.getElementById("day-detail");
      detail.classList.remove("hidden");
      const dObj = new Date(calYear, calMonth, day);
      renderDayForm(dateStr, detail, { title: `${calYear}년 ${calMonth + 1}월 ${day}일 (${DOW[dObj.getDay()]})` });
      detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    grid.appendChild(cell);
  }
}
function textSpan(t) { const s = document.createElement("span"); s.textContent = t; return s; }

/* ---------- Monthly stats ---------- */
let monthYear, monthMonth;
(function initMonthState() {
  const t = new Date();
  monthYear = t.getFullYear();
  monthMonth = t.getMonth();
})();
document.getElementById("month-prev").addEventListener("click", () => shiftMonth(-1));
document.getElementById("month-next").addEventListener("click", () => shiftMonth(1));
function shiftMonth(delta) {
  monthMonth += delta;
  if (monthMonth < 0) { monthMonth = 11; monthYear--; }
  if (monthMonth > 11) { monthMonth = 0; monthYear++; }
  renderMonthly();
}

function monthRecords(year, month) {
  const total = daysInMonth(year, month);
  const out = [];
  for (let day = 1; day <= total; day++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    out.push({ day, dateStr, rec: DATA.records[dateStr] || null });
  }
  return out;
}

function renderMonthly() {
  document.getElementById("month-title").textContent = `${monthYear}년 ${MONTH_NAMES[monthMonth]}`;
  const root = document.getElementById("monthly-root");
  root.innerHTML = "";
  const days = monthRecords(monthYear, monthMonth);

  const weightPoints = days.filter(d => d.rec && d.rec.weight != null).map(d => ({ label: String(d.day), value: d.rec.weight }));
  const drinkDays = days.filter(d => d.rec && d.rec.drank).length;
  const exerciseCounts = EXERCISE_TYPES.map(type => ({ type, count: countExerciseDays(days, type.key) }));
  let totalTodos = 0, doneTodos = 0;
  days.forEach(d => { if (d.rec && d.rec.todos) { totalTodos += d.rec.todos.length; doneTodos += d.rec.todos.filter(t => t.done).length; } });
  const avgWeight = weightPoints.length ? (weightPoints.reduce((s, p) => s + p.value, 0) / weightPoints.length) : null;

  const stats = document.createElement("div");
  stats.className = "stat-grid";
  stats.appendChild(statTile("평균 체중", avgWeight != null ? avgWeight.toFixed(1) + " kg" : "-"));
  stats.appendChild(statTile("음주 일수", drinkDays + "일"));
  exerciseCounts.forEach(({ type, count }) => stats.appendChild(statTile(type.label, count + "일")));
  stats.appendChild(statTile("할 일 완료율", totalTodos ? Math.round((doneTodos / totalTodos) * 100) + "%" : "-"));
  root.appendChild(stats);

  const weightCard = document.createElement("div");
  weightCard.className = "card";
  weightCard.innerHTML = `<h3>체중 추이</h3>`;
  const weightChartWrap = document.createElement("div");
  weightCard.appendChild(weightChartWrap);
  root.appendChild(weightCard);
  if (weightPoints.length >= 1) {
    drawLineChart(weightChartWrap, weightPoints, { color: "var(--series-weight)", unit: "kg" });
  } else {
    weightChartWrap.innerHTML = `<div class="empty-hint">이번 달 기록된 체중이 없어요.</div>`;
  }

  const habitCard = document.createElement("div");
  habitCard.className = "card";
  habitCard.innerHTML = `<h3>습관 일수</h3>`;
  const barWrap = document.createElement("div");
  habitCard.appendChild(barWrap);
  root.appendChild(habitCard);
  drawBarChart(barWrap, [
    { label: "음주", value: drinkDays, color: "var(--series-drink)" },
    ...exerciseCounts.map(({ type, count }) => ({ label: type.label, value: count, color: `var(${type.varColor})` })),
  ], { maxHint: total => Math.max(total, daysInMonth(monthYear, monthMonth)) });
}

function statTile(label, value) {
  const el = document.createElement("div");
  el.className = "stat-tile";
  el.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
  return el;
}

/* ---------- Yearly stats ---------- */
let yearYear;
(function initYearState() { yearYear = new Date().getFullYear(); })();
document.getElementById("year-prev").addEventListener("click", () => { yearYear--; renderYearly(); });
document.getElementById("year-next").addEventListener("click", () => { yearYear++; renderYearly(); });

function renderYearly() {
  document.getElementById("year-title").textContent = `${yearYear}년`;
  const root = document.getElementById("yearly-root");
  root.innerHTML = "";

  const monthly = [];
  for (let m = 0; m < 12; m++) {
    const days = monthRecords(yearYear, m);
    const weightPoints = days.filter(d => d.rec && d.rec.weight != null).map(d => d.rec.weight);
    const avgW = weightPoints.length ? weightPoints.reduce((a, b) => a + b, 0) / weightPoints.length : null;
    const drink = days.filter(d => d.rec && d.rec.drank).length;
    const exCounts = {};
    EXERCISE_TYPES.forEach(type => { exCounts[type.key] = countExerciseDays(days, type.key); });
    let tot = 0, done = 0;
    days.forEach(d => { if (d.rec && d.rec.todos) { tot += d.rec.todos.length; done += d.rec.todos.filter(t => t.done).length; } });
    monthly.push({ month: m, avgW, drink, exCounts, tot, done });
  }

  const totalDrink = monthly.reduce((s, m) => s + m.drink, 0);
  const totalByType = EXERCISE_TYPES.map(type => ({
    type,
    total: monthly.reduce((s, m) => s + m.exCounts[type.key], 0),
  }));
  const weightVals = monthly.filter(m => m.avgW != null).map(m => m.avgW);
  const yearAvgWeight = weightVals.length ? weightVals.reduce((a, b) => a + b, 0) / weightVals.length : null;
  const totTodos = monthly.reduce((s, m) => s + m.tot, 0);
  const doneTodos = monthly.reduce((s, m) => s + m.done, 0);

  const stats = document.createElement("div");
  stats.className = "stat-grid";
  stats.appendChild(statTile("연평균 체중", yearAvgWeight != null ? yearAvgWeight.toFixed(1) + " kg" : "-"));
  stats.appendChild(statTile("총 음주 일수", totalDrink + "일"));
  totalByType.forEach(({ type, total }) => stats.appendChild(statTile(`총 ${type.label}`, total + "일")));
  stats.appendChild(statTile("할 일 완료율", totTodos ? Math.round((doneTodos / totTodos) * 100) + "%" : "-"));
  root.appendChild(stats);

  const weightCard = document.createElement("div");
  weightCard.className = "card";
  weightCard.innerHTML = `<h3>월별 평균 체중</h3>`;
  const wWrap = document.createElement("div");
  weightCard.appendChild(wWrap);
  root.appendChild(weightCard);
  const wPoints = monthly.filter(m => m.avgW != null).map(m => ({ label: MONTH_NAMES[m.month].replace("월", ""), value: m.avgW }));
  if (wPoints.length) {
    drawLineChart(wWrap, wPoints, { color: "var(--series-weight)", unit: "kg" });
  } else {
    wWrap.innerHTML = `<div class="empty-hint">${yearYear}년에 기록된 체중이 없어요.</div>`;
  }

  const exCard = document.createElement("div");
  exCard.className = "card";
  exCard.innerHTML = `<h3>월별 운동 일수 (골프 / PT / 필라테스 / 러닝)</h3>`;
  const exWrap = document.createElement("div");
  exCard.appendChild(exWrap);
  root.appendChild(exCard);
  drawGroupedBarChart(exWrap, monthly.map(m => MONTH_NAMES[m.month].replace("월", "")), EXERCISE_TYPES.map(type => ({
    name: type.label,
    color: `var(${type.varColor})`,
    values: monthly.map(m => m.exCounts[type.key]),
  })));

  const drinkCard = document.createElement("div");
  drinkCard.className = "card";
  drinkCard.innerHTML = `<h3>월별 음주 일수</h3>`;
  const drinkWrap = document.createElement("div");
  drinkCard.appendChild(drinkWrap);
  root.appendChild(drinkCard);
  drawGroupedBarChart(drinkWrap, monthly.map(m => MONTH_NAMES[m.month].replace("월", "")), [
    { name: "음주", color: "var(--series-drink)", values: monthly.map(m => m.drink) },
  ]);
}

/* ---------- Charts (hand-rolled SVG, thin marks, hover tooltip) ---------- */
function resolveColor(v) {
  if (v.startsWith("var(")) {
    const varName = v.slice(4, -1);
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }
  return v;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function ensureTooltip(wrap) {
  let tip = wrap.querySelector(".chart-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "chart-tooltip";
    wrap.appendChild(tip);
  }
  return tip;
}

function drawLineChart(container, points, opts) {
  opts = opts || {};
  const color = resolveColor(opts.color || "var(--series-weight)");
  const unit = opts.unit || "";
  const width = container.clientWidth || 600;
  const height = 200;
  const padL = 40, padR = 16, padT = 16, padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const values = points.map(p => p.value);
  let minV = Math.min(...values), maxV = Math.max(...values);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const pad = (maxV - minV) * 0.15;
  minV -= pad; maxV += pad;

  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  const svg = svgEl("svg", { width: "100%", height, viewBox: `0 0 ${width} ${height}` });

  const gridlineColor = resolveColor("var(--gridline)");
  const baselineColor = resolveColor("var(--baseline)");
  const mutedColor = resolveColor("var(--text-muted)");

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = minV + ((maxV - minV) * i) / yTicks;
    const y = padT + plotH - (plotH * i) / yTicks;
    svg.appendChild(svgEl("line", { x1: padL, x2: width - padR, y1: y, y2: y, stroke: gridlineColor, "stroke-width": 1 }));
    const t = svgEl("text", { x: padL - 8, y: y + 3, "text-anchor": "end", fill: mutedColor });
    t.textContent = v.toFixed(1);
    svg.appendChild(t);
  }

  const n = points.length;
  const xStep = n > 1 ? plotW / (n - 1) : 0;
  const xFor = i => padL + (n > 1 ? xStep * i : plotW / 2);
  const yFor = v => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  svg.appendChild(svgEl("line", { x1: padL, x2: width - padR, y1: padT + plotH, y2: padT + plotH, stroke: baselineColor, "stroke-width": 1 }));

  const step = Math.max(1, Math.ceil(n / 8));
  points.forEach((p, i) => {
    if (i % step === 0 || i === n - 1) {
      const t = svgEl("text", { x: xFor(i), y: height - 6, "text-anchor": "middle", fill: mutedColor });
      t.textContent = p.label;
      svg.appendChild(t);
    }
  });

  let d = "";
  points.forEach((p, i) => { d += (i === 0 ? "M" : "L") + xFor(i) + "," + yFor(p.value) + " "; });
  svg.appendChild(svgEl("path", { d, fill: "none", stroke: color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }));

  const tip = ensureTooltip(wrap);
  points.forEach((p, i) => {
    const cx = xFor(i), cy = yFor(p.value);
    const c = svgEl("circle", { cx, cy, r: 4, fill: color, stroke: resolveColor("var(--surface-1)"), "stroke-width": 1.5, style: "cursor:pointer" });
    c.addEventListener("mouseenter", () => {
      tip.style.display = "block";
      tip.textContent = `${p.label}: ${p.value.toFixed(1)}${unit}`;
      const rect = wrap.getBoundingClientRect();
      tip.style.left = Math.min(cx, width - 90) + "px";
      tip.style.top = Math.max(cy - 34, 0) + "px";
    });
    c.addEventListener("mouseleave", () => { tip.style.display = "none"; });
    svg.appendChild(c);
  });

  wrap.appendChild(svg);
  container.innerHTML = "";
  container.appendChild(wrap);
}

function drawBarChart(container, items, opts) {
  opts = opts || {};
  const width = container.clientWidth || 600;
  const height = 180;
  const padL = 16, padR = 16, padT = 16, padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxV = Math.max(1, ...items.map(i => i.value));

  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  const svg = svgEl("svg", { width: "100%", height, viewBox: `0 0 ${width} ${height}` });
  const mutedColor = resolveColor("var(--text-muted)");
  const baselineColor = resolveColor("var(--baseline)");

  const n = items.length;
  const gap = 16;
  const barW = (plotW - gap * (n - 1)) / n;
  const tip = ensureTooltip(wrap);

  items.forEach((item, i) => {
    const x = padL + i * (barW + gap);
    const barH = (item.value / maxV) * plotH;
    const y = padT + plotH - barH;
    const rect = svgEl("rect", { x, y, width: barW, height: Math.max(barH, 1), rx: 4, fill: resolveColor(item.color), style: "cursor:pointer" });
    rect.addEventListener("mouseenter", () => {
      tip.style.display = "block";
      tip.textContent = `${item.label}: ${item.value}일`;
      tip.style.left = Math.min(x, width - 90) + "px";
      tip.style.top = Math.max(y - 34, 0) + "px";
    });
    rect.addEventListener("mouseleave", () => { tip.style.display = "none"; });
    svg.appendChild(rect);

    const valText = svgEl("text", { x: x + barW / 2, y: y - 6, "text-anchor": "middle", fill: mutedColor });
    valText.textContent = item.value;
    svg.appendChild(valText);

    const labelText = svgEl("text", { x: x + barW / 2, y: height - 8, "text-anchor": "middle", fill: mutedColor });
    labelText.textContent = item.label;
    svg.appendChild(labelText);
  });

  svg.appendChild(svgEl("line", { x1: padL, x2: width - padR, y1: padT + plotH, y2: padT + plotH, stroke: baselineColor, "stroke-width": 1 }));

  wrap.appendChild(svg);
  container.innerHTML = "";
  container.appendChild(wrap);
}

function drawGroupedBarChart(container, categories, series) {
  const width = container.clientWidth || 600;
  const height = 200;
  const padL = 28, padT = 16, padB = 30;
  const padRight = 16;
  const plotW = width - padL - padRight;
  const plotH = height - padT - padB;
  const maxV = Math.max(1, ...series.flatMap(s => s.values));

  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  const svg = svgEl("svg", { width: "100%", height, viewBox: `0 0 ${width} ${height}` });
  const mutedColor = resolveColor("var(--text-muted)");
  const baselineColor = resolveColor("var(--baseline)");
  const gridlineColor = resolveColor("var(--gridline)");

  const yTicks = 3;
  for (let i = 0; i <= yTicks; i++) {
    const v = (maxV * i) / yTicks;
    const y = padT + plotH - (plotH * i) / yTicks;
    svg.appendChild(svgEl("line", { x1: padL, x2: width - padRight, y1: y, y2: y, stroke: gridlineColor, "stroke-width": 1 }));
    const t = svgEl("text", { x: padL - 6, y: y + 3, "text-anchor": "end", fill: mutedColor });
    t.textContent = Math.round(v);
    svg.appendChild(t);
  }

  const n = categories.length;
  const groupGap = 6;
  const groupW = plotW / n;
  const seriesCount = series.length;
  const barGap = 2;
  const barW = Math.max(2, (groupW - groupGap - barGap * (seriesCount - 1)) / seriesCount);

  const tip = ensureTooltip(wrap);

  categories.forEach((cat, ci) => {
    const groupX = padL + ci * groupW + groupGap / 2;
    series.forEach((s, si) => {
      const val = s.values[ci];
      const x = groupX + si * (barW + barGap);
      const barH = (val / maxV) * plotH;
      const y = padT + plotH - barH;
      const rect = svgEl("rect", { x, y, width: barW, height: Math.max(barH, val > 0 ? 1 : 0), rx: 3, fill: resolveColor(s.color), style: "cursor:pointer" });
      rect.addEventListener("mouseenter", () => {
        tip.style.display = "block";
        tip.textContent = `${cat} · ${s.name}: ${val}일`;
        tip.style.left = Math.min(x, width - 100) + "px";
        tip.style.top = Math.max(y - 34, 0) + "px";
      });
      rect.addEventListener("mouseleave", () => { tip.style.display = "none"; });
      svg.appendChild(rect);
    });
    const labelText = svgEl("text", { x: groupX + (groupW - groupGap) / 2, y: height - 8, "text-anchor": "middle", fill: mutedColor });
    labelText.textContent = cat;
    svg.appendChild(labelText);
  });

  svg.appendChild(svgEl("line", { x1: padL, x2: width - padRight, y1: padT + plotH, y2: padT + plotH, stroke: baselineColor, "stroke-width": 1 }));

  wrap.appendChild(svg);
  container.innerHTML = "";
  container.appendChild(wrap);

  if (series.length > 1) {
    const legend = document.createElement("div");
    legend.className = "legend";
    series.forEach(s => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${resolveColor(s.color)}"></span>${s.name}`;
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }
}

/* ---------- Pomodoro ---------- */
const POMO_DURATIONS = {
  25: { label: "25분", work: 25 * 60, break: 5 * 60 },
  50: { label: "50분", work: 50 * 60, break: 10 * 60 },
};
let pomoDurationKey = 25;
let pomoRemaining = POMO_DURATIONS[pomoDurationKey].work;
let pomoMode = "work"; // work | break
let pomoRunning = false;
let pomoTimerId = null;
let pomoCyclesToday = 0;

function renderPomodoro() {
  const root = document.getElementById("pomodoro-root");
  root.innerHTML = "";
  const rec = getRecord(todayStr());
  pomoCyclesToday = rec.pomodoroCount || 0;

  const wrap = document.createElement("div");
  wrap.className = "pomo-wrap";
  wrap.innerHTML = `
    <div class="pill-group" id="pomo-duration-group" style="justify-content:center; margin-bottom: 6px;">
      ${Object.keys(POMO_DURATIONS).map(key => `<button class="pill duration${Number(key) === pomoDurationKey ? " selected" : ""}" data-duration="${key}">${POMO_DURATIONS[key].label} 집중</button>`).join("")}
    </div>
    <div class="pomo-mode" id="pomo-mode-label">집중 시간</div>
    <div class="pomo-ring-wrap"><svg width="180" height="180" viewBox="0 0 180 180">
      <circle cx="90" cy="90" r="80" fill="none" stroke="${resolveColor('var(--gridline)')}" stroke-width="8"/>
      <circle id="pomo-ring" cx="90" cy="90" r="80" fill="none" stroke="${resolveColor('var(--accent)')}" stroke-width="8"
        stroke-linecap="round" transform="rotate(-90 90 90)" stroke-dasharray="${2 * Math.PI * 80}" />
    </svg></div>
    <div class="pomo-time" id="pomo-time">25:00</div>
    <div class="pomo-controls">
      <button class="btn" id="pomo-start">시작</button>
      <button class="btn secondary" id="pomo-reset">초기화</button>
    </div>
    <div class="pomo-stats">오늘 완료한 뽀모도로: <strong id="pomo-count">${pomoCyclesToday}</strong>회</div>
  `;
  root.appendChild(wrap);

  updatePomoDisplay();
  document.getElementById("pomo-start").addEventListener("click", togglePomo);
  document.getElementById("pomo-reset").addEventListener("click", resetPomo);
  document.querySelectorAll("#pomo-duration-group .pill").forEach(btn => {
    btn.addEventListener("click", () => selectPomoDuration(Number(btn.dataset.duration)));
  });
}

function selectPomoDuration(key) {
  pomoDurationKey = key;
  resetPomo();
  renderPomodoro();
}

function togglePomo() {
  pomoRunning = !pomoRunning;
  const btn = document.getElementById("pomo-start");
  if (pomoRunning) {
    btn.textContent = "일시정지";
    pomoTimerId = setInterval(pomoTick, 1000);
  } else {
    btn.textContent = "시작";
    clearInterval(pomoTimerId);
  }
}

function resetPomo() {
  pomoRunning = false;
  clearInterval(pomoTimerId);
  pomoMode = "work";
  pomoRemaining = POMO_DURATIONS[pomoDurationKey].work;
  const btn = document.getElementById("pomo-start");
  if (btn) btn.textContent = "시작";
  updatePomoDisplay();
}

function pomoTick() {
  pomoRemaining--;
  if (pomoRemaining <= 0) {
    const dur = POMO_DURATIONS[pomoDurationKey];
    if (pomoMode === "work") {
      pomoCyclesToday++;
      updateRecord(todayStr(), { pomodoroCount: pomoCyclesToday });
      pomoMode = "break";
      pomoRemaining = dur.break;
    } else {
      pomoMode = "work";
      pomoRemaining = dur.work;
    }
  }
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const timeEl = document.getElementById("pomo-time");
  const modeEl = document.getElementById("pomo-mode-label");
  const countEl = document.getElementById("pomo-count");
  const ring = document.getElementById("pomo-ring");
  if (!timeEl) return;
  const m = Math.floor(pomoRemaining / 60), s = pomoRemaining % 60;
  timeEl.textContent = `${pad2(m)}:${pad2(s)}`;
  modeEl.textContent = pomoMode === "work" ? "집중 시간" : "휴식 시간";
  if (countEl) countEl.textContent = pomoCyclesToday;
  const dur = POMO_DURATIONS[pomoDurationKey];
  const total = pomoMode === "work" ? dur.work : dur.break;
  const frac = pomoRemaining / total;
  const circumference = 2 * Math.PI * 80;
  if (ring) {
    ring.setAttribute("stroke-dasharray", String(circumference));
    ring.setAttribute("stroke-dashoffset", String(circumference * (1 - frac)));
    ring.setAttribute("stroke", resolveColor(pomoMode === "work" ? "var(--accent)" : "var(--series-pilates)"));
  }
}

/* ---------- Data import/export ---------- */
document.getElementById("export-btn").addEventListener("click", exportData);
document.getElementById("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importDataFromFile(file);
  e.target.value = "";
});

/* ---------- Init ---------- */
renderToday();
renderCalendar();
