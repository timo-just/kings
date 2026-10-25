# Kings im Browser

Der Start erfolgt über das Hauptmenü. Sprache wählen (Deutsch oder English), „Neues Spiel“ öffnen, Spielernamen eintragen und den Spielraum erstellen. Danach zeigt die Einladungsliste den eigenen Spielleiterlink und einen individuellen Link je Spieler. Die Links enthalten die gewählte Sprache; die Spielleitung verschickt nur die jeweiligen persönlichen Spielerlinks. Spieler ohne eigenes Gerät können weiter über das Spielleitergerät mitspielen.

„Hauptmenü“ verlässt die aktuelle Ansicht. „Spiel fortsetzen“ verbindet erneut mit dem zuletzt verwendeten Spielraum. Bestehende Einladungslinks bleiben gültig. Die Sprachwahl wird auf dem jeweiligen Gerät gespeichert. Namen und eigene Kategorien bleiben unverändert.

Browser-Version der Android-App aus `D:\MyApplication`. Keine externen Bibliotheken, kein Build nötig.

Lokal: `npm start`, dann http://127.0.0.1:4173 öffnen. Regeln prüfen: `npm test`.

GitHub Pages: In den Repository-Einstellungen unter Pages als Quelle **GitHub Actions** wählen. Der Workflow veröffentlicht bei Änderungen auf `main` unter https://timo-just.github.io/kings/.

Bis zu sechs Spieler, 32 Karten ohne Zurücklegen, Strafvergabe, Fragekönig, Daumenkönig mit drei Einsätzen, Ende beim vierten König, kumulative Folgerunden, Verlauf, Tabellen und PNG-/Text-Export. Der Spielstand wird lokal im Browser gespeichert. Ein Glas sind 16 Schlücke. Ass, Dame und Fragekönig addieren höchstens acht Schlücke bis zum Glasende.

Die erste Person beginnt; die Android-App übersprang sie durch einen vorgezogenen Spielerwechsel. Namen und Farben bleiben über leere Eingabefelder hinweg eindeutig. Statistik und Verlauf werden bei zugewiesenen Strafen sofort aktualisiert.
