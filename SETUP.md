# Setup

## Sheet Layout (Do Not Change)
- Column A: Quantity (user input)
- Column B: Condition (user input)
- Column C: Name
- Column D: Rarity
- Column E: Market Price (GBP)
- Column F: Total (GBP)

Optional computed columns may be added after column F:
- Card ID
- ManualPriceGBP
- PriceConfidence
- PriceMethod
- CardKey

ManualPriceGBP is treated as user input and is never overwritten by scripts.

## Menu Actions
- Refresh Prices (Chunked): updates computed price fields in batches. Safe for large sheets.
- Continue Price Refresh: resumes from the last cursor if a chunked run stopped.
- Update Dashboard: fast, no pricing or CSV export.
- Export CSV: manual, can be slow.
- Export CSV (If Stale): skips if no refresh since last export.

## ValueLog
- The ValueLog sheet tracks timestamped snapshots of portfolio value and coverage.
- The Dashboard embeds a line chart using ValueLog data.

## API Keys
- Set Script Properties for external pricing:
  - POKEMONTCG_API_KEY (PokemonTCG API)
  - TCGPLAYER_API_KEY (optional stub)

## Triggers (Optional)
- Run `installPriceRefreshTrigger()` to keep chunked refresh running every 10 minutes.
- Run `removePriceRefreshTrigger()` to stop the trigger.
