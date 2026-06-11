import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const handoffDir = resolve(root, "guess_the_player_game_handoff_20260611_092741");
const dataPath = resolve(root, "data", "guess-the-player.min.json");
const indexPath = resolve(root, "index.html");
const appPath = resolve(root, "app.js");
const stylesPath = resolve(root, "styles.css");

const html = readFileSync(indexPath, "utf8");
const app = readFileSync(appPath, "utf8");
const styles = readFileSync(stylesPath, "utf8");
const data = JSON.parse(readFileSync(dataPath, "utf8"));

assert.match(html, /id="guessInput"/, "guess input exists");
assert.match(html, /id="randomGuessButton"/, "random guess button exists");
assert.match(html, /id="suggestionList"/, "suggestion list exists");
assert.match(html, /viewport-fit=cover/, "safe-area viewport is enabled");
assert.match(html, /app\.js/, "app script is loaded");

assert.match(app, /DATA_URLS/, "app uses ordered data sources");
assert.equal(app.includes("const shouldReveal = state.gameOver;"), true, "headshot only reveals after game over");
assert.equal(app.includes("state.guesses.length >= 5"), false, "headshot is not unlocked by late guesses");
assert.match(app, /const MAX_ATTEMPTS = 6;/, "attempt limit is set");

assert.equal(styles.includes("box-shadow"), false, "flat UI avoids box shadows");
assert.match(styles, /@media \(min-width: 640px\)/, "mobile-first breakpoint exists");
assert.match(styles, /oklch\(/, "theme uses OKLCH tokens");

assert.ok(Array.isArray(data.players), "players is an array");
assert.ok(Array.isArray(data.phrase_cards), "phrase_cards is an array");
assert.equal(data.source, "guess_the_player_game_handoff_20260611_092741/guess_the_player_game_data.json", "compact data records source");
assert.ok(data.players.length >= 800, "expected player count is present");
assert.ok(data.phrase_cards.length >= 13000, "expected clue count is present");

const cardsByPlayer = new Map();
for (const card of data.phrase_cards) {
  if (!card.player_key) continue;
  if (!cardsByPlayer.has(card.player_key)) cardsByPlayer.set(card.player_key, []);
  cardsByPlayer.get(card.player_key).push(card);
}

const playerNameByKey = new Map(data.players.map((player) => [player.player_key, player.player_name]));
const playable = data.players.filter((player) => (cardsByPlayer.get(player.player_key) || []).length > 0);
assert.ok(playable.length >= 750, "most players are playable");

const sampledPlayersWithHeadshots = data.players
  .filter((player) => player.headshot_package_relative_file)
  .slice(0, 100);

for (const player of sampledPlayersWithHeadshots) {
  const path = resolve(handoffDir, player.headshot_package_relative_file);
  assert.ok(existsSync(path), `headshot exists for ${player.player_name}`);
}

const sampleCards = data.phrase_cards.slice(0, 500);
for (const card of sampleCards) {
  const phrase = String(card.phrase_text_redacted || card.phrase_text || "").toLowerCase();
  const playerName = String(playerNameByKey.get(card.player_key) || "").toLowerCase();
  assert.equal(
    phrase.includes(playerName),
    false,
    `redacted clue should not include full answer name: ${card.card_id}`
  );
}

console.log(`Smoke tests passed: ${data.players.length} players, ${data.phrase_cards.length} clues, ${playable.length} playable.`);
