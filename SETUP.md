# Setup

## Sheet Layout (Do Not Change)
Visible user-facing columns:
- Column A: 📦 Quantity (user input)
- Column B: ✨ Condition (user input)
- Column C: 🧾 Name
- Column D: ⭐ Rarity
- Column E: 💷 Market Price
- Column F: ✍️ Override (£)
- Column G: 🧮 Total
- Column H: 🟢 Confidence

Technical columns are added after column H and hidden:
- ⏱️ Updated At
- 🆔 Card ID
- 🎯 TCG Low
- 🎯 TCG Mid
- 🎯 TCG High
- 🎯 TCG Market
- 🎯 TCG Direct Low
- 🧩 CM Avg Sell
- 📈 CM Trend
- 🔻 CM Low
- 🕒 CM Avg 1
- 📅 CM Avg 7
- 🗓️ CM Avg 30
- 🛒 eBay Median
- 📊 Confidence Score
- 🧪 Price Method

Override (£) is treated as user input and is never overwritten by scripts.

Hidden technical columns (default hidden):
- ⏱️ Updated At
- 🆔 Card ID
- 🎯 TCG Low
- 🎯 TCG Mid
- 🎯 TCG High
- 🎯 TCG Market
- 🎯 TCG Direct Low
- 🧩 CM Avg Sell
- 📈 CM Trend
- 🔻 CM Low
- 🕒 CM Avg 1
- 📅 CM Avg 7
- 🗓️ CM Avg 30
- 🛒 eBay Median
- 📊 Confidence Score
- 🧪 Price Method

Layout repair does not rewrite user-entered values in A/B.

## Menu Actions
- Refresh Prices: skips cards updated in last 24h; owned pass first, then unowned.
- Update Dashboard: fast, no pricing or CSV export.
- Export CSV: manual, can be slow.
- Kubera: Link Assets
- Kubera: Sync Next Batch (25)
- Repair Layout: restores formatting and hides technical columns.

## ValueLog
- The ValueLog sheet tracks timestamped snapshots of portfolio value and coverage.
- The Dashboard embeds a line chart using ValueLog data.

## API Keys
No API keys are required for pricing sources in this version.

## eBay Scraping Notes
eBay scraping uses sold listings HTML from ebay.co.uk with a search query of "{card name} {set name} pokemon".
Results are parsed for prices, trimmed for outliers, and the median is used. It is rate-limited and cached.

## Script Properties
- KUBERA_SYNC_ENABLED = true|false
- EBAY_SCRAPE_ENABLED = true|false (default true)
- EBAY_MAX_FETCH_PER_RUN (default 10)
- EBAY_CACHE_HOURS (default 24)
- EBAY_LOOKBACK_DAYS (default 30)
- EBAY_MIN_SAMPLES (default 3)
- LAYOUT_REPAIR_ON_REFRESH = true|false (default false)
- KUBERA_API_KEY (required if Kubera sync is enabled)
- KUBERA_BASE_URL (optional, defaults to https://api.kubera.com)

## Triggers
- No automatic price refresh triggers are installed.
