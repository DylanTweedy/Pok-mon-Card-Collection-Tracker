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

const EXCLUDED_SHEETS = ["Dashboard", "Overview", "ValueLog"];

const SET_SHEET_COLUMNS = {
  QUANTITY: 1,
  CONDITION: 2,
  NAME: 3,
  RARITY: 4,
  PRICE: 5,
  TOTAL: 6
};

const SET_SHEET_BASE_HEADERS = [
  "Quantity",
  "Condition",
  "Name",
  "Rarity",
  "Market Price (GBP)",
  "Total (GBP)"
];

const SET_SHEET_OPTIONAL_HEADERS = {
  CARD_ID: "Card ID",
  MANUAL_PRICE: "ManualPriceGBP",
  EBAY_PRICE: "EbayPrice",
  POKEMONTCG_PRICE: "PokemonTCGPrice",
  LAST_UPDATED: "Last Updated",
  PRICE_CONFIDENCE: "PriceConfidence",
  PRICE_METHOD: "PriceMethod",
  CARD_KEY: "CardKey"
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
