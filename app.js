/* PU-Plan, was jetzt zu tun ist. Datenquelle: data/plan.json (Format pu-todo/2) */

const app = document.querySelector("#app");
let PLAN = null;
let sel = { date: null, block: null, manual: false };

const pad = (n) => String(n).padStart(2, "0");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const hhmm = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const localDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

const dayDiff = (iso) => {
  const a = localDate(iso).setHours(0, 0, 0, 0);
  const b = new Date().setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
};

const dayAgo = (n) => (n === 0 ? "heute" : n === 1 ? "morgen" : n < 0 ? `vor ${-n} Tagen` : `in ${n} Tagen`);

const dateLong = (iso) =>
  localDate(iso).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });

const dateShort = (iso) =>
  localDate(iso).toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });

const peopleById = () => Object.fromEntries(PLAN.people.map((p) => [p.id, p]));

const namesOf = (who) => {
  const arr = Array.isArray(who) ? who : [who];
  if (arr.length >= PLAN.people.length) return "Alle drei";
  const m = peopleById();
  return arr.map((id) => (m[id] ? m[id].name : id)).join(" + ");
};

const whoList = (t) => (Array.isArray(t.who) ? t.who : [t.who]);

/* ---------- Haken: Plan und lokal ---------- */

const LSK = "puplan.ticks";
const ticks = () => {
  try {
    return JSON.parse(localStorage.getItem(LSK) || "{}");
  } catch (e) {
    return {};
  }
};
const setTick = (k, v) => {
  const t = ticks();
  if (v) t[k] = 1;
  else delete t[k];
  try {
    localStorage.setItem(LSK, JSON.stringify(t));
  } catch (e) {}
};
const keyOf = (date, blockN, i) => `${date}|${blockN}|${i}`;

const nDone = (list) => list.filter((t) => t.done === true).length;

/* ---------- Tag und Lektion bestimmen ---------- */

function blockOfDay(day, n) {
  return (day.blocks || []).find((b) => b.n === n) || (day.blocks || [])[0] || null;
}

function pickDay() {
  const t = isoDate(new Date());
  for (const day of PLAN.days) {
    if (day.date === t) {
      const last = day.blocks[day.blocks.length - 1];
      if (last && nowMin() < hhmm(last.end)) return day;
      continue;
    }
  }
  return PLAN.days.find((d) => d.date > t) || PLAN.days[PLAN.days.length - 1];
}

function liveState(day) {
  const blocks = day.blocks || [];
  if (!blocks.length) return { mode: "empty", block: null };
  if (day.date !== isoDate(new Date())) {
    return dayDiff(day.date) > 0 ? { mode: "future", block: blocks[0] } : { mode: "past", block: blocks[blocks.length - 1] };
  }
  const t = nowMin();
  const running = blocks.find((b) => t >= hhmm(b.start) && t < hhmm(b.end));
  if (running) return { mode: "live", block: running };
  if (t < hhmm(blocks[0].start)) return { mode: "before", block: blocks[0] };
  if (t >= hhmm(blocks[blocks.length - 1].end)) return { mode: "after", block: blocks[blocks.length - 1] };
  return { mode: "break", block: blocks.find((b) => t < hhmm(b.start)) };
}

function status(day, st) {
  const t = nowMin();
  if (st.mode === "live") return { tag: "jetzt", cls: "live", line: `Lektion ${st.block.n} · noch ${Math.round(hhmm(st.block.end) - t)} min` };
  if (st.mode === "before") return { tag: "gleich", cls: "next", line: `beginnt in ${Math.round(hhmm(st.block.start) - t)} min` };
  if (st.mode === "break") return { tag: "pause", cls: "next", line: `weiter um ${st.block.start}` };
  if (st.mode === "after") return { tag: "fertig", cls: "done", line: "für heute durch" };
  if (st.mode === "past") return { tag: "vorbei", cls: "done", line: "" };
  return { tag: dayAgo(dayDiff(day.date)), cls: "next", line: "" };
}

/* ---------- eine Aufgabe: Titel, ein Satz, Haken ---------- */

function taskHTML(day, blockN, i, t, names) {
  const key = keyOf(day.date, blockN, i);
  const inPlan = t.done === true;
  const local = !inPlan && !!ticks()[key];
  const on = inPlan || local;
  const tip = inPlan ? "im Plan erledigt" : "antippen: nur in diesem Browser gemerkt";
  return `<li class="task${on ? " on" : ""}${inPlan ? " plan" : ""}${local ? " loc" : ""}">
    <label class="tk" title="${tip}">
      <input type="checkbox" data-key="${esc(key)}" data-plan="${inPlan ? "1" : "0"}"${on ? " checked" : ""}${inPlan ? " disabled" : ""}>
      <span class="bx" aria-hidden="true"></span>
      <span class="bd">
        ${names ? `<span class="who-l">${esc(names)}</span>` : ""}
        <span class="ttl">${esc(t.title || t.text)}</span>
        ${t.title && t.text ? `<span class="txt">${esc(t.text)}</span>` : ""}
      </span>
    </label>
  </li>`;
}

function columnsHTML(day, block) {
  const all = (block.tasks || []).map((t, i) => ({ t, i }));
  const single = all.filter(({ t }) => whoList(t).length === 1);
  const cols = PLAN.people.map((p) => {
    const mine = single.filter(({ t }) => whoList(t)[0] === p.id);
    const list = mine.map(({ t }) => t);
    const cnt = list.length ? `<span class="cnt">${nDone(list)}/${list.length}</span>` : "";
    return `<section class="col" data-person="${p.id}">
      <h3><span class="dot"></span><span class="nm">${esc(p.name)}</span>${cnt}</h3>
      ${
        mine.length
          ? `<ul class="tasks">${mine.map(({ t, i }) => taskHTML(day, block.n, i, t, "")).join("")}</ul>`
          : `<p class="none">nichts dabei</p>`
      }
    </section>`;
  });
  return `<div class="cols">${cols.join("")}</div>`;
}

function sharedHTML(day, block) {
  const all = (block.tasks || []).map((t, i) => ({ t, i }));
  const shared = all.filter(({ t }) => whoList(t).length > 1);
  if (!shared.length) return "";
  return `<ul class="tasks shared">${shared
    .map(({ t, i }) => taskHTML(day, block.n, i, t, whoList(t).length >= PLAN.people.length ? "" : namesOf(t.who)))
    .join("")}</ul>`;
}

function heroHTML(day, st, block) {
  const s = status(day, st);
  const meta = [dateLong(day.date), day.note].filter(Boolean).join(" · ");
  const all = (day.blocks || []).flatMap((b) => b.tasks || []);
  const done = nDone(all);
  const chips = (day.blocks || [])
    .map((b) => {
      const live = st.mode === "live" && st.block.n === b.n && day.date === isoDate(new Date());
      const past = day.date === isoDate(new Date()) && nowMin() >= hhmm(b.end);
      const active = block && b.n === block.n;
      return `<button class="chip${active ? " on" : ""}${live ? " live" : ""}${past ? " past" : ""}"
        type="button" data-block="${b.n}" aria-pressed="${active}">${b.start}</button>`;
    })
    .join("");
  return `<section class="hero">
    <p class="line"><span class="tag ${s.cls}">${esc(s.tag)}</span>${s.line ? `<span class="wt">${esc(s.line)}</span>` : ""}</p>
    <h1>${esc(day.title)}</h1>
    <p class="meta">${esc(meta)}</p>
    <p class="prog"><span class="cnt">${done}/${all.length}</span> erledigt</p>
    <div class="chips"><span class="chiplabel">${day.date > isoDate(new Date()) ? "Am Dienstag" : "Lektionen"}</span>${chips}</div>
  </section>`;
}

function blockHTML(day, block, st) {
  const live = st.mode === "live" && st.block && st.block.n === block.n;
  const all = block.tasks || [];
  return `<section class="block${live ? " live" : ""}">
    <h2><span class="bt">${esc(block.title)}</span><span class="cnt">${nDone(all)}/${all.length}</span><span class="t">${block.start}–${block.end}</span></h2>
    ${sharedHTML(day, block)}
    ${columnsHTML(day, block)}
  </section>`;
}

function prepHTML(day) {
  const prep = day.prep || [];
  if (!prep.length) return "";
  const m = peopleById();
  /* nach Person gruppieren: Vlad einmal, darunter seine Punkte */
  const groups = [];
  for (const p of prep) {
    const ids = whoList(p);
    const key = ids.join("+");
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, pid: ids[0], who: ids.map((k) => (m[k] ? m[k].name : k)).join(" + "), items: [] }));
    g.items.push(p);
  }
  const rows = groups
    .map(
      (g) => `<li><span class="who" data-person="${g.pid}">${esc(g.who)}</span><span class="items">${g.items
        .map(
          (p) =>
            `<span class="it${p.done ? " on" : ""}"><b>${esc(p.title || p.text)}</b>${p.title && p.text ? `<i>${esc(p.text)}</i>` : ""}</span>`
        )
        .join("")}</span></li>`
    )
    .join("");
  const label = day.prepLabel ? `, ${esc(day.prepLabel)}` : "";
  const head = `Vorher${label}`;
  if (day.date > isoDate(new Date())) {
    return `<section class="prep"><h2>${head}</h2><ul>${rows}</ul></section>`;
  }
  return `<details class="prep"><summary>${head}</summary><ul>${rows}</ul></details>`;
}

function bindTicks() {
  app.querySelectorAll("input[data-key][data-plan='0']").forEach((el) =>
    el.addEventListener("change", () => {
      setTick(el.dataset.key, el.checked);
      render();
    })
  );
}

function render() {
  if (!PLAN) return;
  const day = sel.date ? PLAN.days.find((d) => d.date === sel.date) : pickDay();
  if (!day) return;
  const st = liveState(day);
  const block = sel.block ? blockOfDay(day, sel.block) : st.block;

  app.innerHTML = [heroHTML(day, st, block), prepHTML(day), block ? blockHTML(day, block, st) : ""].join("");

  app.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      sel = { date: day.date, block: Number(chip.dataset.block), manual: true };
      render();
    })
  );

  bindTicks();
  renderDays(day.date);
  document.querySelector("#updated").textContent = PLAN.updated || "—";
}

function renderDays(activeDate) {
  const list = document.querySelector("#days");
  const more = document.querySelector("#more");
  const others = PLAN.days.filter((d) => d.date !== activeDate);
  more.hidden = !others.length;
  list.innerHTML = others
    .map(
      (d) => `<button class="daycard" type="button" data-date="${d.date}">
        <span class="d">${esc(dateShort(d.date))}</span>
        <span class="t">${esc(d.title)}</span>
        <span class="w">${esc(dayAgo(dayDiff(d.date)))}</span>
      </button>`
    )
    .join("");
  list.querySelectorAll(".daycard").forEach((c) =>
    c.addEventListener("click", () => {
      sel = { date: c.dataset.date, block: null, manual: true };
      window.scrollTo({ top: 0, behavior: "smooth" });
      render();
    })
  );
}

/* ---------- Uhr, Theme, Start ---------- */

function tickClock() {
  const el = document.querySelector("#clock");
  if (!el) return;
  const d = new Date();
  el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setupTheme() {
  const btn = document.querySelector("#theme");
  const set = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    btn.textContent = t === "dark" ? "HELL" : "DUNKEL";
    btn.setAttribute("aria-label", t === "dark" ? "Auf hell umschalten" : "Auf dunkel umschalten");
    try { localStorage.setItem("puplan.theme", t); } catch (e) {}
  };
  set(document.documentElement.getAttribute("data-theme") || "light");
  btn.addEventListener("click", () =>
    set(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark")
  );
}

async function boot() {
  setupTheme();
  tickClock();
  setInterval(tickClock, 15000);
  try {
    const res = await fetch("data/plan.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    PLAN = await res.json();
  } catch (e) {
    app.innerHTML = `<section class="hero"><h1>Plan nicht geladen</h1>
      <p class="meta">data/plan.json fehlt oder blockiert. Über file:// lädt der Browser
      die Datei nicht, bitte über einen Server oder die GitHub-Pages-Adresse öffnen.</p></section>`;
    return;
  }
  render();
  setInterval(() => { if (!sel.manual) render(); }, 20000);
}

boot();
