# NBA / ESPN Headshot Cache Work Summary

Generated: 2026-06-09

## Purpose

Cached player headshots for the NBA draft NLP/LLM project so future graphics can use local image files instead of fetching images live.

The source player list came from:

`C:\Users\jksut\Downloads\RSCI Model NBA\llm_model_feed_export_20260609_091914.csv`

That model-feed CSV contains historical draft players plus prospective 2026 players.

## Final Cache Counts

- NBA CDN headshots cached: 626 PNGs
- ESPN fallback headshots cached: 67 PNGs
- Combined cached headshots: 693 PNG files

The two systems are kept in separate folders because NBA `PERSON_ID`s and ESPN athlete IDs are different ID systems.

## NBA CDN Cache

Folder:

`C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\nba_cdn_latest_1040x760`

Latest manifest:

`nba_headshot_cache_manifest_20260609_142038.csv`

Documentation:

`NBA_HEADSHOT_CACHE_DOCUMENTATION_20260609_142038.md`

Script:

`C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_nba_headshots_from_model_feed.py`

Method:

1. Read unique player names from the model-feed CSV.
2. Mapped names to `nba_api.stats.static.players.get_players()`.
3. Downloaded headshots from:

```text
https://cdn.nba.com/headshots/nba/latest/1040x760/{PERSON_ID}.png
```

4. Wrote one PNG per matched player, with filenames like:

```text
aaron_gordon__203932.png
```

Result:

- 732 normalized unique player names checked
- 626 matched to NBA static player IDs
- 626 NBA CDN images downloaded
- 106 remained unmatched after the NBA pass

## ESPN Fallback Cache

Folder:

`C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\espn_fallback_350x254`

Latest manifest:

`espn_fallback_headshot_manifest_20260609_144107.csv`

Documentation:

`ESPN_FALLBACK_HEADSHOT_CACHE_DOCUMENTATION_20260609_144107.md`

Script:

`C:\Users\jksut\Downloads\Fun Data Testing\rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py`

Method:

1. Read the 106 rows marked `unmatched` in the NBA CDN manifest.
2. Tried ESPN's NBA athlete index:

```text
https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes?lang=en&region=us&limit=1000
```

3. ESPN's NBA athlete index did not recover meaningful additional matches among the remaining names.
4. Tried ESPN search pages/API variants. These did not expose useful athlete-card results for name lookup.
5. Added ESPN men's college basketball team roster lookup for prospects/current college players:

```text
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{TEAM_ID}/roster
```

6. Used school values from the 2026 rows in the model-feed CSV to map players to ESPN team rosters.
7. Downloaded ESPN headshots from:

```text
https://a.espncdn.com/combiner/i?img=/i/headshots/{LEAGUE}/players/full/{ESPN_ID}.png&w=350&h=254
```

Result:

- 106 NBA-unmatched rows checked
- 70 ESPN fallback rows matched
- 67 unique ESPN fallback PNG files cached
- 36 rows remain unmatched after ESPN fallback

## Awaka / School Override Fix

Tobe Awaka was initially listed as Tennessee in the mock data, but ESPN's current 2025-26 roster has him on Arizona.

The fallback script now includes a small manual player-school override:

```python
PLAYER_SCHOOL_OVERRIDES = {
    "tobe awaka": ["Arizona", "Tennessee"],
    "rafael castro": ["George Washington"],
}
```

This allowed:

- Tobe Awaka to match ESPN ID `5105555` via Arizona
- Rafael Castro to match ESPN ID `4684443` via George Washington

Cached files:

```text
tobe_awaka__espn_mens_college_basketball__5105555.png
rafael_castro__espn_mens_college_basketball__4684443.png
```

## Remaining 2026 / Prospect Unmatched

After NBA CDN plus ESPN college roster fallback, these prospective names remained unmatched:

- Francesco Ferrari
- Jack Kayil
- Karim Lopez
- Luigi Suigo
- Pavle Backo
- Sergio De Larrea

These are mostly international or non-NCAAM/pro-team cases, so they were not available through ESPN's current men's college basketball rosters.

## Remaining Historical Unmatched

After both cache passes, 30 historical players remained unmatched:

- Robert Dozier
- Sergio Llull
- Dwayne Collins
- Latavious Williams
- Ryan Richards
- Stanley Robinson
- Tiny Gallon
- Bojan Dubljevic
- Deshaun Thomas
- Janis Timma
- Livio Jean-Charles
- Alec Brown
- Alessandro Gentile
- DeAndre Daniels
- Aaron White
- Arturas Gudaitis
- JP Tokoto
- Nikola Milutinov
- Olivier Hanlan
- Isaia Cordinier
- Isaiah Cousins
- Rade Zagorac
- Mathias Lessort
- Issuf Sanon
- Jaylen Hands
- Yam Madar
- Juhann Begarin
- Rokas Jokubaitis
- Gabriele Procida
- Ismael Kamagate

Of these, about 12 are previous NCAA players:

| Player | Draft year | NCAA school |
|---|---:|---|
| Robert Dozier | 2009 | Memphis |
| Dwayne Collins | 2010 | Miami FL |
| Stanley Robinson | 2010 | UConn |
| Tiny Gallon | 2010 | Oklahoma |
| Deshaun Thomas | 2013 | Ohio State |
| Alec Brown | 2014 | Green Bay |
| DeAndre Daniels | 2014 | UConn |
| Aaron White | 2015 | Iowa |
| JP Tokoto | 2015 | North Carolina |
| Olivier Hanlan | 2015 | Boston College |
| Isaiah Cousins | 2016 | Oklahoma |
| Jaylen Hands | 2019 | UCLA |

The historical model-feed CSV does not have school populated for historical players, so this NCAA grouping was manually identified from player history/scouting context rather than from a clean source column.

## Important Limitation

ESPN's current roster endpoint works well for current/prospective college players, but old roster lookup did not work with simple season parameters.

Tested examples like:

```text
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/235/roster?season=2009
```

Those historical roster calls returned empty rosters. ESPN public old roster webpages also did not expose old player lists server-side in a useful way.

Therefore, filling historical NCAA-only misses would require either:

- a manual ESPN athlete ID override table, or
- another historical college roster/player-ID data source.

## Rerun Commands

From:

`C:\Users\jksut\Downloads\Fun Data Testing`

Run the NBA CDN pass:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_nba_headshots_from_model_feed.py"
```

Dry-run only:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_nba_headshots_from_model_feed.py" --dry-run
```

Run the ESPN fallback pass:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py" --skip-search
```

Dry-run only:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py" --dry-run --skip-search
```

Refresh ESPN team/player index caches:

```powershell
python "rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py" --skip-search --force-index-refresh
```

## Files Added / Updated

Scripts:

- `rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_nba_headshots_from_model_feed.py`
- `rsci_nlp_package_staging\nlp_draft_bias_research\scripts\cache_espn_headshots_for_unmatched.py`

Cache folders:

- `rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\nba_cdn_latest_1040x760`
- `rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\espn_fallback_350x254`

This summary:

- `rsci_nlp_package_staging\nlp_draft_bias_research\outputs_llm_enhanced\headshot_cache\HEADSHOT_CACHE_WORK_SUMMARY_20260609.md`
