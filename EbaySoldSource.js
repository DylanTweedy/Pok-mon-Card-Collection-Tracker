// EbaySoldSource.js - scrape sold listings (free, HTML)

function fetchEbaySoldMedianGBP(card) {
  if (!getFlag("EBAY_SCRAPE_ENABLED", false)) return null;
  if (!card || !card.name || !card.setName) return null;
  if (toNumber(card.qty) <= 0) return null;

  const cacheKey = buildEbayCacheKey(card.cardKey);
  const cached = getEbayCachedPrice(cacheKey);
  if (cached && cached.chosenPriceGBP !== undefined) return cached;

  if (!consumeEbayBudget()) {
    return null;
  }

  const lookbackDays = parseInt(getOptionalSecret("EBAY_LOOKBACK_DAYS", "30"), 10) || 30;
  const minSamples = parseInt(getOptionalSecret("EBAY_MIN_SAMPLES", "3"), 10) || 3;

  try {
    const query = encodeURIComponent(`${card.name} ${card.setName} pokemon`);
    const url = `https://www.ebay.co.uk/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13&rt=nc`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const html = res.getContentText();

    const prices = extractEbayPrices(html).map(p => normalizeToGBP(p.currency, p.amount));
    const valid = prices.filter(v => v > 0);
    if (valid.length < minSamples) return null;

    const filtered = trimOutliers(valid, 0.2);
    if (filtered.length < minSamples) return null;

    const median = computeMedian(filtered);
    const result = {
      chosenPriceGBP: median,
      method: "ebay",
      observations: [{ source: SOURCE_KEYS.EBAY, priceGBP: median, ts: new Date().toISOString(), confidence: 0.6 }],
      confidence: 0.6,
      coverage: 1,
      reason: `eBay sold listings (${filtered.length} samples)`
    };

    setEbayCachedPrice(cacheKey, result);
    return result;
  } catch (err) {
    return null;
  }
}

function extractEbayPrices(html) {
  const results = [];
  const priceRegex = /s-item__price[^>]*>\s*([^<]+)</g;
  let match;
  while ((match = priceRegex.exec(html)) !== null) {
    const text = match[1].replace(/&nbsp;/g, " ");
    const parsed = parsePriceText(text);
    if (parsed) results.push(parsed);
  }
  return results;
}

function parsePriceText(text) {
  const cleaned = text.replace(/[,]/g, "");
  const m = cleaned.match(/(£|\$|€)\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  return { currency: m[1], amount: parseFloat(m[2]) };
}

function normalizeToGBP(currency, amount) {
  if (!amount) return 0;
  if (currency === "£") return amount;
  if (currency === "$") return amount * getFxRate("USD", "GBP");
  if (currency === "€") return amount * getFxRate("EUR", "GBP");
  return 0;
}

function trimOutliers(values, fraction) {
  if (!values.length) return values;
  const sorted = values.slice().sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * fraction);
  return sorted.slice(trim, sorted.length - trim);
}

function buildEbayCacheKey(cardKey) {
  const safe = Utilities.base64EncodeWebSafe(cardKey).substring(0, 80);
  return `EBAY_${safe}`;
}

function getEbayCachedPrice(cacheKey) {
  const hours = parseInt(getOptionalSecret("EBAY_CACHE_HOURS", "24"), 10) || 24;
  const ttl = hours * 60 * 60;
  const cache = CacheService.getDocumentCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const props = PropertiesService.getDocumentProperties();
  const stored = props.getProperty(cacheKey);
  if (stored) {
    cache.put(cacheKey, stored, ttl);
    return JSON.parse(stored);
  }
  return null;
}

function setEbayCachedPrice(cacheKey, result) {
  const hours = parseInt(getOptionalSecret("EBAY_CACHE_HOURS", "24"), 10) || 24;
  const ttl = hours * 60 * 60;
  const payload = JSON.stringify(result);
  CacheService.getDocumentCache().put(cacheKey, payload, ttl);
  PropertiesService.getDocumentProperties().setProperty(cacheKey, payload);
}

function consumeEbayBudget() {
  const maxFetch = parseInt(getOptionalSecret("EBAY_MAX_FETCH_PER_RUN", "10"), 10) || 10;
  const props = PropertiesService.getDocumentProperties();
  const count = parseInt(props.getProperty("EBAY_FETCH_COUNT") || "0", 10);
  if (count >= maxFetch) return false;
  props.setProperty("EBAY_FETCH_COUNT", String(count + 1));
  Utilities.sleep(250);
  return true;
}
