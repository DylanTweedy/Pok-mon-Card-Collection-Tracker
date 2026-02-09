// RefreshController.js - full refresh pricing

function refreshPricesAll() {
  refreshPricesInternal(false);
}

function refreshPricesOwnedOnly() {
  refreshPricesInternal(true);
}

function refreshPricesInternal(ownedOnly) {
  const sheets = getActiveSets();
  PropertiesService.getDocumentProperties().setProperty("EBAY_FETCH_COUNT", "0");

  sheets.forEach(sheet => {
    const headerIndex = ensureComputedColumns(sheet, { applyFormats: false });
    if (getFlag("LAYOUT_REPAIR_ON_REFRESH", false)) {
      applySetSheetLayout(sheet);
      ensureHiddenTechnicalColumns(sheet);
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return;

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

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);

      let chosenPrice = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      let total = toNumber(row[SET_SHEET_COLUMNS.TOTAL - 1]);
      let ebayPrice = ebayIndex ? toNumber(row[ebayIndex - 1]) : "";
      let pokemonPrice = pokemonIndex ? toNumber(row[pokemonIndex - 1]) : "";
      let chosenOverride = chosenIndex ? toNumber(row[chosenIndex - 1]) : "";
      let confidence = priceConfidenceIndex ? toNumber(row[priceConfidenceIndex - 1]) : "";
      let method = priceMethodIndex ? row[priceMethodIndex - 1] : "";
      let cardKey = cardKeyIndex ? row[cardKeyIndex - 1] : "";

      if (name && (!ownedOnly || qty > 0)) {
        const key = getCardKey(sheet.getName(), row, headerIndex);
        const card = {
          cardKey: key,
          manualPrice: manualIndex ? row[manualIndex - 1] : 0,
          cardId: cardIdIndex ? toTrimmedString(row[cardIdIndex - 1]) : "",
          name: name,
          rarity: toTrimmedString(row[SET_SHEET_COLUMNS.RARITY - 1]),
          setName: sheet.getName(),
          qty: qty
        };

        const result = getBestPriceGBP(card);
        const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
        const multiplier = getConditionMultiplier(condition);

        if (result.chosenPriceGBP !== null && result.chosenPriceGBP !== undefined) {
          chosenPrice = result.chosenPriceGBP;
        }
        total = qty ? qty * chosenPrice * multiplier : 0;

        if (priceConfidenceIndex) confidence = result.confidence || 0;
        if (priceMethodIndex) method = result.method || "";
        if (cardKeyIndex) cardKey = key;
        if (chosenIndex) chosenOverride = chosenPrice;

        if (result.observations && result.observations.length) {
          if (ebayIndex) ebayPrice = getSourcePrice(result.observations, SOURCE_KEYS.EBAY);
          if (pokemonIndex) pokemonPrice = getSourcePrice(result.observations, SOURCE_KEYS.POKEMONTCG);
        }
      }

      priceValues.push([chosenPrice]);
      totalValues.push([total]);
      if (ebayValues) ebayValues.push([ebayPrice]);
      if (pokemonValues) pokemonValues.push([pokemonPrice]);
      if (chosenValues) chosenValues.push([chosenOverride]);
      if (confidenceValues) confidenceValues.push([confidence]);
      if (methodValues) methodValues.push([method]);
      if (cardKeyValues) cardKeyValues.push([cardKey]);
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
