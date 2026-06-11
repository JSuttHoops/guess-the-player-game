# Guess the Player

A static web game built from the local scouting-report handoff in `guess_the_player_game_handoff_20260611_092741`.

## Run

From this folder:

```powershell
python -m http.server 5173
```

Then open:

```text
http://localhost:5173/
```

The app first loads `data/guess-the-player.min.json`, a compact frontend copy generated from the handoff, and falls back to the original JSON if needed. It uses redacted scouting-report phrases as clues, lets you search every available player, and unlocks trait, initials, draft class, draft range, outcome, and headshot hints as guesses accumulate.

## Rebuild Data

```powershell
node scripts/build-game-data.mjs
```

## Smoke Tests

```powershell
node --check app.js
node --check tests/browser-smoke.mjs
node tests/smoke.mjs
```

Optional browser smoke, when Playwright is available:

```powershell
node tests/browser-smoke.mjs
```

## GitHub Pages

This is a static app. GitHub Pages can serve it from the repository root on the `main` branch.

The published repo includes the compact game data in `data/guess-the-player.min.json` and the headshot assets used by the game. Raw handoff exports and generated screenshots are ignored.
