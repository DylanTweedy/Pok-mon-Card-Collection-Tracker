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
 - PriceSource_PokemonTCG
 - PriceSource_TCGPlayer

ManualPriceGBP is treated as user input and is never overwritten by scripts.

## Menu Actions
- Refresh Prices (All): updates computed price fields for every card.
- Refresh Prices (Owned Only): updates computed price fields only where Quantity > 0.
- Update Dashboard: fast, no pricing or CSV export.
- Export CSV: manual, can be slow.

## ValueLog
- The ValueLog sheet tracks timestamped snapshots of portfolio value and coverage.
- The Dashboard embeds a line chart using ValueLog data.

## API Keys
- Set Script Properties for external pricing:
  - POKEMONTCG_API_KEY (PokemonTCG API)

## Triggers
- No automatic price refresh triggers are installed.
