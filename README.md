# PU-Plan — wer macht was, jetzt

Kleine Web-App für Gruppe 22 (Projektunterricht): **eine Liste pro Person und pro
Lektion**. Man öffnet die Seite und sieht sofort, was in der laufenden Lektion zu tun
ist — Vlad, Dorian und Edward nebeneinander. Keine Häkchen, kein Login, kein Server:
nur `index.html`, `style.css`, `app.js` und eine JSON-Datei.

**Live:** https://lagzy.github.io/pu-todo/

## Wie es funktioniert

Die Seite liest `data/plan.json` und vergleicht mit der Uhr des Geräts:

- **Dienstag, 13:30–16:10** → die Lektion, die gerade läuft, steht oben („JETZT ·
  Lektion 2 · noch 45 min“). Vor der ersten Lektion: „gleich · beginnt in 20 min“,
  in einer Pause: „pause · weiter um 15:30“. Nach 16:10 springt die Ansicht auf den
  nächsten Dienstag.
- **Jeder andere Tag** → der nächste PU mit Countdown („in 2 Tagen“), die Lektionen
  als Reiter 13:30 / 14:30 / 15:30, und die Vorher-Liste steht offen.
- **Termintage** (Kuchenverkauf, Abgabe, Präsentation) zeigen ihre eigenen Aufgaben.
  Am 17.11. steht also nicht „Firmware“, sondern Kuchen schneiden, Kasse zählen,
  Belege sammeln.
- Reiter antippen wechselt die Lektion, unten lassen sich die anderen Diensttage
  öffnen. Ohne Antippen aktualisiert sich die Seite alle 20 Sekunden selbst.

Alles steht in einer schmalen Spalte: Titel, eine Zeile Kontext, die drei Reiter,
dann die Aufgaben. Jede Aufgabe hat einen Titel (was tun) und einen Satz mit den
konkreten Punkten, links ein Haken für den Stand. „Vorher“ (was bis Montagabend
fertig sein muss) ist am Tag selbst zugeklappt, sonst offen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Aufbau der Seite |
| `style.css` | Gestaltung, hell und dunkel, Handy und Laptop |
| `app.js` | Uhr-Logik: welcher Tag, welche Lektion, was zeigen |
| `data/plan.json` | **die einzige Datenquelle** — hier wird alles gepflegt |
| `data/README.md` | Format der JSON-Datei, Anleitung zum Nachtragen |
| `tools/check_plan.py` | prüft die JSON-Datei (Datum, Zeiten, Personen) |

## Aufgaben ändern

Alles steht in `data/plan.json`. Kein Build, kein npm, keine Bibliothek.

```
py -3 tools/check_plan.py     # prüfen — letzte Zeile «ALL CHECKS PASSED»
```

Prüfen, committen, pushen — GitHub Pages baut die Seite danach in etwa einer Minute
neu. Wie die Datei aufgebaut ist, welche Felder Pflicht sind und was ein Agent beim
Nachtragen beachten muss, steht in [`data/README.md`](data/README.md).

## Lokal öffnen

Über `file://` blockiert der Browser das Laden der JSON-Datei. Darum:

```
py -3 -m http.server 8777 --directory pu-todo
```

und dann http://127.0.0.1:8777/ öffnen.

## Woher die Aufgaben kommen

`STATUS.md`, `04_Pendenzenliste.docx` (Version 5) und
`Kuchenverkauf/Kuchenverkauf_17.11_Plan.docx` im Projektordner. Die Zuteilung folgt
den Rollen (Vlad Firmware/Dossier, Dorian Töne/Regeln, Edward Hardware/Abrechnung);
was das Team anders verteilt, gehört hierher geändert.

Das Projekt selbst liegt in `C:\Users\Lenovo\Desktop\modes-planing 2`; dieser Ordner
ist ein eigenes Git-Repo (`lagzy/pu-todo`) und im Haupt-Repo per `.gitignore`
ausgenommen.
