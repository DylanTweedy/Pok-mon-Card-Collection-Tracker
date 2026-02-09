// RefreshController.js - priority refresh pricing

function updatePrices() {
  updatePricesInternal();
}

function updatePricesInternal() {
  const sheets = getActiveSets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast("Starting price update", "Pokémon Cards");

  sheets.forEach(sheet => {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return;

    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerIndex = buildHeaderIndex(header);

    if (getFlag("LAYOUT_REPAIR_ON_REFRESH", false)) {
      ensureComputedColumns(sheet, { applyFormats: true });
      applySetSheetLayout(sheet);
      ensureHiddenTechnicalColumns(sheet);
    }

    const manualIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.MANUAL_PRICE);
    const cardIdIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_ID);
    const ebayIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.EBAY_PRICE);
    const pokemonIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_PRICE);
    const lastUpdatedIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.LAST_UPDATED);
    const priceConfidenceIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE);
    const priceMethodIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD);
    const cardKeyIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_KEY);

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const updatePlan = [];

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
      const missing = marketPrice <= 0 || (pokemonIndex && pokemonPrice <= 0 && ebayIndex && ebayPrice <= 0);

      let priority = 4;
      if (isOwned && missing) priority = 1;
      else if (isOwned && !isRecent) priority = 2;
      else if (!isOwned && missing) priority = 3;
      else if (!isOwned && !isRecent) priority = 4;
      else continue;

      updatePlan.push({ index: i, priority: priority, isOwned: isOwned });
    }

    updatePlan.sort((a, b) => a.priority - b.priority);

    PropertiesService.getDocumentProperties().setProperty("EBAY_FETCH_COUNT", "0");

    const priceValues = [];
    const totalValues = [];
    const ebayValues = ebayIndex ? [] : null;
    const pokemonValues = pokemonIndex ? [] : null;
    const lastUpdatedValues = lastUpdatedIndex ? [] : null;
    const confidenceValues = priceConfidenceIndex ? [] : null;
    const methodValues = priceMethodIndex ? [] : null;
    const cardKeyValues = cardKeyIndex ? [] : null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      priceValues.push([toNumber(row[SET_SHEET_COLUMNS.PRICE - 1])]);
      totalValues.push([toNumber(row[SET_SHEET_COLUMNS.TOTAL - 1])]);
      if (ebayValues) ebayValues.push([ebayIndex ? row[ebayIndex - 1] : ""]);
      if (pokemonValues) pokemonValues.push([pokemonIndex ? row[pokemonIndex - 1] : ""]);
      if (lastUpdatedValues) lastUpdatedValues.push([lastUpdatedIndex ? row[lastUpdatedIndex - 1] : ""]);
      if (confidenceValues) confidenceValues.push([priceConfidenceIndex ? row[priceConfidenceIndex - 1] : ""]);
      if (methodValues) methodValues.push([priceMethodIndex ? row[priceMethodIndex - 1] : ""]);
      if (cardKeyValues) cardKeyValues.push([cardKeyIndex ? row[cardKeyIndex - 1] : ""]);
    }

    let processed = 0;
    const totalToProcess = updatePlan.length;
    let lastToastAt = Date.now();

    updatePlan.forEach(item => {
      const row = data[item.index];
      const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
      const multiplier = getConditionMultiplier(condition);

      const key = getCardKey(sheet.getName(), row, headerIndex);
      const cardId = cardIdIndex ? toTrimmedString(row[cardIdIndex - 1]) : "";
      const manualPrice = manualIndex ? toNumber(row[manualIndex - 1]) : 0;

      let pokemonPrice = pokemonIndex ? toNumber(row[pokemonIndex - 1]) : 0;
      if (pokemonIndex && cardId) {
        pokemonPrice = getPokemonTCGPriceGBP({ cardId: cardId, cardKey: key });
      }

      let ebayPrice = ebayIndex ? toNumber(row[ebayIndex - 1]) : 0;
      if (ebayIndex && getFlag("EBAY_SCRAPE_ENABLED", false) && qty > 0) {
        ebayPrice = getEbayPriceGBP({ cardKey: key, name: name, setName: sheet.getName(), qty: qty });
      }

      let chosenPrice = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      let method = priceMethodIndex ? row[priceMethodIndex - 1] : "";
      let confidence = priceConfidenceIndex ? toNumber(row[priceConfidenceIndex - 1]) : 0;

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

      priceValues[item.index][0] = chosenPrice;
      totalValues[item.index][0] = qty ? qty * chosenPrice * multiplier : 0;
      if (ebayValues) ebayValues[item.index][0] = ebayPrice || "";
      if (pokemonValues) pokemonValues[item.index][0] = pokemonPrice || "";
      if (lastUpdatedValues) lastUpdatedValues[item.index][0] = new Date();
      if (confidenceValues) confidenceValues[item.index][0] = confidence || 0;
      if (methodValues) methodValues[item.index][0] = method || "";
      if (cardKeyValues) cardKeyValues[item.index][0] = key;

      processed++;
      if (Date.now() - lastToastAt > 1500) {
        const pct = Math.min(100, Math.round((processed / Math.max(1, totalToProcess)) * 100));
        ss.toast(`Updating ${pct}% (${sheet.getName()})`, "Pokémon Cards");
        lastToastAt = Date.now();
      }
    });

    sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, priceValues.length, 1).setValues(priceValues);
    sheet.getRange(2, SET_SHEET_COLUMNS.TOTAL, totalValues.length, 1).setValues(totalValues);
    if (ebayValues) sheet.getRange(2, ebayIndex, ebayValues.length, 1).setValues(ebayValues);
    if (pokemonValues) sheet.getRange(2, pokemonIndex, pokemonValues.length, 1).setValues(pokemonValues);
    if (lastUpdatedValues) sheet.getRange(2, lastUpdatedIndex, lastUpdatedValues.length, 1).setValues(lastUpdatedValues);
    if (confidenceValues) sheet.getRange(2, priceConfidenceIndex, confidenceValues.length, 1).setValues(confidenceValues);
    if (methodValues) sheet.getRange(2, priceMethodIndex, methodValues.length, 1).setValues(methodValues);
    if (cardKeyValues) sheet.getRange(2, cardKeyIndex, cardKeyValues.length, 1).setValues(cardKeyValues);

    ss.toast(`Completed ${sheet.getName()}`, "Pokémon Cards");
  });

  PropertiesService.getDocumentProperties().setProperty("LAST_REFRESH_TS", new Date().toISOString());
  ss.toast("Price update complete", "Pokémon Cards");
}
