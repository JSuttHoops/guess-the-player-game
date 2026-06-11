import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "guess_the_player_game_handoff_20260611_092741", "guess_the_player_game_data.json");
const outputPath = resolve(root, "data", "guess-the-player.min.json");

const source = JSON.parse(readFileSync(sourcePath, "utf8"));

const playerFields = [
  "player_key",
  "player_name",
  "draft_year",
  "actual_pick",
  "actual_pick_display",
  "round_display",
  "draft_status",
  "player_initial",
  "surname_initial",
  "draft_college",
  "outcome_bucket",
  "xrapm_result_tier",
  "headshot_package_relative_file"
];

const cardFields = [
  "card_id",
  "player_key",
  "trait_family",
  "trait_label",
  "trait_quality",
  "phrase_text_redacted",
  "phrase_count",
  "max_llm_confidence"
];

const compact = {
  generated_at: source.generated_at,
  source: "guess_the_player_game_handoff_20260611_092741/guess_the_player_game_data.json",
  counts: {
    players: source.players.length,
    phrase_cards: source.phrase_cards.length
  },
  players: source.players.map((player) => pick(player, playerFields)),
  phrase_cards: source.phrase_cards.map(compactCard)
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(compact), "utf8");

const bytes = Buffer.byteLength(JSON.stringify(compact), "utf8");
const mb = (bytes / 1024 / 1024).toFixed(2);
console.log(`Wrote ${outputPath}`);
console.log(`${compact.players.length} players, ${compact.phrase_cards.length} cards, ${mb} MB`);

function pick(record, fields) {
  const output = {};
  for (const field of fields) {
    if (record[field] !== undefined && record[field] !== null) {
      output[field] = record[field];
    }
  }
  return output;
}

function compactCard(card) {
  const output = pick(card, cardFields);
  if (!output.phrase_text_redacted && card.phrase_text) {
    output.phrase_text = card.phrase_text;
  }
  return output;
}
