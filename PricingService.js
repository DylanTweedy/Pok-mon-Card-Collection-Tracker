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
    const priceEUR = pickCardmarketLikelyPriceEUR(prices);
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

function pickCardmarketLikelyPriceEUR(prices) {
  const candidates = [
    prices.averageSellPrice,
    prices.trendPrice,
    prices.reverseHoloTrend,
    prices.lowPrice,
    prices.average1,
    prices.average7,
    prices.average30
  ].map(toNumber).filter(v => v > 0);

  if (!candidates.length) return 0;
  if (candidates.length === 1) return candidates[0];

  const median = computeMedian(candidates);
  const filtered = candidates.filter(v => v >= median * 0.5 && v <= median * 2);
  const usable = filtered.length ? filtered : candidates;
  return computeMedian(usable);
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

function getPokemonTCGSignals(cardId, cardKey) {
  const cached = getCachedSignals(cardKey);
  if (cached) return cached;

  try {
    const url = `https://api.pokemontcg.io/v2/cards/${cardId}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText()).data || {};
    const cmPrices = data.cardmarket && data.cardmarket.prices ? data.cardmarket.prices : {};
    const tcgPrices = data.tcgplayer && data.tcgplayer.prices ? data.tcgplayer.prices : {};

    const fxEur = getFxRate("EUR", "GBP");
    const fxUsd = getFxRate("USD", "GBP");

    const cmAvgSell = toNumber(cmPrices.averageSellPrice) * fxEur;
    const cmTrend = toNumber(cmPrices.trendPrice) * fxEur;
    const cmLow = toNumber(cmPrices.lowPrice) * fxEur;
    const cmAvg1 = toNumber(cmPrices.avg1 || cmPrices.average1) * fxEur;
    const cmAvg7 = toNumber(cmPrices.avg7 || cmPrices.average7) * fxEur;
    const cmAvg30 = toNumber(cmPrices.avg30 || cmPrices.average30) * fxEur;

    let tcgBlock = null;
    if (tcgPrices.holofoil) tcgBlock = tcgPrices.holofoil;
    else if (tcgPrices.normal) tcgBlock = tcgPrices.normal;
    else if (tcgPrices["1stEditionHolofoil"]) tcgBlock = tcgPrices["1stEditionHolofoil"];
    else if (tcgPrices["1stEditionNormal"]) tcgBlock = tcgPrices["1stEditionNormal"];
    else {
      const keys = Object.keys(tcgPrices);
      if (keys.length) tcgBlock = tcgPrices[keys[0]];
    }

    const tcgLow = tcgBlock ? toNumber(tcgBlock.low) * fxUsd : 0;
    const tcgMid = tcgBlock ? toNumber(tcgBlock.mid) * fxUsd : 0;
    const tcgHigh = tcgBlock ? toNumber(tcgBlock.high) * fxUsd : 0;
    const tcgMarket = tcgBlock ? toNumber(tcgBlock.market) * fxUsd : 0;
    const tcgDirectLow = tcgBlock ? toNumber(tcgBlock.directLow) * fxUsd : 0;

    const signals = {
      cmAvgSell: cmAvgSell,
      cmTrend: cmTrend,
      cmLow: cmLow,
      cmAvg1: cmAvg1,
      cmAvg7: cmAvg7,
      cmAvg30: cmAvg30,
      tcgLow: tcgLow,
      tcgMid: tcgMid,
      tcgHigh: tcgHigh,
      tcgMarket: tcgMarket,
      tcgDirectLow: tcgDirectLow
    };

    const candidates = [cmAvgSell, cmTrend, cmLow, cmAvg1, cmAvg7, cmAvg30].filter(v => v > 0);
    signals.best = candidates.length ? computeMedian(candidates) : 0;

    setCachedSignals(cardKey, signals);
    return signals;
  } catch (err) {
    return null;
  }
}

const SIGNALS_CACHE_VERSION = 2;

function getCachedSignals(cardKey) {
  const key = `SIG_${SIGNALS_CACHE_VERSION}_${Utilities.base64EncodeWebSafe(cardKey).substring(0, 80)}`;
  const cache = CacheService.getDocumentCache();
  const cached = cache.get(key);
  if (cached) {
    const parsed = JSON.parse(cached);
    return hasAnySignals(parsed) ? parsed : null;
  }

  const stored = PropertiesService.getDocumentProperties().getProperty(key);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (hasAnySignals(parsed)) {
      cache.put(key, stored, PRICE_CACHE_TTL_SECONDS);
      return parsed;
    }
    return null;
  }
  return null;
}

function setCachedSignals(cardKey, signals) {
  if (!hasAnySignals(signals)) return;
  const key = `SIG_${SIGNALS_CACHE_VERSION}_${Utilities.base64EncodeWebSafe(cardKey).substring(0, 80)}`;
  const payload = JSON.stringify(signals);
  CacheService.getDocumentCache().put(key, payload, PRICE_CACHE_TTL_SECONDS);
  PropertiesService.getDocumentProperties().setProperty(key, payload);
}

function hasAnySignals(signals) {
  if (!signals) return false;
  const values = [
    signals.cmAvgSell, signals.cmTrend, signals.cmLow, signals.cmAvg1, signals.cmAvg7, signals.cmAvg30,
    signals.tcgLow, signals.tcgMid, signals.tcgHigh, signals.tcgMarket, signals.tcgDirectLow
  ];
  return values.some(v => toNumber(v) > 0);
}

function resolveCardIdFromSetMap(sheetName, cardName, rarity) {
  const setId = resolveSetIdForSheetName(sheetName);
  if (!setId) return "";

  const map = getSetCardIdMap(setId);
  if (!map) return "";

  const name = toTrimmedString(cardName).toLowerCase();
  const rare = toTrimmedString(rarity).toLowerCase();
  if (!name) return "";

  const key = rare ? `${name}|${rare}` : name;
  if (map[key]) return map[key];
  if (map[name]) return map[name];
  return "";
}

function resolveSetIdForSheetName(sheetName) {
  const safeName = toTrimmedString(sheetName);
  if (!safeName) return "";

  const alias = {
    "Base": "base1",
    "Jungle": "base2",
    "Fossil": "base3",
    "Base Set 2": "base4",
    "Team Rocket": "base5",
    "Gym Heroes": "gym1",
    "Gym Challenge": "gym2",
    "Neo Genesis": "neo1",
    "Neo Discovery": "neo2",
    "Neo Revelation": "neo3",
    "Neo Destiny": "neo4",
    "Legendary Collection": "base6",
    "Wizards Black Star Promos": "basep"
  };
  if (alias[safeName]) return alias[safeName];

  const key = `SETID_${Utilities.base64EncodeWebSafe(safeName.toLowerCase()).substring(0, 80)}`;
  const cache = CacheService.getDocumentCache();
  const cached = cache.get(key);
  if (cached) return cached;

  const props = PropertiesService.getDocumentProperties();
  const stored = props.getProperty(key);
  if (stored) {
    cache.put(key, stored, PRICE_CACHE_TTL_SECONDS);
    return stored;
  }

  try {
    const url = `https://api.pokemontcg.io/v2/sets?q=name:"${safeName.replace(/"/g, "")}"&pageSize=5`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText() || "{}");
    const data = json && json.data ? json.data : [];
    if (!data.length) return "";

    const exact = data.find(set => toTrimmedString(set.name) === safeName);
    const setId = exact ? exact.id : data[0].id;
    if (setId) {
      props.setProperty(key, setId);
      cache.put(key, setId, PRICE_CACHE_TTL_SECONDS);
    }
    return setId || "";
  } catch (err) {
    return "";
  }
}

function getSetCardIdMap(setId) {
  if (!setId) return null;
  const key = `SETMAP_${setId}`;
  const cache = CacheService.getDocumentCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const props = PropertiesService.getDocumentProperties();
  const stored = props.getProperty(key);
  if (stored) {
    cache.put(key, stored, PRICE_CACHE_TTL_SECONDS);
    return JSON.parse(stored);
  }

  try {
    const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&pageSize=250`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText() || "{}");
    const data = json && json.data ? json.data : [];
    if (!data.length) return null;

    const map = {};
    data.forEach(card => {
      const name = toTrimmedString(card.name).toLowerCase();
      const rare = toTrimmedString(card.rarity).toLowerCase();
      if (!name) return;
      const keyWithRare = rare ? `${name}|${rare}` : name;
      if (!map[keyWithRare]) map[keyWithRare] = card.id || "";
      if (!map[name]) map[name] = card.id || "";
    });

    const payload = JSON.stringify(map);
    props.setProperty(key, payload);
    cache.put(key, payload, PRICE_CACHE_TTL_SECONDS);
    return map;
  } catch (err) {
    return null;
  }
}


function resolveCardIdByNameSet(setName, cardName, rarity) {
  const safeSet = toTrimmedString(setName);
  const safeName = toTrimmedString(cardName);
  if (!safeSet || !safeName) return "";

  const key = `CID_${Utilities.base64EncodeWebSafe((safeSet + "|" + safeName).toLowerCase()).substring(0, 80)}`;
  const cache = CacheService.getDocumentCache();
  const cached = cache.get(key);
  if (cached) return cached;

  const props = PropertiesService.getDocumentProperties();
  const stored = props.getProperty(key);
  if (stored) {
    cache.put(key, stored, PRICE_CACHE_TTL_SECONDS);
    return stored;
  }

  try {
    const cleanSet = safeSet.replace(/"/g, "");
    const cleanName = safeName.replace(/"/g, "");
    const cleanRarity = toTrimmedString(rarity).replace(/"/g, "");
    const baseQuery = `set.name:"${cleanSet}" name:"${cleanName}"`;
    const rarityQuery = cleanRarity ? `${baseQuery} rarity:"${cleanRarity}"` : baseQuery;

    let res = UrlFetchApp.fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(rarityQuery)}&pageSize=5`, { muteHttpExceptions: true });
    let json = JSON.parse(res.getContentText() || "{}");
    let data = json && json.data ? json.data : [];

    if (!data.length) {
      res = UrlFetchApp.fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(baseQuery)}&pageSize=5`, { muteHttpExceptions: true });
      json = JSON.parse(res.getContentText() || "{}");
      data = json && json.data ? json.data : [];
    }

    let cardId = "";
    if (data.length === 1) {
      cardId = data[0].id || "";
    } else if (data.length > 1) {
      const matched = data.find(item => toTrimmedString(item.rarity) === cleanRarity);
      cardId = (matched && matched.id) ? matched.id : "";
    }
    if (cardId) {
      props.setProperty(key, cardId);
      cache.put(key, cardId, PRICE_CACHE_TTL_SECONDS);
    }
    return cardId || "";
  } catch (err) {
    return "";
  }
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
