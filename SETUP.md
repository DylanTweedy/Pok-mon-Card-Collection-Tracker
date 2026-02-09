# Setup

## Sheet Layout (Do Not Change)
Visible user-facing columns:
- Column A: Quantity (user input)
- Column B: Condition (user input)
- Column C: Name
- Column D: Rarity
- Column E: Market Price (GBP) (chosen price)
- Column F: Total (GBP)
- Column G: ManualPriceGBP (Override)

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

Hidden technical columns (default hidden):
- Card ID
- EbayPrice
- PokemonTCGPrice
- ChosenPrice
- PriceConfidence
- PriceMethod
- CardKey

Layout repair does not rewrite user-entered values in A/B.

## Menu Actions
- Refresh Prices (Owned Only): updates computed price fields only where Quantity > 0.
- Refresh Prices (All): updates computed price fields for every card.
- Update Dashboard: fast, no pricing or CSV export.
- Export CSV: manual, can be slow.
- Kubera: Link Assets
- Kubera: Sync Next Batch (25)
- Repair Layout / Hide Columns: restores formatting and hides technical columns.

## ValueLog
- The ValueLog sheet tracks timestamped snapshots of portfolio value and coverage.
- The Dashboard embeds a line chart using ValueLog data.

## API Keys
No API keys are required for pricing sources in this version.

## Script Properties
- KUBERA_SYNC_ENABLED = true|false
- EBAY_SCRAPE_ENABLED = true|false
- EBAY_MAX_FETCH_PER_RUN (default 10)
- EBAY_CACHE_HOURS (default 24)
- EBAY_LOOKBACK_DAYS (default 30)
- EBAY_MIN_SAMPLES (default 3)
- LAYOUT_REPAIR_ON_REFRESH = true|false (default false)
- KUBERA_API_KEY (required if Kubera sync is enabled)
- KUBERA_BASE_URL (optional, defaults to https://api.kubera.com)

## Triggers
- No automatic price refresh triggers are installed.
