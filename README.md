# SpendGuru 2.0 — MVP Cost Scan

Interaktywna analiza kosztów zakupów z AI chat, wykresem komponentów i modelem kosztowym.

---

## 🚀 URUCHOMIENIE APLIKACJI (krok po kroku)

### Krok 1 — Zdobądź klucz OpenAI API

> **To jest wymagane, żeby chat AI działał.** Bez niego wykres i model kosztowy działają normalnie, ale chat AI zwróci błąd.

1. Wejdź na stronę: **https://platform.openai.com/api-keys**
2. Zaloguj się lub załóż konto (jeśli nie masz)
3. Kliknij zielony przycisk **"Create new secret key"**
4. Skopiuj klucz — zaczyna się od `sk-...`
5. **Ważne:** klucz pokazuje się tylko raz — zapisz go od razu

---

### Krok 2 — Wklej klucz do pliku konfiguracyjnego

1. W VS Code otwórz plik: `backend/.env`
2. Znajdź linię:
   ```
   OPENAI_API_KEY=sk-wklej_tutaj_swoj_klucz
   ```
3. Zastąp `sk-wklej_tutaj_swoj_klucz` swoim kluczem, np.:
   ```
   OPENAI_API_KEY=sk-proj-abc123xyz...
   ```
4. Zapisz plik (Cmd+S)

---

### Krok 3 — Uruchom backend (serwer AI)

Otwórz **nowe okno terminala** w VS Code (Terminal → New Terminal) i wpisz:

```bash
cd "/Users/tomaszuscinski/Documents/Visual Code Studio/MVP SpendGuru/backend"
npm run dev
```

Powinieneś zobaczyć:
```
🚀 SpendGuru Backend running at http://localhost:3001
```

**Zostaw to okno otwarte.**

---

### Krok 4 — Uruchom frontend (aplikacja webowa)

Otwórz **drugie okno terminala** (Terminal → New Terminal) i wpisz:

```bash
cd "/Users/tomaszuscinski/Documents/Visual Code Studio/MVP SpendGuru/frontend"
npm run dev
```

Powinieneś zobaczyć:
```
VITE ready in ...ms
➜  Local:   http://localhost:5173/
```

**Zostaw to okno otwarte.**

---

### Krok 5 — Otwórz aplikację

Otwórz przeglądarkę (Chrome/Safari/Firefox) i wejdź na:

**http://localhost:5173**

---

## 🎯 CO ROBI APLIKACJA

| Funkcja | Opis |
|---------|------|
| **Wykres** | 5 lat cen komponentów (stal, aluminium, transport, energia). Indeks = Jan 2021 × 100. |
| **Model kosztowy** | Ustaw udział % każdego komponentu w koszcie produktu. Zmieniaj suwakami. |
| **Should Cost** | Automatycznie obliczana "uczciwa cena" produktu wg aktualnych cen rynkowych |
| **Cena dostawcy** | Wpisz co faktycznie płacisz → aplikacja pokaże czy dostawca pobiera za dużo |
| **Chat AI** | Zadaj pytanie po polsku lub angielsku. AI zna Twój model kosztowy i dane. |
| **Auto insighty** | Pojawiają się automatycznie po załadowaniu danych (skoki cen, zmiany trendu) |
| **Zmiana języka** | Kliknij 🌍 PL/EN w prawym górnym rogu |

---

## 🛠 STRUKTURA PLIKÓW

```
MVP SpendGuru/
├── frontend/          ← Aplikacja webowa (React + TypeScript + Vite)
├── backend/           ← Serwer AI (Node.js + Express + OpenAI)
│   └── .env           ← 🔑 Tutaj wklej klucz OpenAI
├── shared/            ← Współdzielone typy TypeScript
└── cost_scan_dataset_realistic.csv  ← Dane źródłowe
```

---

## ⚠️ CZĘSTE PROBLEMY

**Chat zwraca błąd "Could not reach AI service"**
→ Sprawdź czy backend działa (terminal z `npm run dev` w folderze backend)
→ Sprawdź czy klucz OpenAI jest poprawnie wklejony w `backend/.env`

**Strona nie otwiera się**
→ Sprawdź czy frontend działa (terminal z `npm run dev` w folderze frontend)
→ Upewnij się że adres to dokładnie `http://localhost:5173`

**"Dane nie zostały załadowane"**
→ Odśwież stronę (Cmd+R)

---

## 💰 KOSZTY OPENAI

Chat używa modelu **gpt-4o-mini** — bardzo tani. Szacunkowo:
- 1000 zapytań ≈ $0.10–$0.30 USD
- Do testów MVP: marginalny koszt

---

## 🔒 BEZPIECZEŃSTWO

- Klucz OpenAI jest tylko na Twoim komputerze (plik `backend/.env`)
- Aplikacja działa tylko lokalnie — nikt z zewnątrz nie ma dostępu
- `.env` jest w `.gitignore` — przypadkowo nie trafi do repozytorium
