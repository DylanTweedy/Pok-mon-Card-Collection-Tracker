// RefreshController.js - full refresh pricing (sequential sources)

function refreshPricesAll() {
  refreshPricesInternal(false);
}

function refreshPricesOwnedOnly() {
  refreshPricesInternal(true);
}

function refreshPricesInternal(ownedOnly) {
  const sheets = getActiveSets();

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
    const chosenIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CHOSEN_PRICE);
    const priceConfidenceIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE);
    const priceMethodIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD);
    const cardKeyIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_KEY);

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const priceValues = [];
    const totalValues = [];
    const ebayValues = ebayIndex ? [] : null;
    const pokemonValues = pokemonIndex ? [] : null;
    const chosenValues = chosenIndex ? [] : null;
    const confidenceValues = priceConfidenceIndex ? [] : null;
    const methodValues = priceMethodIndex ? [] : null;
    const cardKeyValues = cardKeyIndex ? [] : null;

    // Pass 1: PokemonTCG baseline
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      if (!name) continue;
      if (ownedOnly && qty <= 0) continue;
      if (!pokemonIndex) continue;

      const cardId = cardIdIndex ? toTrimmedString(row[cardIdIndex - 1]) : "";
      if (!cardId) continue;

      const key = getCardKey(sheet.getName(), row, headerIndex);
      const price = getPokemonTCGPriceGBP({ cardId: cardId, cardKey: key });
      if (price && price > 0) {
        row[pokemonIndex - 1] = price;
      }
    }

    // Pass 2: eBay (budgeted, owned only)
    if (getFlag("EBAY_SCRAPE_ENABLED", false)) {
      PropertiesService.getDocumentProperties().setProperty("EBAY_FETCH_COUNT", "0");

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
        const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
        if (!name) continue;
        if (qty <= 0) continue;
        if (!ebayIndex) continue;

        const key = getCardKey(sheet.getName(), row, headerIndex);
        const price = getEbayPriceGBP({
          cardKey: key,
          name: name,
          setName: sheet.getName(),
          qty: qty
        });
        if (price && price > 0) {
          row[ebayIndex - 1] = price;
        }
      }
    }

    // Pass 3: choose price + write outputs
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
      const multiplier = getConditionMultiplier(condition);

      let chosenPrice = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      let total = toNumber(row[SET_SHEET_COLUMNS.TOTAL - 1]);
      let ebayPrice = ebayIndex ? toNumber(row[ebayIndex - 1]) : 0;
      let pokemonPrice = pokemonIndex ? toNumber(row[pokemonIndex - 1]) : 0;
      let chosenOverride = chosenIndex ? toNumber(row[chosenIndex - 1]) : 0;
      let confidence = priceConfidenceIndex ? toNumber(row[priceConfidenceIndex - 1]) : 0;
      let method = priceMethodIndex ? row[priceMethodIndex - 1] : "";
      let cardKey = cardKeyIndex ? row[cardKeyIndex - 1] : "";
      const manualPrice = manualIndex ? toNumber(row[manualIndex - 1]) : 0;

      if (name && (!ownedOnly || qty > 0)) {
        const key = getCardKey(sheet.getName(), row, headerIndex);
        cardKey = key;

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

        total = qty ? qty * chosenPrice * multiplier : 0;
        if (chosenIndex) chosenOverride = chosenPrice;
      }

      priceValues.push([chosenPrice]);
      totalValues.push([total]);
      if (ebayValues) ebayValues.push([ebayPrice || ""]);
      if (pokemonValues) pokemonValues.push([pokemonPrice || ""]);
      if (chosenValues) chosenValues.push([chosenOverride || ""]);
      if (confidenceValues) confidenceValues.push([confidence || 0]);
      if (methodValues) methodValues.push([method || ""]);
      if (cardKeyValues) cardKeyValues.push([cardKey || ""]);
    }

    sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, priceValues.length, 1).setValues(priceValues);
    sheet.getRange(2, SET_SHEET_COLUMNS.TOTAL, totalValues.length, 1).setValues(totalValues);
    if (ebayValues) sheet.getRange(2, ebayIndex, ebayValues.length, 1).setValues(ebayValues);
    if (pokemonValues) sheet.getRange(2, pokemonIndex, pokemonValues.length, 1).setValues(pokemonValues);
    if (chosenValues) sheet.getRange(2, chosenIndex, chosenValues.length, 1).setValues(chosenValues);
    if (confidenceValues) sheet.getRange(2, priceConfidenceIndex, confidenceValues.length, 1).setValues(confidenceValues);
    if (methodValues) sheet.getRange(2, priceMethodIndex, methodValues.length, 1).setValues(methodValues);
    if (cardKeyValues) sheet.getRange(2, cardKeyIndex, cardKeyValues.length, 1).setValues(cardKeyValues);
  });

  PropertiesService.getDocumentProperties().setProperty("LAST_REFRESH_TS", new Date().toISOString());
}

function getSourcePrice(observations, sourceName) {
  const match = observations.find(o => o.source === sourceName);
  return match ? match.priceGBP : "";
}
