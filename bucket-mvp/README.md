# Bucket MVP

Bucket ist ein modernes, mobile-first MVP für eine Webapp, in der Nutzer Aktivitäten speichern, wiederfinden, planen und als erledigt markieren können. Typische Bucket-Items sind Restaurants, Cafés, Bars, Ausstellungen, Date-Ideen, Outdoor-Aktivitäten, Wochenendtrips und Events.

## Tech Stack

- HTML
- CSS mit Custom Properties und responsivem Mobile-first Layout
- Vanilla JavaScript
- Supabase Auth mit E-Mail und Passwort
- Supabase Postgres Database
- Supabase Row Level Security (RLS)
- Supabase JavaScript Library v2 über CDN

## Projektstruktur

```text
bucket-mvp/
├── index.html
├── share.html
├── styles.css
├── app.js
├── share.js
├── supabaseClient.js
├── schema.sql
├── README.md
└── .env.example
```

## Supabase-Projekt erstellen

1. Erstelle unter <https://supabase.com> ein neues Projekt.
2. Öffne im Projekt den Bereich **SQL Editor**.
3. Kopiere den kompletten Inhalt aus `schema.sql` in den SQL Editor.
4. Führe das SQL Script aus.
5. Öffne **Project Settings → API**.
6. Kopiere die **Project URL** und den **anon public key**.

## SQL im Supabase SQL Editor ausführen

Die Datei `schema.sql` enthält:

- `pgcrypto` Extension für UUIDs und sichere Share Tokens
- Tabellen `profiles`, `activities`, `plans`, `rsvps`
- `updated_at` Trigger für Tabellen mit Änderungszeitpunkt
- Check Constraints für Kategorien, Statuswerte, Preislevel und RSVP-Antworten
- RLS Policies für eingeloggte Nutzer
- sichere RPC-Funktionen für öffentliche Share-Links
- Indexes für häufige Abfragen

Das Script ist so aufgebaut, dass es im Supabase SQL Editor direkt ausgeführt werden kann.

## Supabase URL und Anon Key eintragen

Öffne `supabaseClient.js` und ersetze die Platzhalter:

```js
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

Beispiel:

```js
const SUPABASE_URL = "https://dein-projekt.supabase.co";
const SUPABASE_ANON_KEY = "dein-anon-key";
```

Die `.env.example` dient nur als Dokumentation, weil dieses MVP ohne Build-Step und ohne Framework direkt im Browser läuft.

## Lokal starten

Da die App statische Dateien verwendet, reicht ein einfacher lokaler Webserver:

```bash
cd bucket-mvp
python3 -m http.server 5173
```

Öffne danach:

```text
http://localhost:5173
```

Wichtig: Öffne die Dateien nicht direkt per `file://`, weil Browser-Funktionen und OAuth/Auth-Flows in lokalen Dateien eingeschränkt sein können.

## Deployment auf Netlify oder Vercel

### Netlify

1. Lege das Projekt in ein Git Repository.
2. Erstelle eine neue Netlify Site.
3. Wähle das Repository aus.
4. Setze als Publish Directory `bucket-mvp`.
5. Kein Build Command nötig.
6. Deploy starten.

### Vercel

1. Importiere das Repository in Vercel.
2. Setze das Root Directory auf `bucket-mvp`.
3. Framework Preset: **Other**.
4. Kein Build Command nötig.
5. Deploy starten.

Nach dem Deployment muss die finale Domain in Supabase unter **Authentication → URL Configuration** als erlaubte Site URL bzw. Redirect URL eingetragen werden.

## Datenbankstruktur kurz erklärt

### `profiles`

Speichert öffentliche Nutzerdaten wie E-Mail, Display Name, Avatar URL und Heimatstadt. Jeder Profileintrag gehört exakt zu einem Supabase Auth User.

### `activities`

Speichert die eigentlichen Bucket-Items eines eingeloggten Nutzers. Enthält Titel, Beschreibung, Links, Ort, Kategorie, Preislevel, Dauer, Tags, Eignung und Status.

### `plans`

Speichert Planungsvorschläge zu Aktivitäten. Jeder Plan gehört zu einer Activity und einem Creator. Der `share_token` erzeugt den öffentlichen Link für Gäste.

### `rsvps`

Speichert Gastantworten zu einem Plan. Gäste brauchen keinen Account und geben nur Name und Antwort an.

## RLS und Public Share Links

Alle Tabellen haben RLS aktiviert.

Eingeloggte Nutzer dürfen nur eigene Profile, eigene Activities, eigene Plans und RSVPs für eigene Plans lesen bzw. bearbeiten. Öffentliche Share-Seiten erhalten keinen direkten Tabellenzugriff auf `activities`, `plans` oder `rsvps`.

Statt unsichere Public Select Policies zu verwenden, nutzt die Share-Seite zwei RPC-Funktionen:

- `get_shared_plan(token text)` gibt nur die minimal nötigen Daten für genau den Plan mit passendem Share Token zurück.
- `create_rsvp(token text, guest_name text, response text)` validiert Token, Name und Antwort serverseitig und erstellt dann die RSVP.

Dadurch kann `share.html?token=abc123` ohne Login funktionieren, ohne alle Pläne oder Aktivitäten öffentlich lesbar zu machen.

## Kernfunktionen

- Registrierung mit E-Mail und Passwort
- Login und Logout
- Dashboard mit Suche, Kategorie- und Statusfiltern
- Aktivitäten erstellen, bearbeiten, löschen
- Aktivitäten als `planned` oder `done` markieren
- Plan mit Datum, Notiz und Share-Link erstellen
- Öffentliche Share-Seite ohne Login
- RSVP für Gäste ohne Account
