# Guess The Player Game Data Handoff

Generated: `20260611_092741`

This folder is a compact handoff for a scouting-report guessing game. It is built from the robust draft NLP / LLM phrase handoff and filtered to players with actual NBA/draft context.

## Main Files

- `guess_the_player_player_index.csv`  
  One row per answer/player. Includes `player_name`, `draft_year`, `actual_pick`, `actual_pick_display`, `round_display`, source sites, trait families, xRAPM result fields, and optional headshot URL metadata.

- `guess_the_player_phrase_cards.csv`  
  One row per clue card. Includes `phrase_text` and `phrase_text_redacted`. Use the redacted field for gameplay so phrases do not reveal names.

- `guess_the_player_game_data.json`  
  Same core data as JSON for a frontend.

- `guess_the_player_phrase_wide.csv`  
  One row per player/year with the original wide `phrase_<trait>_<tone>` columns.

- `trait_family_metadata.csv`  
  The scouting/skill trait labels and which phrase columns count as positive or risk evidence.

- `source_reference/`  
  Copies of the source CSVs used to generate this package, for traceability.

## Filter Logic

Included rows are from `target_lens == xrapm_first5_avg`, draft years `<= 2025`, excluding `future_prediction` rows. A player is kept if they have at least one of:

1. An actual draft pick in the UI handoff.
2. A backfilled `overall_pick` from `outputs/player_development_curve_schema_test/nba_player_outcomes.csv`.
3. NBA actual-to-date xRAPM status, meaning they reached the NBA even if the pick field is missing.

Rows with no actual draft/NBA context, such as 2026 future mocks or mock-only prospects, are intentionally excluded.

## Game Ideas

Useful answer-check fields:

- `draft_year`: show hotter/colder or exact-year match.
- `actual_pick`: show close pick distance.
- `round_display`: first round / second round / undrafted or unknown.
- `player_initial`: first-letter clue.
- `surname_initial`: last-name first-letter clue.
- `positive_trait_families` and `risk_trait_families`: can unlock as hints.

## Counts

- Players: `817`
- Phrase clue cards: `13270`
- Wide phrase rows: `773`
- Drafted players: `800`
- Undrafted or pick-missing NBA-context players: `17`

## Original Source Paths

- UI overlay: `C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\actual_to_date_xrapm_2023_2025_20260610_115118\draft_nlp_player_consensus_ui_with_actual_to_date_xrapm_overlay.csv`
- Trait phrase long: `C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\all_years_numeric_trait_phrase_handoff_20260610_094136\trait_phrase_evidence_by_player_long.csv`
- Trait phrase wide: `C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\all_years_numeric_trait_phrase_handoff_20260610_094136\trait_phrase_evidence_by_player_wide.csv`
- Headshot manifest: `C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\all_years_numeric_trait_phrase_handoff_20260610_094136\headshot_asset_manifest_for_all_years.csv`
- NBA player outcomes / pick backfill: `C:\Users\jksut\Downloads\Fun Data Testing\outputs\player_development_curve_schema_test\nba_player_outcomes.csv`
