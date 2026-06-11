# ESPN Fallback Headshot Cache

Generated: 2026-06-09T14:36:35

## Output

- Cache directory: `C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\espn_fallback_350x254`
- ESPN fallback manifest: `espn_fallback_headshot_manifest_20260609_143635.csv`
- Source NBA unmatched manifest: `C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\nba_cdn_latest_1040x760\nba_headshot_cache_manifest_20260609_142038.csv`
- ESPN matches: 68
- Downloaded or already cached ESPN images: 68

## Status Counts

| espn_download_status   |   count |
|:-----------------------|--------:|
| downloaded             |      65 |
| unmatched              |      38 |
| already_cached         |       3 |

## Method

1. Read rows marked `unmatched` in the NBA CDN cache manifest.
2. Fetched ESPN's NBA athlete index from:
   `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes?lang=en&region=us&limit=1000`
3. Matched exact normalized player names against that ESPN index.
4. For remaining unmatched names, queried ESPN public search pages and extracted player-card links for:
   - `nba`
   - `mens-college-basketball`
   - `womens-college-basketball`
5. Confirmed extracted ESPN athlete IDs by reading ESPN athlete JSON detail endpoints.
6. Downloaded headshots using the ESPN combiner URL pattern:
   `https://a.espncdn.com/combiner/i?img=/i/headshots/{league}/players/full/{athlete_id}.png&w=350&h=254`

## Notes

The ESPN fallback is intentionally separate from the NBA CDN cache because ESPN IDs and NBA `PERSON_ID`s are different systems.
Future/prospect players may appear in ESPN college basketball but not NBA. Some international or draft-stash players may remain unmatched.

## Rerun

From:

`C:\Users\jksut\Downloads\Fun Data Testing`

Run:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py"
```

Useful options:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py" --dry-run
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py" --limit 25
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py" --force-index-refresh
```
