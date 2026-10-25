# Weiterarbeit: Kings Mehrgeräte-Spiel

Stand: 25.10.2026. Website: https://timo-just.github.io/kings/ ; Repository: timo-just/kings.

## Vorgabe des Besitzers

Kein kostenpflichtiges Abo, kein Tarif-Upgrade und keine Abrechnungsrechte anfordern. Bereitstellung nur für Workers Free; keine Änderung von Subscriptions oder Billing. Leserechte reichen nicht für die Bereitstellung. Der benötigte OAuth-Scope ist workers-scripts.write.

## Fertig vorbereitet

Frontend und Backend in diesem Branch: persönliche Spielerlinks, ein aktives Spielleitergerät, WebSocket-Synchronisierung, Kategorienvorschläge, optionale Kategoriennamen und protokollierte Verlierer, beständige Räume mit mehreren Runden, private Rundenhistorie und JSON-Dateiexport mit Einzelrunden- und Gesamtstatistiken. Ass-Karten zeigen A. Lokales Spiel ohne Server und Spieler ohne Handy bleiben möglich.

Prüfungen: 8 Engine-Tests und 6 Integrationstests mit der offiziellen Cloudflare-Vitest-Laufzeit bestanden. Lokaler Browser-Test in tests/browser-qa.html bestand für A, lokales Spielen, Statistik-Tabs, Tabellen und optionale Kategorien.

## Veröffentlichung noch offen

Der Worker kings-api wurde NICHT bereitgestellt. Cloudflare-Konto: 07bff9283b4d6430a11c34832585b7ae; workers.dev-Subdomain: timo-just. Die CLI-OAuth-Anmeldung mit workers-scripts.write wurde bestätigt, die in diesem Chat laufende MCP-Verbindung gab beim Upload jedoch weiterhin 403 (fehlender workers-scripts.write Scope) zurück. Cloudflare-MCP-Verbindung beziehungsweise die gesamte Codex-Anwendung neu laden, dann mit dem angemeldeten Nutzer prüfen. Keine weitere pauschale Vollfreigabe anfordern.

Das Backend-README beschreibt Module und Bindings. Einen neuen zufälligen Besitzerschlüssel erst für die erste erfolgreiche Bereitstellung erzeugen, nur dessen SHA-256 als OWNER_HASH binden und den privaten Besitzerlink dem Nutzer direkt übergeben. Niemals Schlüssel in GitHub speichern. Falls der Worker bereits existiert, vorhandene Bindings und Besitzerzugriff erhalten.

Vor einem Merge des Branches: Worker veröffentlichen und workers.dev für kings-api aktivieren; Endpunkt /health und echten Mehrgeräte-Ablauf prüfen. Dann diesen Branch nach main bringen und Pages-Veröffentlichung prüfen. Die Hauptwebsite hat bis dahin den bisherigen lokalen Spielmodus.

Die Cloudflare-Anmeldung enthält absichtlich keine Billing-Rechte. Das Konto-Abo konnte deshalb nicht per Billing-API gelesen werden. Falls der Tarif nicht durch einen anderen zugelassenen reinen Leseweg verifiziert werden kann, den Besitzer lediglich bestätigen lassen, dass Workers Free eingestellt ist; niemals einen Tarif wechseln.
