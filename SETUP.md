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
- EbayPrice
- PokemonTCGPrice
- ChosenPrice
- PriceConfidence
- PriceMethod
- CardKey

ManualPriceGBP is treated as user input and is never overwritten by scripts.

## Menu Actions
- Refresh Prices (Owned Only): updates computed price fields only where Quantity > 0.
- Refresh Prices (All): updates computed price fields for every card.
- Update Dashboard: fast, no pricing or CSV export.
- Export CSV: manual, can be slow.
- Kubera: Link Assets
- Kubera: Sync Next Batch (25)

## ValueLog
- The ValueLog sheet tracks timestamped snapshots of portfolio value and coverage.
- The Dashboard embeds a line chart using ValueLog data.

## API Keys
No API keys are required for pricing sources in this version.

## Script Properties
- KUBERA_SYNC_ENABLED = true|false
- EBAY_SCRAPE_ENABLED = true|false
- EBAY_LOOKBACK_DAYS (default 30)
- EBAY_MIN_SAMPLES (default 3)
- KUBERA_API_KEY (required if Kubera sync is enabled)
- KUBERA_BASE_URL (optional, defaults to https://api.kubera.com)

## Triggers
- No automatic price refresh triggers are installed.
