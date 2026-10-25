# Kings Spielserver

Ein SQLite-Durable-Object pro Spielraum, plus ein kleines Verzeichnis ausschließlich für den Besitzer. GitHub Pages liefert weiterhin die Website; der Worker `kings-api` übernimmt synchronisierte Aktionen und Speicherung.

## Zugriffe

Frage- und Daumenkönig erhalten in ihrem persönlichen Spielerzugang eine hervorgehobene Rollenkarte mit Zielauswahl. Die Serveraktion `useTitle` prüft den aktuellen Inhaber und verbraucht genau eine Nutzung. Andere Teilnehmer erhalten keinen fremden Rollenstatus im Live-Spielstand. In der Spielleiterübersicht zeigen die Rollenknöpfe Namen und Restnutzungen erst nach schnellem Doppeltipp für zwei Sekunden; ein einzelner Tipp öffnet weiterhin die Strafauswahl für Spieler ohne Handy.

Der Besitzerzugriff ist ein geheimer Zugangsschlüssel im Besitzerlink, kein persönliches Benutzerkonto. Der Browser speichert ihn lokal und sendet ihn im Authorization-Header. Der Server vergleicht dessen SHA-256 mit OWNER_HASH. Der Link darf deshalb nur dem Besitzer bekannt sein.

- Zufälliger Spielleiterlink: steuert genau diesen Raum. Ein serverseitig gespeicherter Gerätebezeichner erlaubt nur einer Spielleitung gleichzeitig Aktionen. Eine ausdrückliche Übernahme löst das vorherige Gerät ab.
- Zufälliger persönlicher Spielerlink: sieht den eigenen Stand und den Vergleich innerhalb dieses Raums, darf ausschließlich die eigenen Kategorien bearbeiten. Er darf keine Karten ziehen und keine Archivdateien öffnen.
- Separater Besitzerschlüssel: zeigt alle Räume und exportiert einzelne Runden als JSON. Dieser Schlüssel gehört weder in GitHub noch in Teilnehmerlinks. Er wird im Browserfragment übergeben und anschließend aus der Adresse entfernt; API-Anfragen verwenden einen Authorization-Header.

Die Links sind Zugangsschlüssel: Wer einen persönlichen Link erhält, kann die zugehörige Ansicht öffnen. Keine Namensauswahl, mit der ein Gast fremde Spielerplätze übernehmen könnte.

## Dauerhafte Historie

In der privaten Historie öffnet „Ansehen“ eine gespeicherte Runde mit Graph, Kartentabellen und Protokoll. Die Werte werden relativ zum Anfang dieser Runde angezeigt. Bereits exportierte JSON-Dateien können im selben Fenster lokal geöffnet werden.

Spieler können Kategorien einzeln an ihre Warteschlange anhängen, verschieben und entfernen. Bei einer Dame wird der erste Eintrag des ziehenden Spielers entnommen und als Kategorie vorgeschlagen. Leere oder manuell eingegebene Kategorien bleiben möglich.

„Spiel abbrechen und löschen“ löscht nach ausdrücklicher Bestätigung den gesamten Spielraum mit allen Runden, Kategorien und Protokollen. Nur die aktive Spielleitung oder der Besitzer darf diese Aktion ausführen. Alle Teilnehmer werden abgemeldet; Einladungslinks werden ungültig. Andere Spielräume bleiben erhalten.

Räume haben kein automatisches Ablaufdatum. Jede Aktion wird mit Datum und Uhrzeit als Ereignis gespeichert. Aktueller Spielstand, Ereignis und Rundenübersicht werden gemeinsam in einer SQL-Transaktion geschrieben. „Neue Runde“ behält Gesamtwerte, Raum-ID und Zugänge; jede Runde bekommt zusätzlich einen eigenen Datensatz mit Anfangswerten, Endwerten und Dateinamen `datum_uhrzeit_spieler1_spieler2_…` (Europe/Berlin). Der JSON-Export enthält Statistiken dieser Runde, Gesamtstatistiken und die Ereignisse einschließlich Kategorien und Verlierern. Der Export entsteht bei Abruf; keine unnötigen Kopien oder Bilddateien auf dem Server.

Live-Nachrichten enthalten kompakte Spielstände statt der gesamten Historie. Statistikereignisse werden bei Bedarf seitenweise geladen, anschließend nur noch seit der letzten bekannten Ereignis-ID. Die Echtzeitverbindung verwendet WebSocket-Hibernation und wird bei verborgenem Browserfenster getrennt. Bilder werden nicht über den Worker übertragen.

## Kosten und Grenzen

Kein kostenpflichtiges Upgrade ist Teil der Bereitstellung. Für einen kostenlosen Betrieb muss das Cloudflare-Konto den Workers-Free-Tarif verwenden. Dieser hat unter anderem 100.000 Worker-/Durable-Object-Anfragen pro Tag und insgesamt 5 GB SQL-Speicher. Unbegrenzter kostenloser Betrieb ist nicht möglich. Nach Erreichen eines Free-Limits schlagen weitere betroffene Operationen fehl; es wird nicht automatisch ein kostenpflichtiger Tarif aktiviert. Quelle: https://developers.cloudflare.com/durable-objects/platform/pricing/

## Bereitstellung

Module: `backend/worker.mjs` als `main_module`, außerdem `engine.mjs`. Kompatibilitätsdatum `2026-10-25`.

Deklarative Exporte: `KingsRoom` und `KingsIndex`, jeweils `{ "type": "durable-object", "storage": "sqlite" }`.

Bindings: `ROOMS` → `KingsRoom`, `INDEX` → `KingsIndex`, `OWNER_HASH` → SHA-256 des außerhalb des Repositorys aufbewahrten zufälligen Besitzerschlüssels. `REQUEST_LIMIT` ist ein Rate-Limit-Binding (Namespace `1107001`, 120 Schreibanfragen je 60 Sekunden und IP). Logs und Traces sind mit 1 % Sampling aktiv, Querystrings werden ausgeblendet, Invocation-Logs sind deaktiviert.

Die Cloudflare-Verbindung benötigt `workers-scripts.write`. Eine neue OAuth-Anmeldung erfordert eventuell das Neuladen der bereits laufenden MCP-Verbindung.

## Prüfung

`npm ci --include=optional --legacy-peer-deps` unter Node 22; anschließend `npm test`. Die Tests laufen mit der offiziellen Cloudflare-Vitest-Integration in der lokalen Workers-Laufzeit und prüfen Raumtrennung, Teilnehmerrechte, Gerätewechsel, Kategoriedaten, SQLite-Speicherung, Archivschutz und WebSocket-Übertragung.
