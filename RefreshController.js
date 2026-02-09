// RefreshController.js - priority refresh pricing (global owned-first)

function updatePrices() {
  updatePricesInternal();
}

function updatePricesInternal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = getActiveSets();
  ss.toast("Starting price update", "Pokémon Cards");

  // Ensure headers/columns exist and build per-sheet cache
  const sheetMeta = sheets.map(sheet => {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerIndex = buildHeaderIndex(header);
    return { sheet, lastRow, lastCol, headerIndex };
  });

  // Step 1: layout + show technical columns before processing
  sheetMeta.forEach(meta => {
    ensureComputedColumns(meta.sheet, { applyFormats: true });
    applySetSheetLayout(meta.sheet);
    showTechnicalColumns(meta.sheet);
  });

  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const ownedPlan = [];
  const unownedPlan = [];

  sheetMeta.forEach(meta => {
    if (meta.lastRow < 2) return;

    const sheet = meta.sheet;
    const data = sheet.getRange(2, 1, meta.lastRow - 1, meta.lastCol).getValues();
    const h = meta.headerIndex;

    const manualIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.MANUAL_PRICE);
    const cardIdIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.CARD_ID);
    const ebayIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.EBAY_PRICE);
    const pokemonIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_PRICE);
    const lastUpdatedIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.LAST_UPDATED);
    const priceConfidenceIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE);
    const priceMethodIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD);
    const cardKeyIndex = getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.CARD_KEY);

    const pokemonSignalIndexes = {
      avg: getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG),
      trend: getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_TREND),
      low: getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_LOW),
      rev: getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_REV_HOLO),
      avg1: getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG1),
      avg7: getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG7),
      avg30: getOptionalColumnIndex(h, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG30)
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      if (!name) continue;

      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      const isOwned = qty > 0;
      const marketPrice = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      const ebayPrice = ebayIndex ? toNumber(row[ebayIndex - 1]) : 0;
      const pokemonPrice = pokemonIndex ? toNumber(row[pokemonIndex - 1]) : 0;
      const lastUpdatedRaw = lastUpdatedIndex ? row[lastUpdatedIndex - 1] : "";
      const lastUpdated = lastUpdatedRaw ? new Date(lastUpdatedRaw) : null;
      const isRecent = lastUpdated && lastUpdated > cutoff;
      const missing = marketPrice <= 0 || (pokemonIndex && pokemonPrice <= 0) || (ebayIndex && ebayPrice <= 0);

      const target = {
        sheet,
        rowIndex: i,
        data,
        meta: {
          manualIndex,
          cardIdIndex,
          ebayIndex,
          pokemonIndex,
          lastUpdatedIndex,
          priceConfidenceIndex,
          priceMethodIndex,
          cardKeyIndex,
          pokemonSignalIndexes
        }
      };

      if (isOwned) {
        if (missing) ownedPlan.push({ priority: 1, item: target, isRecent });
        else if (!isRecent) ownedPlan.push({ priority: 2, item: target, isRecent });
      } else {
        if (missing) unownedPlan.push({ priority: 3, item: target, isRecent });
        else if (!isRecent) unownedPlan.push({ priority: 4, item: target, isRecent });
      }
    }
  });

  ownedPlan.sort((a, b) => a.priority - b.priority);
  unownedPlan.sort((a, b) => a.priority - b.priority);

  // Process owned cards across all sheets first
  processPricePlan(ownedPlan, ss);

  // Then process unowned cards
  processPricePlan(unownedPlan, ss);

  // Collapse technical columns and finalize layout
  sheetMeta.forEach(meta => {
    applySetSheetLayout(meta.sheet);
    ensureHiddenTechnicalColumns(meta.sheet);
  });

  PropertiesService.getDocumentProperties().setProperty("LAST_REFRESH_TS", new Date().toISOString());
  ss.toast("Price update complete", "Pokémon Cards");
}

function processPricePlan(plan, ss) {
  if (!plan.length) return;
  PropertiesService.getDocumentProperties().setProperty("EBAY_FETCH_COUNT", "0");

  let processed = 0;
  const total = plan.length;
  let lastToastAt = Date.now();

  plan.forEach(entry => {
    const { sheet, rowIndex, data, meta } = entry.item;
    const row = data[rowIndex];

    const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
    const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
    const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
    const multiplier = getConditionMultiplier(condition);

    const key = getCardKey(sheet.getName(), row, buildHeaderIndex(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]));
    const cardId = meta.cardIdIndex ? toTrimmedString(row[meta.cardIdIndex - 1]) : "";
    const manualPrice = meta.manualIndex ? toNumber(row[meta.manualIndex - 1]) : 0;

    let pokemonPrice = meta.pokemonIndex ? toNumber(row[meta.pokemonIndex - 1]) : 0;
    let signals = null;
    if (meta.pokemonIndex && cardId) {
      signals = getPokemonTCGSignals(cardId, key);
      pokemonPrice = signals.best || pokemonPrice;
    }

    let ebayPrice = meta.ebayIndex ? toNumber(row[meta.ebayIndex - 1]) : 0;
    if (meta.ebayIndex && getFlag("EBAY_SCRAPE_ENABLED", false) && qty > 0) {
      ebayPrice = getEbayPriceGBP({ cardKey: key, name: name, setName: sheet.getName(), qty: qty });
    }

    let chosenPrice = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
    let method = meta.priceMethodIndex ? row[meta.priceMethodIndex - 1] : "";
    let confidence = meta.priceConfidenceIndex ? toNumber(row[meta.priceConfidenceIndex - 1]) : 0;

    if (manualPrice > 0) {
      chosenPrice = manualPrice;
      method = "manualOverride";
      confidence = 1;
    } else if (ebayPrice > 0 && pokemonPrice > 0) {
      const ratio = ebayPrice / pokemonPrice;
      if (ratio >= 0.5 && ratio <= 2) {
        chosenPrice = ebayPrice;
        method = "ebay";
        confidence = 0.75;
      } else {
        chosenPrice = computeMedian([ebayPrice, pokemonPrice]);
        method = "median";
        confidence = 0.45;
      }
    } else if (ebayPrice > 0) {
      chosenPrice = ebayPrice;
      method = "ebay";
      confidence = 0.55;
    } else if (pokemonPrice > 0) {
      chosenPrice = pokemonPrice;
      method = "pokemontcg";
      confidence = 0.5;
    }

    row[SET_SHEET_COLUMNS.PRICE - 1] = chosenPrice;
    row[SET_SHEET_COLUMNS.TOTAL - 1] = qty ? qty * chosenPrice * multiplier : 0;

    if (meta.ebayIndex) row[meta.ebayIndex - 1] = ebayPrice || "";
    if (meta.pokemonIndex) row[meta.pokemonIndex - 1] = pokemonPrice || "";
    if (meta.lastUpdatedIndex) row[meta.lastUpdatedIndex - 1] = new Date();
    if (meta.priceConfidenceIndex) row[meta.priceConfidenceIndex - 1] = confidence || 0;
    if (meta.priceMethodIndex) row[meta.priceMethodIndex - 1] = method || "";
    if (meta.cardKeyIndex) row[meta.cardKeyIndex - 1] = key;

    if (signals && meta.pokemonSignalIndexes) {
      const s = meta.pokemonSignalIndexes;
      if (s.avg) row[s.avg - 1] = signals.avg;
      if (s.trend) row[s.trend - 1] = signals.trend;
      if (s.low) row[s.low - 1] = signals.low;
      if (s.rev) row[s.rev - 1] = signals.rev;
      if (s.avg1) row[s.avg1 - 1] = signals.avg1;
      if (s.avg7) row[s.avg7 - 1] = signals.avg7;
      if (s.avg30) row[s.avg30 - 1] = signals.avg30;
    }

    processed++;
    if (Date.now() - lastToastAt > 1500) {
      const pct = Math.min(100, Math.round((processed / Math.max(1, total)) * 100));
      ss.toast(`Updating ${pct}% (${sheet.getName()})`, "Pokémon Cards");
      lastToastAt = Date.now();
    }
  });

  // Bulk write per sheet after plan processing
  const bySheet = new Map();
  plan.forEach(entry => {
    const sheet = entry.item.sheet;
    if (!bySheet.has(sheet)) {
      bySheet.set(sheet, entry.item.data);
    }
  });

  bySheet.forEach((data, sheet) => {
    sheet.getRange(2, 1, data.length, sheet.getLastColumn()).setValues(data);
  });
}
