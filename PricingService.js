// PricingService.js - multi-source price resolution with caching

function getBestPriceGBP(card, options) {
  const cardKey = card.cardKey;
  const manualPrice = toNumber(card.manualPrice);
  if (manualPrice > 0) {
    return {
      chosenPriceGBP: manualPrice,
      method: "manualOverride",
      observations: [],
      confidence: 1,
      coverage: 1,
      reason: "Manual price override"
    };
  }

  const cached = getCachedPrice(cardKey);
  if (cached && cached.chosenPriceGBP !== undefined) {
    return cached;
  }

  const sources = [
    fetchFromPokemonTCGCardmarket,
    fetchFromPokemonTCGTcgplayer
  ];

  const observations = [];
  sources.forEach(sourceFn => {
    const obs = sourceFn(card, options);
    if (obs && obs.priceGBP) observations.push(obs);
  });

  const result = choosePriceFromObservations(observations, sources.length);
  setCachedPrice(cardKey, result);
  return result;
}

function choosePriceFromObservations(observations, sourceCount) {
  if (!observations.length) {
    return {
      chosenPriceGBP: null,
      method: "fallbackSingle",
      observations: [],
      confidence: 0,
      coverage: 0,
      reason: "No price observations"
    };
  }

  const prices = observations.map(o => o.priceGBP).filter(v => v > 0);
  if (!prices.length) {
    return {
      chosenPriceGBP: null,
      method: "fallbackSingle",
      observations: observations,
      confidence: 0,
      coverage: observations.length / sourceCount,
      reason: "No valid prices"
    };
  }

  const median = computeMedian(prices);
  const filtered = prices.filter(v => v >= median * 0.5 && v <= median * 2);
  const usable = filtered.length ? filtered : prices;
  const coverage = observations.length / sourceCount;

  let chosen = 0;
  let method = "median";
  let confidence = average(observations.map(o => o.confidence || 0.5));
  let reason = "";

  if (usable.length >= 3) {
    chosen = computeMedian(usable);
    reason = "Median of multiple sources";
  } else if (usable.length === 2) {
    const a = usable[0];
    const b = usable[1];
    const diff = Math.abs(a - b) / Math.max(a, b);
    if (diff <= 0.1) {
      chosen = (a + b) / 2;
      method = "weightedMedian";
      confidence *= 0.9;
      reason = "Close pair average";
    } else {
      chosen = Math.min(a, b);
      method = "fallbackSingle";
      confidence *= 0.6;
      reason = "Divergent pair, conservative pick";
    }
  } else {
    chosen = usable[0];
    method = "fallbackSingle";
    confidence *= 0.5;
    reason = "Single source";
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    chosenPriceGBP: chosen,
    method: method,
    observations: observations,
    confidence: confidence,
    coverage: coverage,
    reason: reason
  };
}

function fetchFromPokemonTCGCardmarket(card) {
  if (!card.cardId) return null;
  const apiKey = getPokemonTcgApiKey();
  if (!apiKey) return null;

  try {
    const url = `https://api.pokemontcg.io/v2/cards/${card.cardId}`;
    const options = { headers: { "X-Api-Key": apiKey } };
    const res = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(res.getContentText()).data || {};
    const prices = data.cardmarket && data.cardmarket.prices ? data.cardmarket.prices : {};
    const priceEUR = prices.averageSellPrice || 0;
    const fx = getFxRate("EUR", "GBP");
    const priceGBP = priceEUR * fx;

    if (!priceGBP) return null;
    return {
      source: SOURCE_KEYS.POKEMONTCG,
      priceGBP: priceGBP,
      ts: new Date().toISOString(),
      confidence: 0.7
    };
  } catch (err) {
    return null;
  }
}

function fetchFromPokemonTCGTcgplayer(card) {
  if (!card.cardId) return null;
  const apiKey = getPokemonTcgApiKey();
  if (!apiKey) return null;

  try {
    const url = `https://api.pokemontcg.io/v2/cards/${card.cardId}`;
    const options = { headers: { "X-Api-Key": apiKey } };
    const res = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(res.getContentText()).data || {};
    const prices = data.tcgplayer && data.tcgplayer.prices ? data.tcgplayer.prices : {};
    const priceUSD = pickTcgplayerPriceUSD(prices);
    const fx = getFxRate("USD", "GBP");
    const priceGBP = priceUSD * fx;

    if (!priceGBP) return null;
    return {
      source: SOURCE_KEYS.TCGPLAYER,
      priceGBP: priceGBP,
      ts: new Date().toISOString(),
      confidence: 0.75
    };
  } catch (err) {
    return null;
  }
}

function pickTcgplayerPriceUSD(prices) {
  const types = Object.keys(prices || {});
  for (let i = 0; i < types.length; i++) {
    const entry = prices[types[i]];
    if (!entry) continue;
    if (entry.market) return entry.market;
    if (entry.mid) return entry.mid;
    if (entry.low) return entry.low;
  }
  return 0;
}

function getPokemonTcgApiKey() {
  return getScriptPropertyValue("POKEMONTCG_API_KEY") || API_KEY;
}

function getFxRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;
  const cache = CacheService.getScriptCache();
  const key = `FX_${fromCurrency}_${toCurrency}`;
  const cached = cache.get(key);
  if (cached) return parseFloat(cached);

  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty(key);
  if (stored) {
    cache.put(key, stored, FX_CACHE_TTL_SECONDS);
    return parseFloat(stored);
  }

  let rate = 0;
  try {
    const url = `https://api.exchangerate.host/latest?base=${fromCurrency}&symbols=${toCurrency}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText());
    if (json && json.rates && json.rates[toCurrency]) {
      rate = Number(json.rates[toCurrency]);
    }
  } catch (err) {
    rate = 0;
  }

  if (!rate) {
    if (fromCurrency === "USD" && toCurrency === "GBP") rate = USD_TO_GBP;
    if (fromCurrency === "EUR" && toCurrency === "GBP") rate = EUR_TO_GBP;
  }

  if (!rate) rate = 1;

  props.setProperty(key, String(rate));
  cache.put(key, String(rate), FX_CACHE_TTL_SECONDS);
  return rate;
}

function getCachedPrice(cardKey) {
  const cache = CacheService.getDocumentCache();
  const key = buildPriceCacheKey(cardKey);
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const props = PropertiesService.getDocumentProperties();
  const stored = props.getProperty(key);
  if (stored) {
    cache.put(key, stored, PRICE_CACHE_TTL_SECONDS);
    return JSON.parse(stored);
  }

  return null;
}

function setCachedPrice(cardKey, result) {
  const cache = CacheService.getDocumentCache();
  const key = buildPriceCacheKey(cardKey);
  const payload = JSON.stringify(result);
  cache.put(key, payload, PRICE_CACHE_TTL_SECONDS);
  PropertiesService.getDocumentProperties().setProperty(key, payload);
}

function buildPriceCacheKey(cardKey) {
  const safe = Utilities.base64EncodeWebSafe(cardKey).substring(0, 80);
  return `PRICE_${safe}`;
}

function getScriptPropertyValue(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function computeMedian(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}
