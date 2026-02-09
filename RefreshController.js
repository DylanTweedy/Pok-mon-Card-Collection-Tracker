// RefreshController.js - full refresh pricing

function refreshPricesAll() {
  refreshPricesInternal(false);
}

function refreshPricesOwnedOnly() {
  refreshPricesInternal(true);
}

function refreshPricesInternal(ownedOnly) {
  const sheets = getActiveSets();

  sheets.forEach(sheet => {
    const headerIndex = ensureComputedColumns(sheet);
    if (typeof applySetSheetStyling === "function") {
      applySetSheetStyling(sheet);
    }
    if (typeof addConditionDropdown === "function") {
      addConditionDropdown(sheet);
    }
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return;

    const manualIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.MANUAL_PRICE);
    const cardIdIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_ID);
    const priceConfidenceIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE);
    const priceMethodIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD);
    const cardKeyIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_KEY);
    const sourceColumns = getSourceColumnIndexes(headerIndex);

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const colStart = SET_SHEET_COLUMNS.PRICE - 1;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      if (!name) continue;

      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      if (ownedOnly && qty <= 0) continue;

      const cardKey = getCardKey(sheet.getName(), row, headerIndex);
      const card = {
        cardKey: cardKey,
        manualPrice: manualIndex ? row[manualIndex - 1] : 0,
        cardId: cardIdIndex ? toTrimmedString(row[cardIdIndex - 1]) : "",
        name: name,
        rarity: toTrimmedString(row[SET_SHEET_COLUMNS.RARITY - 1])
      };

      const result = getBestPriceGBP(card);
      const chosenPrice = result.chosenPriceGBP;
      const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
      const multiplier = getConditionMultiplier(condition);
      const existingPrice = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      const effectivePrice = (chosenPrice !== null && chosenPrice !== undefined) ? chosenPrice : existingPrice;

      const updateRow = row.slice(colStart);
      if (chosenPrice !== null && chosenPrice !== undefined) {
        updateRow[0] = chosenPrice;
      }
      updateRow[1] = qty ? qty * effectivePrice * multiplier : 0;

      if (priceConfidenceIndex) {
        updateRow[priceConfidenceIndex - SET_SHEET_COLUMNS.PRICE] = result.confidence || 0;
      }
      if (priceMethodIndex) {
        updateRow[priceMethodIndex - SET_SHEET_COLUMNS.PRICE] = result.method || "";
      }
      if (cardKeyIndex) {
        updateRow[cardKeyIndex - SET_SHEET_COLUMNS.PRICE] = cardKey;
      }

      if (result.observations && result.observations.length) {
        if (sourceColumns[0].offset !== null) {
          updateRow[sourceColumns[0].offset] = getSourcePrice(result.observations, SOURCE_KEYS.POKEMONTCG);
        }
        if (sourceColumns[1].offset !== null) {
          updateRow[sourceColumns[1].offset] = getSourcePrice(result.observations, SOURCE_KEYS.TCGPLAYER);
        }
      }

      data[i].splice(colStart, updateRow.length, ...updateRow);
    }

    const updated = data.map(row => row.slice(colStart));
    sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, updated.length, updated[0].length).setValues(updated);
  });

  PropertiesService.getDocumentProperties().setProperty("LAST_REFRESH_TS", new Date().toISOString());
}

function getSourcePrice(observations, sourceName) {
  const match = observations.find(o => o.source === sourceName);
  return match ? match.priceGBP : "";
}
