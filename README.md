# Gym Tracker · v0.4

Mobile Webseite für Training, eigene Trainingseinheiten und einen flexiblen Wochenplan. Bereitstellung über GitHub Pages; kein eigener Server und kein Firebase.

## Trainingseinheiten bearbeiten

Unter **Pläne** eine neue Einheit anlegen oder eine vorhandene bearbeiten:

- Name, Symbol und optionale Beschreibung wählen.
- Normale Wochentage zuordnen, auch mehrere Tage oder Sonntag. Ohne Zuordnung bleibt die Einheit manuell auswählbar.
- Übungen suchen und nach Muskelgruppe oder Gerät filtern.
- Reihenfolge, Satzanzahl, Wiederholungsziel, Satzpause, Gewichtsangabe und optionale Übungen festlegen.
- Mit **Einheit speichern** in den Wochenplan übernehmen. Editorentwürfe werden bereits während der Eingabe lokal gesichert.

Wird ein bereits belegter Wochentag ausgewählt, geht dieser Tag beim Speichern an die bearbeitete Einheit. Die andere Einheit bleibt verfügbar. Einheiten lassen sich duplizieren und entfernen; die letzte Planänderung lässt sich rückgängig machen.

## Training für ein Datum

Das Datum schlägt die normal zugeordnete Einheit vor. Über **Einheit für diesen Tag** eine andere Einheit oder einen Ruhetag wählen. Die Änderung betrifft nur dieses Datum. **Wochenplan übernehmen** stellt den normalen Vorschlag wieder her.

Bereits bearbeitete oder abgeschlossene Trainings werden bei Planänderungen nicht automatisch ersetzt. Beim ausdrücklich gewählten Einheitenwechsel schützt eine Rückfrage die Eingaben; vor einem bestätigten Ersatz wird eine lokale Sicherung heruntergeladen. Nur abgehakte Sätze gelangen in einen Trainingsabschluss. Wiederholungsziele sind keine absolvierten Wiederholungen.

## Daten und Synchronisierung

Trainings, Pläne und Editorentwürfe liegen in IndexedDB des jeweiligen Browsers. Nach dem ersten vollständigen Laden ist die App offline nutzbar. Regelmäßige Backups unter **Einstellungen** sichern auch die Pläne und den Editorentwurf.

Der GitHub-Token bleibt nur im Arbeitsspeicher und gehört niemals in Dateien oder Commits. Für Sync einen Fine-grained Token ausschließlich für das private Trainingsrepository mit Contents: Read and write verwenden.

Gespeicherte Pläne werden unter `data/training-plans.json` im privaten Archiv synchronisiert. Neu gewählte Übungskennungen werden dem privaten `data/exercises.json` hinzugefügt; vorhandene Kennungen bleiben erhalten, Namen und Zusatzdaten werden auf MODUSX vereinheitlicht. SHA-Prüfung und anschließendes Zurücklesen schützen Schreibvorgänge. Konflikte werden angezeigt und müssen geprüft werden. Die geöffnete App versucht Sync bei erneuter Verbindung und regelmäßig; nach dem Schließen gibt es keinen Hintergrund-Sync.

Öffentlich sind ausschließlich App-Artefakte und Übungsmetadaten. Persönliche Trainings, persönliche Planänderungen und Tokens werden nicht mit dieser Webseite ausgeliefert.

## Übungskatalog

Quelle: [MODUSX – Fitness-Übungen](https://modusx.de/fitness-uebungen/uebersicht/), abgerufen am 05.11.2026. Die App verwendet ausschließlich MODUSX-Übungsnamen. Die 40 bisherigen Kennungen sind passenden MODUSX-Einträgen zugeordnet; separate englische Namen entfallen. Muskelgruppen, Ausrüstung und Quellenlinks sind offline verfügbar. Allgemeinere Zuordnungen sind gekennzeichnet; ursprüngliche Ausführungen und Geräte bleiben als Zusatz erhalten. Anleitungstexte und Bilder wurden nicht übernommen. Anleitungen öffnen auf MODUSX und benötigen Internet. MODUSX-Einträge erhalten eigene stabile Kennungen; vorhandene Bibliothekskennungen bleiben für die bisherige Trainingshistorie erhalten.

## Veröffentlichung

Die statischen Dateien liegen direkt im Hauptverzeichnis. GitHub Pages: Branch `main`, Ordner `/(root)`. Für ein Update alle App-Tabs schließen und die Seite online neu öffnen, damit der neue Offline-Cache aktiviert werden kann. Browserdaten nicht löschen.
