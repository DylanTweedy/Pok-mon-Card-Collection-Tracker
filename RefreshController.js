// RefreshController.js - owned-first then unowned refresh with per-card feedback

function refreshPrices() {
  refreshPricesOwnedThenUnowned();
}

function updatePrices() {
  refreshPrices();
}

function refreshPricesOwnedThenUnowned() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = getActiveSets();
  ss.toast("Starting price update", "Pokémon Cards");

  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  PropertiesService.getDocumentProperties().setProperty("EBAY_FETCH_COUNT", "0");

  ss.toast("Processing owned cards", "Pokémon Cards");
  sheets.forEach(sheet => {
    processSheetPrices(sheet, cutoff, true, ss);
  });

  ss.toast("Processing unowned cards", "Pokémon Cards");
  sheets.forEach(sheet => {
    processSheetPrices(sheet, cutoff, false, ss);
  });

  PropertiesService.getDocumentProperties().setProperty("LAST_REFRESH_TS", new Date().toISOString());
  ss.toast("Price update complete", "Pokémon Cards");
}

function processSheetPrices(sheet, cutoff, ownedPass, ss) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;

  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headerIndex = buildHeaderIndex(header);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const idxUpdated = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.UPDATED_AT);
  const idxCardId = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_ID);
  const idxEbay = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.EBAY_MEDIAN);
  const idxConfidenceScore = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CONFIDENCE_SCORE);
  const idxPriceMethod = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD);

  const idxTcgLow = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.TCG_LOW);
  const idxTcgMid = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.TCG_MID);
  const idxTcgHigh = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.TCG_HIGH);
  const idxTcgMarket = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.TCG_MARKET);
  const idxTcgDirectLow = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.TCG_DIRECT_LOW);

  const idxCmAvgSell = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CM_AVG_SELL);
  const idxCmTrend = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CM_TREND);
  const idxCmLow = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CM_LOW);
  const idxCmAvg1 = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CM_AVG1);
  const idxCmAvg7 = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CM_AVG7);
  const idxCmAvg30 = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CM_AVG30);

  const columnsToWrite = [
    SET_SHEET_COLUMNS.PRICE,
    SET_SHEET_COLUMNS.TOTAL,
    SET_SHEET_COLUMNS.CONFIDENCE,
    idxUpdated,
    idxCardId,
    idxEbay,
    idxTcgLow,
    idxTcgMid,
    idxTcgHigh,
    idxTcgMarket,
    idxTcgDirectLow,
    idxCmAvgSell,
    idxCmTrend,
    idxCmLow,
    idxCmAvg1,
    idxCmAvg7,
    idxCmAvg30,
    idxConfidenceScore,
    idxPriceMethod
  ].filter(col => col && col !== SET_SHEET_COLUMNS.OVERRIDE);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
    if (!name) continue;

    const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
    if (ownedPass) {
      if (qty <= 0) continue;
    } else if (qty > 0) {
      continue;
    }

    const updatedRaw = idxUpdated ? row[idxUpdated - 1] : "";
    const updatedAt = updatedRaw ? new Date(updatedRaw) : null;
    if (updatedAt && updatedAt > cutoff) continue;

    ss.toast(`Processing ${sheet.getName()} - ${name}`, "Pokémon Cards");

    const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
    const multiplier = getConditionMultiplier(condition);

    let cardId = idxCardId ? toTrimmedString(row[idxCardId - 1]) : "";
    if (cardId) {
      cardId = cardId.replace(/\s+/g, "").toLowerCase();
      if (idxCardId) row[idxCardId - 1] = cardId;
    }
    if (!cardId) {
      const rarity = toTrimmedString(row[SET_SHEET_COLUMNS.RARITY - 1]);
      let resolved = resolveCardIdFromSetMap(sheet.getName(), name, rarity);
      if (!resolved) {
        resolved = resolveCardIdByNameSet(sheet.getName(), name, rarity);
      }
      if (resolved) {
        cardId = resolved;
        if (idxCardId) row[idxCardId - 1] = cardId;
      }
    }
    const cardKey = getCardKey(sheet.getName(), row, headerIndex);
    const manualPrice = toNumber(row[SET_SHEET_COLUMNS.OVERRIDE - 1]);

    let signals = null;
    if (cardId) {
      signals = getPokemonTCGSignals(cardId, cardKey);
    }

    const cmAvgSell = signals ? toNumber(signals.cmAvgSell) : 0;
    const cmTrend = signals ? toNumber(signals.cmTrend) : 0;
    const cmLow = signals ? toNumber(signals.cmLow) : 0;
    const cmAvg1 = signals ? toNumber(signals.cmAvg1) : 0;
    const cmAvg7 = signals ? toNumber(signals.cmAvg7) : 0;
    const cmAvg30 = signals ? toNumber(signals.cmAvg30) : 0;
    const cmBaseline = cmAvgSell || cmAvg7 || cmAvg30 || cmAvg1 || cmTrend || cmLow;

    const tcgLow = signals ? toNumber(signals.tcgLow) : 0;
    const tcgMid = signals ? toNumber(signals.tcgMid) : 0;
    const tcgHigh = signals ? toNumber(signals.tcgHigh) : 0;
    const tcgMarket = signals ? toNumber(signals.tcgMarket) : 0;
    const tcgDirectLow = signals ? toNumber(signals.tcgDirectLow) : 0;

    let ebayPrice = idxEbay ? toNumber(row[idxEbay - 1]) : 0;
    if (idxEbay && getFlag("EBAY_SCRAPE_ENABLED", true) && qty > 0) {
      ebayPrice = getEbayPriceGBP({ cardKey: cardKey, name: name, setName: sheet.getName(), qty: qty }) || 0;
    }

    let chosenPrice = 0;
    let method = "";
    let confidence = 0;

    if (manualPrice > 0) {
      chosenPrice = manualPrice;
      method = "manualOverride";
      confidence = 1;
    } else if (ebayPrice > 0 && cmBaseline > 0) {
      const ratio = ebayPrice / cmBaseline;
      if (ratio >= 0.5 && ratio <= 2) {
        chosenPrice = ebayPrice;
        method = "ebay";
        confidence = 0.75;
      } else {
        chosenPrice = computeMedian([ebayPrice, cmBaseline]);
        method = "median";
        confidence = 0.45;
      }
    } else if (cmBaseline > 0) {
      chosenPrice = cmBaseline;
      method = "cardmarket";
      confidence = 0.55;
    } else if (tcgMarket > 0) {
      chosenPrice = tcgMarket;
      method = "tcgplayer";
      confidence = 0.4;
    } else if (ebayPrice > 0) {
      chosenPrice = ebayPrice;
      method = "ebay";
      confidence = 0.4;
    }

    const hasSignals = !!(signals && (
      cmAvgSell || cmTrend || cmLow || cmAvg1 || cmAvg7 || cmAvg30 ||
      tcgLow || tcgMid || tcgHigh || tcgMarket || tcgDirectLow
    ));
    const hasEbay = ebayPrice > 0;
    const hasPrice = chosenPrice > 0;

    if (!hasPrice && !hasSignals && !hasEbay) {
      continue;
    }

    if (hasPrice) {
      row[SET_SHEET_COLUMNS.PRICE - 1] = chosenPrice;
      row[SET_SHEET_COLUMNS.TOTAL - 1] = qty ? qty * chosenPrice * multiplier : 0;
      row[SET_SHEET_COLUMNS.CONFIDENCE - 1] = formatConfidenceLabel(confidence);
      if (idxUpdated) row[idxUpdated - 1] = new Date();
      if (idxConfidenceScore) row[idxConfidenceScore - 1] = confidence;
      if (idxPriceMethod) row[idxPriceMethod - 1] = method;
    }

    if (hasEbay && idxEbay) row[idxEbay - 1] = ebayPrice;

    if (hasSignals) {
      if (idxTcgLow) row[idxTcgLow - 1] = tcgLow || row[idxTcgLow - 1];
      if (idxTcgMid) row[idxTcgMid - 1] = tcgMid || row[idxTcgMid - 1];
      if (idxTcgHigh) row[idxTcgHigh - 1] = tcgHigh || row[idxTcgHigh - 1];
      if (idxTcgMarket) row[idxTcgMarket - 1] = tcgMarket || row[idxTcgMarket - 1];
      if (idxTcgDirectLow) row[idxTcgDirectLow - 1] = tcgDirectLow || row[idxTcgDirectLow - 1];

      if (idxCmAvgSell) row[idxCmAvgSell - 1] = cmAvgSell || row[idxCmAvgSell - 1];
      if (idxCmTrend) row[idxCmTrend - 1] = cmTrend || row[idxCmTrend - 1];
      if (idxCmLow) row[idxCmLow - 1] = cmLow || row[idxCmLow - 1];
      if (idxCmAvg1) row[idxCmAvg1 - 1] = cmAvg1 || row[idxCmAvg1 - 1];
      if (idxCmAvg7) row[idxCmAvg7 - 1] = cmAvg7 || row[idxCmAvg7 - 1];
      if (idxCmAvg30) row[idxCmAvg30 - 1] = cmAvg30 || row[idxCmAvg30 - 1];
    }

    writeRowColumns(sheet, data, i, columnsToWrite);
    SpreadsheetApp.flush();
  }
}

function writeRowColumns(sheet, data, rowIndex, columns) {
  if (!columns.length) return;
  columns.forEach(col => {
    sheet.getRange(rowIndex + 2, col, 1, 1).setValues([[data[rowIndex][col - 1]]]);
  });
}

function formatConfidenceLabel(confidence) {
  if (confidence >= 0.75) return "🟢 High";
  if (confidence >= 0.4) return "🟡 Med";
  return "🔴 Low";
}
