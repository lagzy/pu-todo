# `plan.json` — Format und Regeln

Diese Datei ist die **einzige Datenquelle** der Seite. Wer etwas ändert, ändert nur
hier — `index.html`, `style.css` und `app.js` enthalten keine Aufgaben.

Nach jeder Änderung:

```
py -3 tools/check_plan.py     # letzte Zeile muss «ALL CHECKS PASSED» sein
git add -A && git commit -m "Plan: …" && git push
```

GitHub Pages baut danach in etwa einer Minute neu. Die Seite liest die Datei bei
jedem Aufruf neu (`cache: no-cache`) — kein Cache-Problem.

## Aufbau

```json
{
  "schema": "pu-todo/1",
  "updated": "2026-11-15",
  "note": "eine Zeile, woher die Aufgaben stammen",
  "schedule": { "weekday": "Dienstag", "start": "13:30", "end": "16:10", "label": "…" },
  "people": [
    { "id": "vlad", "name": "Vlad", "full": "Vladyslav Khomenko", "role": "Firmware · Webseite · Dossier" }
  ],
  "days": [ /* ein Eintrag pro PU-Diensttag, chronologisch */ ]
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `schema` | ja | immer `"pu-todo/1"` |
| `updated` | ja | Datum der letzten Änderung, `JJJJ-MM-TT`; steht in der Fusszeile |
| `schedule` | ja | Rahmen des PU: `start`/`end` als `HH:MM`. Blöcke müssen darin liegen |
| `people` | ja | `id` (klein, keine Leerzeichen), `name` (so wie in der Spalte), `role` (eine Zeile) |
| `days` | ja | chronologisch, ein Eintrag pro Dienstag |

### Ein Tag

```json
{
  "date": "2026-11-17",
  "title": "Kuchenverkauf",
  "kind": "event",
  "note": "Ein Satz, der am Tag selbst hilft.",
  "prep": [
    { "who": "edward", "text": "Kuchen einkaufen (Migros), ein Kassenbon",
      "note": "Plan 24.60 CHF, 48 Stück.", "due": "Mo 16.11. Abend" }
  ],
  "blocks": [
    {
      "n": 1,
      "start": "13:30",
      "end": "14:30",
      "title": "Stand aufbauen, 1. Pause verkaufen",
      "tasks": [
        { "who": ["dorian", "edward"], "text": "1. Pause: verkaufen — einer nimmt Geld, einer gibt Kuchen" },
        { "who": "edward", "text": "Tisch aufstellen", "note": "Decke drüber, Kuchen mitbringen" }
      ]
    }
  ]
}
```

| Feld | Pflicht | Regel |
|---|---|---|
| `date` | ja | `JJJJ-MM-TT`, **muss ein Dienstag** sein, keine Doppelungen |
| `title` | ja | kurz, steht gross im Hero („Kuchenverkauf“) |
| `kind` | ja | `lesson` (normale Arbeit), `event` (Termin wie Kuchenverkauf), `deadline` (Abgabe, Präsentation) |
| `note` | empfohlen | ein Satz Kontext: Break-even, Frist, warum heute |
| `prep` | nein | was **vor** dem Tag fertig sein muss; erscheint als „Vorher erledigen“ |
| `blocks` | ja | `n` = 1…N in dieser Reihenfolge, `start` < `end`, innerhalb `schedule`, keine Überlappung |

### Eine Aufgabe

```json
{ "who": "vlad", "text": "Kasse zu zweit zählen", "note": "Nicht schätzen." }
```

- `who`: **eine** `id` aus `people` → die Aufgabe steht in dieser Personenspalte.
  **Ein Array** mit 2 oder 3 `id`s → die Aufgabe steht einmal oben im violetten
  „Gemeinsam“-Streifen (`["vlad","dorian","edward"]` heisst „Alle drei“).
- `text`: imperative Form, eine Zeile, **unter 120 Zeichen**. Kein Punkt am Ende
  nötig, keine Höflichkeitsfloskeln. Das wird auf dem Handy in der Pause gelesen.
- `note`: optional, warum oder wie — erscheint kleiner darunter.

## Regeln für Agenten (und Menschen)

1. **Nichts erfinden.** Jede Aufgabe stammt aus `STATUS.md`,
   `01_Dokumente/04_Pendenzenliste.docx`, `Kuchenverkauf/` oder einer bestätigten
   Teamaussage (Discord). Wenn eine Zuteilung nicht belegt ist: nach der Rolle
   zuordnen und im Commit-Text sagen, dass es eine Annahme ist.
2. **Keine neuen Personen.** Genau Vlad, Dorian, Edward. `people` nicht erweitern,
   ohne dass das Team es bestätigt (siehe `STATUS.md`, offene Frage 7 zu „Kligxy“).
3. **Deutsch, Schweizer Schreibweise:** `ss` statt `ß`, `13.30` nur im Fliesstext,
   in Zeiten aber immer `HH:MM` (`13:30`), weil die App damit rechnet.
4. **Termintage überschreiben den Klassen-Alltag.** Am Kuchenverkauf, an der Abgabe
   und an der Präsentation stehen nur die Aufgaben dieses Tages — keine
   Firmware-Arbeit „weil Dienstag ist“.
5. **Ein Tag bleibt stehen, auch wenn er vorbei ist.** Nicht löschen: die Seite
   zeigt vergangene Tage als „Vorbei“ und die Historie ist der Beleg, was geplant war.
   Neue Tage hinten anhängen, `updated` nachziehen.
6. **Zahlen nur mit Quelle.** Beträge (24.60 CHF, 2.00 CHF/Stück), Fristen und
   Anforderungs-IDs (`A-18`) so übernehmen, wie sie im Projektdokument stehen.
7. **Prüfen, dann pushen:** `py -3 tools/check_plan.py`. Das Skript meldet
   falsche Wochentage, überlappende Blöcke, unbekannte Personen und leere Texte.
8. **Kein Build.** Keine `.min.js`, keine Bibliotheken, keine externen Schriften —
   die Seite muss offline und in fünf Jahren noch aufgehen.
