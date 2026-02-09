// RefreshController.js - chunked price refresh

function refreshPrices() {
  resetPriceRefreshCursor();
  refreshPricesChunked();
}

function refreshPricesChunked() {
  const props = PropertiesService.getDocumentProperties();
  const cursor = JSON.parse(props.getProperty("PRICE_REFRESH_CURSOR") || "{}");
  const sheets = getActiveSets();

  let sheetIndex = cursor.sheetIndex || 0;
  let rowIndex = cursor.rowIndex || 2;
  let processed = 0;
  const start = Date.now();

  for (; sheetIndex < sheets.length; sheetIndex++) {
    const sheet = sheets[sheetIndex];
    const headerIndex = ensureComputedColumns(sheet);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const manualIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.MANUAL_PRICE);
    const cardIdIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_ID);
    const priceConfidenceIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE);
    const priceMethodIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD);
    const cardKeyIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_KEY);

    if (lastRow < 2) {
      rowIndex = 2;
      continue;
    }

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    let i = Math.max(0, rowIndex - 2);
    const colStart = SET_SHEET_COLUMNS.PRICE - 1;

    while (i < data.length) {
      const startIdx = i;
      while (i < data.length && processed < REFRESH_BATCH_SIZE && Date.now() - start <= REFRESH_MAX_MS) {
        const row = data[i];
        const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
        if (!name) {
          i++;
          continue;
        }

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
        const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
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

        data[i].splice(colStart, updateRow.length, ...updateRow);
        processed++;
        i++;
      }

      if (i > startIdx) {
        const updated = data.slice(startIdx, i).map(row => row.slice(colStart));
        sheet.getRange(startIdx + 2, SET_SHEET_COLUMNS.PRICE, updated.length, updated[0].length).setValues(updated);
      }

      if (processed >= REFRESH_BATCH_SIZE || Date.now() - start > REFRESH_MAX_MS) {
        props.setProperty("PRICE_REFRESH_CURSOR", JSON.stringify({ sheetIndex: sheetIndex, rowIndex: i + 2 }));
        return;
      }
    }

    rowIndex = 2;
  }

  props.deleteProperty("PRICE_REFRESH_CURSOR");
  props.setProperty("LAST_REFRESH_TS", new Date().toISOString());
}

function resetPriceRefreshCursor() {
  PropertiesService.getDocumentProperties().deleteProperty("PRICE_REFRESH_CURSOR");
}

function installPriceRefreshTrigger() {
  ScriptApp.newTrigger("refreshPricesChunked")
    .timeBased()
    .everyMinutes(10)
    .create();
}

function removePriceRefreshTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "refreshPricesChunked") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function updateAllSetSheets() {
  refreshPrices();
}
