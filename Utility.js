
/**
 * Returns all sheets that look like set sheets and are not explicitly excluded.
 * @return {GoogleAppsScript.Spreadsheet.Sheet[]} active data sheets
 */
function getActiveSets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().filter(isSetSheet);
}

function isSetSheet(sheet) {
  if (!sheet) return false;
  const name = sheet.getName();
  if (EXCLUDED_SHEETS.includes(name)) return false;
  if (sheet.getLastRow() < 1) return false;

  const header = sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), SET_SHEET_COLUMNS.CONFIDENCE)).getValues()[0];
  if (header.length < SET_SHEET_REQUIRED_HEADERS.length) return false;

  for (let i = 0; i < SET_SHEET_REQUIRED_HEADERS.length; i++) {
    const normalized = normalizeHeaderValue(header[i]);
    if (normalized !== SET_SHEET_REQUIRED_HEADERS[i]) return false;
  }

  return true;
}

function normalizeHeaderValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function buildSetSheetHeaderRow() {
  const base = SET_SHEET_BASE_HEADERS.slice();
  return base.concat([
    SET_SHEET_OPTIONAL_HEADERS.UPDATED_AT,
    SET_SHEET_OPTIONAL_HEADERS.CARD_ID,
    SET_SHEET_OPTIONAL_HEADERS.TCG_LOW,
    SET_SHEET_OPTIONAL_HEADERS.TCG_MID,
    SET_SHEET_OPTIONAL_HEADERS.TCG_HIGH,
    SET_SHEET_OPTIONAL_HEADERS.TCG_MARKET,
    SET_SHEET_OPTIONAL_HEADERS.TCG_DIRECT_LOW,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG_SELL,
    SET_SHEET_OPTIONAL_HEADERS.CM_TREND,
    SET_SHEET_OPTIONAL_HEADERS.CM_LOW,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG1,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG7,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG30,
    SET_SHEET_OPTIONAL_HEADERS.EBAY_MEDIAN,
    SET_SHEET_OPTIONAL_HEADERS.CONFIDENCE_SCORE,
    SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD
  ]);
}

function parseSetRow(row, headerIndex) {
  const cardIdIndex = headerIndex
    ? getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_ID)
    : 0;
  return {
    qty: toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]),
    condition: toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Unknown",
    name: toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]) || "Unknown",
    rarity: toTrimmedString(row[SET_SHEET_COLUMNS.RARITY - 1]) || "Unknown",
    price: toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]),
    override: toNumber(row[SET_SHEET_COLUMNS.OVERRIDE - 1]),
    total: toNumber(row[SET_SHEET_COLUMNS.TOTAL - 1]),
    confidence: toTrimmedString(row[SET_SHEET_COLUMNS.CONFIDENCE - 1]) || "",
    cardId: cardIdIndex ? toTrimmedString(row[cardIdIndex - 1]) : ""
  };
}

function toNumber(value) {
  const n = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function toTrimmedString(value) {
  const str = String(value || "").trim();
  return str.length ? str : "";
}

function columnToLetter(col) {
  let temp = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    temp = String.fromCharCode(65 + rem) + temp;
    col = Math.floor((col - 1) / 26);
  }
  return temp;
}

function buildHeaderIndex(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const key = normalizeHeaderValue(headerRow[i]);
    if (key) map[key] = i + 1;
  }
  return map;
}

function getOptionalColumnIndex(headerIndex, headerName) {
  const key = normalizeHeaderValue(headerName);
  return headerIndex[key] || 0;
}

function ensureComputedColumns(sheet, options) {
  const applyFormats = options && options.applyFormats;
  const lastCol = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, Math.max(lastCol, SET_SHEET_COLUMNS.CONFIDENCE)).getValues()[0];
  const updated = header.slice();
  const required = SET_SHEET_BASE_HEADERS;

  for (let i = 0; i < required.length; i++) {
    if (!updated[i]) updated[i] = required[i];
  }

  const optional = [
    SET_SHEET_OPTIONAL_HEADERS.UPDATED_AT,
    SET_SHEET_OPTIONAL_HEADERS.CARD_ID,
    SET_SHEET_OPTIONAL_HEADERS.TCG_LOW,
    SET_SHEET_OPTIONAL_HEADERS.TCG_MID,
    SET_SHEET_OPTIONAL_HEADERS.TCG_HIGH,
    SET_SHEET_OPTIONAL_HEADERS.TCG_MARKET,
    SET_SHEET_OPTIONAL_HEADERS.TCG_DIRECT_LOW,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG_SELL,
    SET_SHEET_OPTIONAL_HEADERS.CM_TREND,
    SET_SHEET_OPTIONAL_HEADERS.CM_LOW,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG1,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG7,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG30,
    SET_SHEET_OPTIONAL_HEADERS.EBAY_MEDIAN,
    SET_SHEET_OPTIONAL_HEADERS.CONFIDENCE_SCORE,
    SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD
  ];

  optional.forEach(name => {
    if (updated.map(normalizeHeaderValue).indexOf(normalizeHeaderValue(name)) === -1) {
      updated.push(name);
    }
  });

  const missing = updated.slice(header.length);
  if (applyFormats && missing.length) {
    sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
  }

  const headerIndex = buildHeaderIndex(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  if (applyFormats) {
    applyComputedColumnFormats(sheet, headerIndex);
  }
  return headerIndex;
}

function getCardKey(sheetName, row, headerIndex) {
  const cardIdIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_ID);
  const cardId = cardIdIndex ? toTrimmedString(row[cardIdIndex - 1]) : "";
  const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
  const rarity = toTrimmedString(row[SET_SHEET_COLUMNS.RARITY - 1]);
  const base = cardId ? cardId : `${name}|${rarity}`;
  return `${sheetName}|${base}`.toLowerCase();
}

function getConditionMultiplier(condition) {
  return CONDITIONS[condition] || 1;
}

function applyComputedColumnFormats(sheet, headerIndex) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const priceRange = sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, lastRow - 1, 1);
  priceRange.setNumberFormat("\u00a3#,##0.00");
  const overrideRange = sheet.getRange(2, SET_SHEET_COLUMNS.OVERRIDE, lastRow - 1, 1);
  overrideRange.setNumberFormat("\u00a3#,##0.00");
  const totalRange = sheet.getRange(2, SET_SHEET_COLUMNS.TOTAL, lastRow - 1, 1);
  totalRange.setNumberFormat("\u00a3#,##0.00");

  const confidenceIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CONFIDENCE_SCORE);
  if (confidenceIndex) {
    sheet.getRange(2, confidenceIndex, lastRow - 1, 1).setNumberFormat("0.00");
  }

  [
    SET_SHEET_OPTIONAL_HEADERS.TCG_LOW,
    SET_SHEET_OPTIONAL_HEADERS.TCG_MID,
    SET_SHEET_OPTIONAL_HEADERS.TCG_HIGH,
    SET_SHEET_OPTIONAL_HEADERS.TCG_MARKET,
    SET_SHEET_OPTIONAL_HEADERS.TCG_DIRECT_LOW,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG_SELL,
    SET_SHEET_OPTIONAL_HEADERS.CM_TREND,
    SET_SHEET_OPTIONAL_HEADERS.CM_LOW,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG1,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG7,
    SET_SHEET_OPTIONAL_HEADERS.CM_AVG30,
    SET_SHEET_OPTIONAL_HEADERS.EBAY_MEDIAN
  ].forEach(name => {
    const idx = getOptionalColumnIndex(headerIndex, name);
    if (idx) {
      sheet.getRange(2, idx, lastRow - 1, 1).setNumberFormat("\u00a3#,##0.00");
    }
  });

  const updatedIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.UPDATED_AT);
  if (updatedIndex) {
    sheet.getRange(2, updatedIndex, lastRow - 1, 1).setNumberFormat("yyyy-mm-dd hh:mm");
  }
}

function getSourceColumnIndexes(headerIndex) {
  const baseOffset = SET_SHEET_COLUMNS.PRICE;
  const ebayCol = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.EBAY_MEDIAN);
  const cmCol = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CM_AVG_SELL);

  return [
    { column: ebayCol, offset: ebayCol ? ebayCol - baseOffset : null, key: SOURCE_KEYS.EBAY },
    { column: cmCol, offset: cmCol ? cmCol - baseOffset : null, key: SOURCE_KEYS.POKEMONTCG }
  ];
}
