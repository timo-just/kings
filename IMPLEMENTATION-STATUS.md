# Kings Veröffentlichung

Stand: 25.10.2026.

Website: https://timo-just.github.io/kings/
API: https://kings-api.timo-just.workers.dev
Cloudflare-Worker: kings-api im Konto 07bff9283b4d6430a11c34832585b7ae.

Der Worker wurde mit SQLite-Durable-Objects bereitgestellt. Die Oberfläche umfasst persönliche Spielerlinks, ein aktives Spielleitergerät, Live-Synchronisierung, Kategorienvorschläge und optionale Kategoriennamen, private Rundenhistorie sowie Statistikdateien als JSON. Der Besitzerzugriff wird über einen separaten privaten Schlüssel geschützt, dessen SHA-256 im Worker-Binding OWNER_HASH liegt. Schlüssel niemals in GitHub speichern oder bei späteren Deployments ersetzen.

Es wurde kein kostenpflichtiges Abo abgeschlossen und kein Tarif verändert. Weiterhin keine Billing-Rechte anfordern oder Tarifwechsel vornehmen.

Geprüft: 8 Engine-Tests, 6 lokale Cloudflare-Integrationstests und echte Live-API-Tests für Teilnehmerrechte, Archivschutz, Besitzerzugriff, Kategorien und WebSocket-Übertragung. Ein Spielraum mit Namen Veröffentlichungstest bleibt als gekennzeichneter Prüfdatensatz in der privaten Historie erhalten.

Die Veröffentlichung der Oberfläche erfolgt über den Pages-Workflow bei Änderungen an main. Bei späteren Backend-Änderungen vorhandene Bindings, SQLite-Klassen und OWNER_HASH erhalten; Backend-Tests und README unter backend/.