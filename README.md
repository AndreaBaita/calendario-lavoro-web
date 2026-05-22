# Calendario Lavoro Web

Web app React/Vite + Supabase per calendario giornate di lavoro.

## Avvio locale

```bash
npm install
npm run dev
```

## Supabase

Il file `.env` contiene URL e chiave pubblica Supabase.
Esegui `SUPABASE_SQL.sql` in Supabase SQL Editor.

## Primo accesso

Il primo utente registrato diventa admin e viene approvato automaticamente.
Gli utenti successivi restano in attesa finché l'admin li abilita.
