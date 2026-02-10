const USD_TO_GBP = 0.78;
const EUR_TO_GBP = 0.85;

const FX_CACHE_TTL_SECONDS = 60 * 60 * 24;
const PRICE_CACHE_TTL_SECONDS = 60 * 60 * 24;
const REFRESH_BATCH_SIZE = 100;
const REFRESH_MAX_MS = 5.5 * 60 * 1000;

const CONDITIONS = {
  "Near Mint": 1.0,
  "Lightly Played": 0.8,
  "Played": 0.6,
  "Damaged": 0.4
};

const EXCLUDED_SHEETS = ["Dashboard", "Overview", "ValueLog", "PTCG Debug"];

const SET_SHEET_COLUMNS = {
  QUANTITY: 1,
  CONDITION: 2,
  NAME: 3,
  RARITY: 4,
  PRICE: 5,
  OVERRIDE: 6,
  TOTAL: 7,
  CONFIDENCE: 8
};

const SET_SHEET_BASE_HEADERS = [
  "📦 Quantity",
  "✨ Condition",
  "🧾 Name",
  "⭐ Rarity",
  "💷 Market Price",
  "✍️ Override (£)",
  "🧮 Total",
  "🟢 Confidence"
];

const SET_SHEET_OPTIONAL_HEADERS = {
  UPDATED_AT: "⏱️ Updated At",
  CARD_ID: "🆔 Card ID",
  TCG_LOW: "🎯 TCG Low",
  TCG_MID: "🎯 TCG Mid",
  TCG_HIGH: "🎯 TCG High",
  TCG_MARKET: "🎯 TCG Market",
  TCG_DIRECT_LOW: "🎯 TCG Direct Low",
  CM_AVG_SELL: "🧩 CM Avg Sell",
  CM_TREND: "📈 CM Trend",
  CM_LOW: "🔻 CM Low",
  CM_AVG1: "🕒 CM Avg 1",
  CM_AVG7: "📅 CM Avg 7",
  CM_AVG30: "🗓️ CM Avg 30",
  EBAY_MEDIAN: "🛒 eBay Median",
  CONFIDENCE_SCORE: "📊 Confidence Score",
  PRICE_METHOD: "🧪 Price Method"
};

const SOURCE_KEYS = {
  POKEMONTCG: "pokemontcg",
  EBAY: "ebay"
};

const SET_SHEET_REQUIRED_HEADERS = [
  "quantity",
  "condition",
  "name",
  "rarity"
];

const VALUELOG_HEADERS = [
  "Timestamp",
  "TotalValueGBP",
  "TotalCardsOwned",
  "DistinctCardsOwned",
  "PriceCoveragePct",
  "AvgConfidence"
];
