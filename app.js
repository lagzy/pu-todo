/* PU-Plan — zeigt, was in der PU-Lektion jetzt zu tun ist.
   Datenquelle ist ausschliesslich data/plan.json. Hier steht keine Aufgabe. */

const app = document.querySelector("#app");

let PLAN = null;
let sel = { date: null, block: null, manual: false };

/* ---------- kleine Helfer ---------- */

const pad = (n) => String(n).padStart(2, "0");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const hhmm = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

const fmtHM = (min) => `${pad(Math.floor(min / 60))}:${pad(Math.round(min % 60))}`;

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

const dayAgo = (n) =>
  n === 0 ? "heute" : n === 1 ? "morgen" : n < 0 ? `vor ${-n} Tagen` : `in ${n} Tagen`;

const dateLong = (iso) => {
  const d = localDate(iso);
  return d.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
};

const dateShort = (iso) => {
  const d = localDate(iso);
  return d.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });
};

const peopleById = () => {
  const map = {};
  for (const p of PLAN.people) map[p.id] = p;
  return map;
};

const namesOf = (who) => {
  const arr = Array.isArray(who) ? who : [who];
  if (arr.length >= PLAN.people.length) return "Alle drei";
  const m = peopleById();
  return arr.map((id) => (m[id] ? m[id].name : id)).join(" + ");
};

/* ---------- Auswahl: welcher Tag, welche Lektion ---------- */

function blockOfDay(day, n) {
  const b = (day.blocks || []).find((x) => x.n === n);
  return b || (day.blocks || [])[0] || null;
}

function pickDay() {
  const t = isoDate(new Date());
  for (const day of PLAN.days) {
    if (day.date === t) {
      /* heute: erst nach der letzten Lektion auf den nächsten Tag springen */
      const last = day.blocks[day.blocks.length - 1];
      if (last && nowMin() < hhmm(last.end)) return day;
      continue;
    }
  }
  return PLAN.days.find((d) => d.date > t) || PLAN.days[PLAN.days.length - 1];
}

/* Was läuft gerade? Gibt Status + die Lektion, die man zeigen soll. */
function liveState(day) {
  const isToday = day.date === isoDate(new Date());
  const blocks = day.blocks || [];
  if (!blocks.length) return { mode: "empty", block: null };

  if (!isToday) {
    return dayDiff(day.date) > 0
      ? { mode: "future", block: blocks[0] }
      : { mode: "past", block: blocks[blocks.length - 1] };
  }

  const t = nowMin();
  const running = blocks.find((b) => t >= hhmm(b.start) && t < hhmm(b.end));
  if (running) return { mode: "live", block: running };

  if (t < hhmm(blocks[0].start)) return { mode: "before", block: blocks[0] };
  if (t >= hhmm(blocks[blocks.length - 1].end)) return { mode: "after", block: blocks[blocks.length - 1] };

  const next = blocks.find((b) => t < hhmm(b.start));
  return { mode: "break", block: next || blocks[blocks.length - 1] };
}

function statusText(day, st) {
  const t = nowMin();
  switch (st.mode) {
    case "live": {
      const left = Math.max(0, Math.round(hhmm(st.block.end) - t));
      return { kicker: "Jetzt", text: `Lektion ${st.block.n} läuft · noch ${left} min`, cls: "live" };
    }
    case "before": {
      const left = Math.max(0, Math.round(hhmm(st.block.start) - t));
      return { kicker: "Gleich", text: left <= 1 ? "beginnt jetzt" : `beginnt in ${left} min`, cls: "next" };
    }
    case "break": {
      const left = Math.max(0, Math.round(hhmm(st.block.start) - t));
      return { kicker: "Pause", text: `Lektion ${st.block.n} um ${st.block.start} · in ${left} min`, cls: "next" };
    }
    case "after":
      return { kicker: "Fertig", text: "für heute durch", cls: "done" };
    case "past":
      return { kicker: "Vorbei", text: `${dateShort(day.date)} · ${dayAgo(dayDiff(day.date))}`, cls: "done" };
    case "future":
      return { kicker: "Nächster PU", text: `${dateShort(day.date)} · ${dayAgo(dayDiff(day.date))}`, cls: "future" };
    default:
      return { kicker: "Nächster PU", text: dateShort(day.date), cls: "future" };
  }
}

/* ---------- Bausteine ---------- */

function taskHTML(task) {
  const note = task.note ? `<span class="note">${esc(task.note)}</span>` : "";
  return `<li class="task">${esc(task.text)}${note}</li>`;
}

function sharedHTML(tasks) {
  if (!tasks.length) return "";
  return `<div class="shared">
    <ul>${tasks.map((t) => `<li class="task"><span class="shared-who">${esc(namesOf(t.who))}</span>${esc(t.text)}${t.note ? `<span class="note">${esc(t.note)}</span>` : ""}</li>`).join("")}</ul>
  </div>`;
}

function columnsHTML(block) {
  const tasks = (block.tasks || []).filter((t) => {
    const arr = Array.isArray(t.who) ? t.who : [t.who];
    return arr.length === 1;
  });
  const cols = PLAN.people.map((p) => {
    const mine = tasks.filter((t) => (Array.isArray(t.who) ? t.who[0] : t.who) === p.id);
    const body = mine.length
      ? `<ul>${mine.map(taskHTML).join("")}</ul>`
      : `<p class="none">Nichts in dieser Lektion.</p>`;
    return `<section class="col" data-person="${p.id}">
      <header><span class="dot"></span><h3>${esc(p.name)}</h3><span class="role">${esc(p.role)}</span></header>
      ${body}
    </section>`;
  });
  return `<div class="cols">${cols.join("")}</div>`;
}

function prepHTML(day) {
  const prep = day.prep || [];
  if (!prep.length) return "";
  const m = peopleById();
  const rows = prep.map((p) => {
    const who = Array.isArray(p.who) ? p.who.map((id) => (m[id] ? m[id].name : id)).join(" + ") : (m[p.who] ? m[p.who].name : p.who);
    return `<li><span class="who" data-person="${Array.isArray(p.who) ? p.who[0] : p.who}">${esc(who)}</span>
      <span class="txt">${esc(p.text)}${p.note ? `<span class="note">${esc(p.note)}</span>` : ""}</span>
      ${p.due ? `<span class="due">${esc(p.due)}</span>` : ""}</li>`;
  });
  return `<section class="card prep">
    <h2>Vorher erledigen</h2>
    <ul class="prep-list">${rows.join("")}</ul>
  </section>`;
}

function restHTML(day, currentBlock) {
  const idx = (day.blocks || []).indexOf(currentBlock);
  const rest = (day.blocks || []).slice(idx + 1);
  if (!rest.length) return "";
  const m = peopleById();
  const blocks = rest.map((b) => {
    const shared = (b.tasks || []).filter((t) => (Array.isArray(t.who) ? t.who : [t.who]).length > 1);
    const single = (b.tasks || []).filter((t) => (Array.isArray(t.who) ? t.who : [t.who]).length === 1);
    const rows = [];
    for (const p of PLAN.people) {
      const mine = single.filter((t) => (Array.isArray(t.who) ? t.who[0] : t.who) === p.id);
      if (!mine.length) continue;
      rows.push(`<li><span class="who" data-person="${p.id}">${esc(p.name)}</span>
        <span class="txt">${mine.map((t) => esc(t.text)).join(" · ")}</span></li>`);
    }
    for (const t of shared) {
      rows.push(`<li><span class="who all">${esc(namesOf(t.who))}</span><span class="txt">${esc(t.text)}</span></li>`);
    }
    return `<div class="rest-block">
      <h3><span class="time">${b.start}–${b.end}</span> ${esc(b.title)}</h3>
      <ul>${rows.join("")}</ul>
    </div>`;
  });
  return `<section class="card rest">
    <h2>Danach an diesem Tag</h2>
    ${blocks.join("")}
  </section>`;
}

function chipsHTML(day, currentBlock) {
  const t = nowMin();
  const isToday = day.date === isoDate(new Date());
  const chips = (day.blocks || []).map((b) => {
    const live = isToday && t >= hhmm(b.start) && t < hhmm(b.end);
    const past = isToday && t >= hhmm(b.end);
    const active = currentBlock && b.n === currentBlock.n;
    return `<button class="chip${active ? " is-active" : ""}${live ? " is-live" : ""}${past ? " is-past" : ""}"
      type="button" data-block="${b.n}" aria-pressed="${active}">
      <span class="chip-time">${b.start}–${b.end}</span>
      <span class="chip-label">Lektion ${b.n}</span>
    </button>`;
  });
  return `<div class="chips" role="tablist">${chips.join("")}</div>`;
}

function heroHTML(day, st, block) {
  const s = statusText(day, st);
  const kindLabel = { event: "Termin", deadline: "Abgabe", lesson: "Arbeit" }[day.kind] || "";
  return `<section class="card hero">
    <div class="statusline">
      <span class="kicker ${s.cls}">${s.kicker}</span>
      <span class="status-text">${esc(s.text)}</span>
      ${kindLabel ? `<span class="kind ${day.kind}">${kindLabel}</span>` : ""}
    </div>
    <h2 class="day-title">${esc(day.title)}</h2>
    <p class="day-date">${esc(dateLong(day.date))} · ${dayAgo(dayDiff(day.date))}</p>
    ${day.note ? `<p class="day-note">${esc(day.note)}</p>` : ""}
    ${chipsHTML(day, block)}
  </section>`;
}

function blockHTML(block, st) {
  const t = nowMin();
  const live = st.mode === "live" && st.block.n === block.n;
  const left = live ? Math.max(0, Math.round(hhmm(block.end) - t)) : null;
  const shared = (block.tasks || []).filter((x) => (Array.isArray(x.who) ? x.who : [x.who]).length > 1);
  return `<section class="card block${live ? " is-live" : ""}">
    <div class="block-head">
      <h2><span class="time">${block.start}–${block.end}</span> ${esc(block.title)}</h2>
      ${live ? `<span class="pill">noch ${left} min</span>` : ""}
    </div>
    ${sharedHTML(shared)}
    ${columnsHTML(block)}
  </section>`;
}

/* ---------- Rendern ---------- */

function render() {
  if (!PLAN) return;
  const auto = sel.manual ? null : pickDay();
  const day = sel.date ? PLAN.days.find((d) => d.date === sel.date) : auto;
  if (!day) return;

  const st = liveState(day);
  const block = sel.block ? blockOfDay(day, sel.block) : st.block;

  app.innerHTML = [
    heroHTML(day, st, block),
    block ? blockHTML(block, st) : "",
    prepHTML(day),
    block ? restHTML(day, block) : "",
  ].join("");

  wire();
  renderDays(day.date);
  document.querySelector("#updated").textContent = PLAN.updated || "—";
}

function wire() {
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const day = PLAN.days.find((d) => d.date === sel.date) || pickDay();
      sel = { date: day.date, block: Number(chip.dataset.block), manual: true };
      render();
    });
  });
}

function renderDays(activeDate) {
  const list = document.querySelector("#days");
  const more = document.querySelector("#more");
  if (!list || !more) return;
  const others = PLAN.days.filter((d) => d.date !== activeDate);
  if (!others.length) { more.hidden = true; return; }
  more.hidden = false;
  list.innerHTML = others
    .map((d) => {
      const n = dayDiff(d.date);
      return `<button class="daycard" type="button" data-date="${d.date}">
        <span class="dc-date">${esc(dateShort(d.date))}</span>
        <span class="dc-title">${esc(d.title)}</span>
        <span class="dc-when">${esc(dayAgo(n))}</span>
      </button>`;
    })
    .join("");
  list.querySelectorAll(".daycard").forEach((c) => {
    c.addEventListener("click", () => {
      sel = { date: c.dataset.date, block: null, manual: true };
      window.scrollTo({ top: 0, behavior: "smooth" });
      render();
    });
  });
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
    btn.textContent = t === "dark" ? "☀️" : "🌙";
    try { localStorage.setItem("puplan.theme", t); } catch (e) {}
  };
  set(document.documentElement.getAttribute("data-theme") || "light");
  btn.addEventListener("click", () => {
    set(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
}

async function boot() {
  setupTheme();
  tickClock();
  setInterval(tickClock, 1000);
  try {
    const res = await fetch("data/plan.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    PLAN = await res.json();
  } catch (e) {
    app.innerHTML = `<section class="card hero">
      <h2 class="day-title">Plan nicht geladen</h2>
      <p class="day-note">Die Datei <code>data/plan.json</code> konnte nicht gelesen werden.
      Über <code>file://</code> blockiert der Browser das Laden — bitte über einen Server öffnen
      (<code>py -3 -m http.server</code>) oder die GitHub-Pages-Adresse benutzen.</p>
    </section>`;
    return;
  }
  render();
  /* alle 20 s prüfen, ob eine neue Lektion begonnen hat */
  setInterval(() => { if (!sel.manual) render(); }, 20000);
}

boot();
