"""Prüft data/plan.json. Aufruf: py -3 tools/check_plan.py

Letzte Zeile ist «ALL CHECKS PASSED» oder «FAILURES: n» (Exit-Code bleibt 0,
wie bei den anderen Prüfskripten im Projekt — Erfolg an der Schlusszeile ablesen).
"""

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "data" / "plan.json"

HMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

fails: list[str] = []
warns: list[str] = []


def fail(msg: str) -> None:
    fails.append(msg)


def warn(msg: str) -> None:
    warns.append(msg)


def minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def check_task(where: str, task: dict, ids: set[str]) -> None:
    who = task.get("who")
    who_list = who if isinstance(who, list) else [who]
    if not who_list or not all(isinstance(w, str) and w for w in who_list):
        fail(f"{where}: Aufgabe ohne «who»: {task!r}")
        return
    for w in who_list:
        if w not in ids:
            fail(f"{where}: unbekannte Person «{w}» (bekannt: {', '.join(sorted(ids))})")
    if len(set(who_list)) != len(who_list):
        fail(f"{where}: «who» nennt eine Person doppelt: {who_list}")
    title = task.get("title")
    if not isinstance(title, str) or not title.strip():
        fail(f"{where}: Aufgabe ohne «title» (was tun, kurz, z.B. «Weiter an der Firmware»)")
    elif len(title) > 44:
        warn(f"{where}: Titel zu lang ({len(title)} Zeichen, max 44) — {title[:30]}…")
    text = task.get("text")
    if not isinstance(text, str) or not text.strip():
        fail(f"{where}: Aufgabe ohne «text»")
    elif len(text) > 90:
        warn(f"{where}: Text zu lang ({len(text)} Zeichen, max 90) — {text[:40]}…")
    if "done" in task and not isinstance(task["done"], bool):
        fail(f"{where}: «done» muss true oder false sein, ist {task['done']!r}")


def main() -> None:
    if not PLAN.exists():
        print(f"FEHLER: {PLAN} fehlt")
        print("FAILURES: 1")
        return

    try:
        plan = json.loads(PLAN.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"FEHLER: plan.json ist kein gültiges JSON — {e}")
        print("FAILURES: 1")
        return

    if plan.get("schema") != "pu-todo/2":
        fail(f"schema ist «{plan.get('schema')}», erwartet «pu-todo/2»")

    people = plan.get("people") or []
    ids = {p.get("id") for p in people if p.get("id")}
    if len(ids) != len(people):
        fail("people: jede Person braucht eine eindeutige «id»")
    for p in people:
        for key in ("name", "role"):
            if not p.get(key):
                fail(f"people: «{p.get('id')}» hat kein «{key}»")

    sched = plan.get("schedule") or {}
    for key in ("start", "end"):
        if not HMM.match(str(sched.get(key, ""))):
            fail(f"schedule.{key} ist keine Uhrzeit (HH:MM)")
    if HMM.match(str(sched.get("start", ""))) and HMM.match(str(sched.get("end", ""))):
        if minutes(sched["start"]) >= minutes(sched["end"]):
            fail("schedule: start liegt nicht vor end")

    days = plan.get("days") or []
    if not days:
        fail("days ist leer")

    seen_dates: set[str] = set()
    prev_date: str | None = None
    today = date.today()

    for day in days:
        raw = str(day.get("date", ""))
        try:
            d = datetime.strptime(raw, "%Y-%m-%d").date()
        except ValueError:
            fail(f"Tag «{raw}» ist kein Datum im Format JJJJ-MM-TT")
            continue
        where = f"{raw}"

        if raw in seen_dates:
            fail(f"{where}: Datum kommt doppelt vor")
        seen_dates.add(raw)

        if prev_date and raw < prev_date:
            fail(f"{where}: Tage sind nicht chronologisch (nach {prev_date})")
        prev_date = raw

        if d.weekday() != 1:
            fail(f"{where}: ist kein Dienstag — {day.get('title')}")
        if d < today:
            warn(f"{where}: liegt in der Vergangenheit")

        if not day.get("title"):
            fail(f"{where}: kein «title»")
        if day.get("kind") not in ("lesson", "event", "deadline"):
            fail(f"{where}: «kind» muss lesson, event oder deadline sein")
        if not day.get("note"):
            pass  # Notizen sind freiwillig und bleiben kurz

        prep = day.get("prep") or []
        for i, p in enumerate(prep, 1):
            check_task(f"{where} prep{i}", p, ids)
        if prep and not day.get("prepLabel"):
            warn(f"{where}: «prepLabel» fehlt (z.B. «bis Mo 16.11.»)")

        blocks = day.get("blocks") or []
        if not blocks:
            fail(f"{where}: keine «blocks»")
            continue

        nums = [b.get("n") for b in blocks]
        if nums != list(range(1, len(blocks) + 1)):
            fail(f"{where}: «n» muss 1…{len(blocks)} sein, ist {nums}")

        prev_end = None
        for b in blocks:
            bw = f"{where} Lektion {b.get('n')}"
            start, end = str(b.get("start", "")), str(b.get("end", ""))
            if not HMM.match(start) or not HMM.match(end):
                fail(f"{bw}: start/end müssen HH:MM sein ({start}/{end})")
                continue
            if minutes(start) >= minutes(end):
                fail(f"{bw}: start {start} liegt nicht vor end {end}")
            if HMM.match(str(sched.get("start", ""))) and minutes(start) < minutes(sched["start"]):
                fail(f"{bw}: beginnt vor PU-Beginn {sched['start']}")
            if HMM.match(str(sched.get("end", ""))) and minutes(end) > minutes(sched["end"]):
                fail(f"{bw}: endet nach PU-Schluss {sched['end']}")
            if prev_end is not None and minutes(start) < prev_end:
                fail(f"{bw}: überlappt die vorige Lektion (ab {prev_end // 60:02d}:{prev_end % 60:02d})")
            prev_end = minutes(end)

            if not b.get("title"):
                warn(f"{bw}: keine Überschrift")
            tasks = b.get("tasks") or []
            if not tasks:
                fail(f"{bw}: keine Aufgaben")
            for i, t in enumerate(tasks, 1):
                check_task(f"{bw} Aufgabe {i}", t, ids)

    print(f"Plan: {len(days)} Diensttage, {len(people)} Personen")
    for day in days:
        tasks = [t for b in day.get("blocks") or [] for t in (b.get("tasks") or [])]
        n_tasks = len(tasks)
        n_done = sum(1 for t in tasks if t.get("done") is True)
        n_prep = len(day.get("prep") or [])
        sp = ", ".join(f"{b.get('n')}:{b.get('start')}" for b in day.get("blocks") or [])
        print(f"  {day.get('date')}  {day.get('title'):<34} {n_done:>2}/{n_tasks:<2} erledigt  "
              f"{n_prep} vorher  [{sp}]")

    for w in warns:
        print(f"WARN  {w}")
    for f in fails:
        print(f"FAIL  {f}")

    if fails:
        print(f"WARNINGS: {len(warns)}")
        print(f"FAILURES: {len(fails)}")
    else:
        print(f"WARNINGS: {len(warns)}")
        print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
    sys.exit(0)
