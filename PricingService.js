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

  const sourceMode = (options && options.sourceMode) ? options.sourceMode : "both";
  const cached = getCachedPrice(cardKey, sourceMode);
  if (cached && cached.chosenPriceGBP !== undefined) {
    return cached;
  }

  const observations = [];
  if (sourceMode === "both" || sourceMode === SOURCE_KEYS.POKEMONTCG) {
    const pokemonObs = fetchFromPokemonTCGCardmarket(card);
    if (pokemonObs && pokemonObs.priceGBP) observations.push(pokemonObs);
  }

  if (sourceMode === "both" || sourceMode === SOURCE_KEYS.EBAY) {
    const ebayObs = fetchEbayObservation(card);
    if (ebayObs && ebayObs.priceGBP) observations.push(ebayObs);
  }

  const result = choosePriceFromObservations(observations);
  setCachedPrice(cardKey, sourceMode, result);
  return result;
}

function choosePriceFromObservations(observations) {
  if (!observations.length) {
    return {
      chosenPriceGBP: null,
      method: "fallback",
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
      method: "fallback",
      observations: observations,
      confidence: 0,
      coverage: observations.length,
      reason: "No valid prices"
    };
  }

  const pokemon = observations.find(o => o.source === SOURCE_KEYS.POKEMONTCG);
  const ebay = observations.find(o => o.source === SOURCE_KEYS.EBAY);

  let chosen = 0;
  let method = "fallback";
  let confidence = average(observations.map(o => o.confidence || 0.5));
  let reason = "Single source";

  if (pokemon && ebay) {
    const ratio = ebay.priceGBP / pokemon.priceGBP;
    if (ratio >= 0.5 && ratio <= 2) {
      chosen = ebay.priceGBP;
      method = "ebay";
      confidence = 0.75;
      reason = "eBay within ratio of baseline";
    } else {
      chosen = computeMedian([pokemon.priceGBP, ebay.priceGBP]);
      method = "median";
      confidence = 0.45;
      reason = "Sources diverged; median used";
    }
  } else if (ebay) {
    chosen = ebay.priceGBP;
    method = "ebay";
    confidence = 0.55;
    reason = "Only eBay available";
  } else if (pokemon) {
    chosen = pokemon.priceGBP;
    method = "pokemontcg";
    confidence = 0.5;
    reason = "Only PokemonTCG available";
  } else {
    chosen = prices[0];
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    chosenPriceGBP: chosen,
    method: method,
    observations: observations,
    confidence: confidence,
    coverage: observations.length,
    reason: reason
  };
}

function fetchFromPokemonTCGCardmarket(card) {
  if (!card.cardId) return null;
  try {
    const url = `https://api.pokemontcg.io/v2/cards/${card.cardId}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
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

function fetchEbayObservation(card) {
  const ebayResult = fetchEbaySoldMedianGBP(card);
  if (!ebayResult || !ebayResult.chosenPriceGBP) return null;
  return {
    source: SOURCE_KEYS.EBAY,
    priceGBP: ebayResult.chosenPriceGBP,
    ts: new Date().toISOString(),
    confidence: ebayResult.confidence || 0.6
  };
}

function getPokemonTCGPriceGBP(card) {
  const cached = getCachedSourcePrice(card.cardKey, SOURCE_KEYS.POKEMONTCG);
  if (cached !== null && cached !== undefined) return cached;

  const obs = fetchFromPokemonTCGCardmarket(card);
  if (obs && obs.priceGBP) {
    setCachedSourcePrice(card.cardKey, SOURCE_KEYS.POKEMONTCG, obs.priceGBP);
    return obs.priceGBP;
  }
  return 0;
}

function getEbayPriceGBP(card) {
  const cached = getCachedSourcePrice(card.cardKey, SOURCE_KEYS.EBAY);
  if (cached !== null && cached !== undefined) return cached;

  const obs = fetchEbayObservation(card);
  if (obs && obs.priceGBP) {
    setCachedSourcePrice(card.cardKey, SOURCE_KEYS.EBAY, obs.priceGBP);
    return obs.priceGBP;
  }
  return 0;
}

function getCachedSourcePrice(cardKey, source) {
  const cache = CacheService.getDocumentCache();
  const key = `SRC_${source}_${Utilities.base64EncodeWebSafe(cardKey).substring(0, 80)}`;
  const cached = cache.get(key);
  if (cached) return parseFloat(cached);
  const stored = PropertiesService.getDocumentProperties().getProperty(key);
  if (stored) {
    cache.put(key, stored, PRICE_CACHE_TTL_SECONDS);
    return parseFloat(stored);
  }
  return null;
}

function setCachedSourcePrice(cardKey, source, price) {
  const cache = CacheService.getDocumentCache();
  const key = `SRC_${source}_${Utilities.base64EncodeWebSafe(cardKey).substring(0, 80)}`;
  const value = String(price);
  cache.put(key, value, PRICE_CACHE_TTL_SECONDS);
  PropertiesService.getDocumentProperties().setProperty(key, value);
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

function getCachedPrice(cardKey, sourceMode) {
  const cache = CacheService.getDocumentCache();
  const key = buildPriceCacheKey(cardKey, sourceMode);
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

function setCachedPrice(cardKey, sourceMode, result) {
  const cache = CacheService.getDocumentCache();
  const key = buildPriceCacheKey(cardKey, sourceMode);
  const payload = JSON.stringify(result);
  cache.put(key, payload, PRICE_CACHE_TTL_SECONDS);
  PropertiesService.getDocumentProperties().setProperty(key, payload);
}

function buildPriceCacheKey(cardKey, sourceMode) {
  const safe = Utilities.base64EncodeWebSafe(cardKey).substring(0, 80);
  const mode = sourceMode || "both";
  return `PRICE_${mode}_${safe}`;
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
