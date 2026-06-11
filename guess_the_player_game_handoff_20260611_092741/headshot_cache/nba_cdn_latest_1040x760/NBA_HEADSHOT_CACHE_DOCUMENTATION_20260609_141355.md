# NBA Headshot Cache Manifest

Generated: 2026-06-09T14:13:55

## Output

- Cache directory: `C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\nba_cdn_latest_1040x760`
- Manifest CSV: `nba_headshot_cache_manifest_20260609_141355.csv`
- Source unique player names: 732
- NBA static-player matches: 623
- Downloaded or already cached images: 0

## Status Counts

| download_status   |   count |
|:------------------|--------:|
| dry_run_matched   |     623 |
| unmatched         |     109 |

## Method

1. Read unique player names from:
   `C:\Users\jksut\Downloads\RSCI Model NBA\llm_model_feed_export_20260609_091914.csv`
2. Mapped names to `nba_api.stats.static.players.get_players()` IDs.
3. Downloaded available headshots from:
   `https://cdn.nba.com/headshots/nba/latest/1040x760/{PERSON_ID}.png`
4. Existing non-empty files were left in place and marked `already_cached`.
5. Players without NBA static IDs were kept in the manifest as `unmatched`.

## Rerun

From:

`C:\Users\jksut\Downloads\Fun Data Testing`

Run:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_nba_headshots_from_model_feed.py"
```

Useful options:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_nba_headshots_from_model_feed.py" --dry-run
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_nba_headshots_from_model_feed.py" --limit 25
```
