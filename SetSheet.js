// === SetSheet.js === (Handles creation and styling of individual set sheets)

function createSetSheet(setId) {
  const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&orderBy=number&pageSize=250`;
  const options = { headers: { "X-Api-Key": API_KEY } };
  let cards = [];

  try {
    const res = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(res.getContentText());
    cards = Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    SpreadsheetApp.getUi().alert("Failed to fetch set data. Check API key and set ID.");
    return;
  }

  if (cards.length === 0) {
    SpreadsheetApp.getUi().alert(`No cards found for set ID: ${setId}`);
    return;
  }

  const sheetName = (cards[0].set && cards[0].set.name) || setId;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    SpreadsheetApp.getUi().alert(`Sheet "${sheetName}" already exists. No changes were made.`);
    return;
  }

  sheet = ss.insertSheet(sheetName);
  const headerRow = buildSetSheetHeaderRow();
  sheet.appendRow(headerRow);

  const headerIndex = buildHeaderIndex(headerRow);
  const rows = cards.map(card => {
    const cardmarket = card.cardmarket && card.cardmarket.prices ? card.cardmarket.prices : {};
    const priceEUR = cardmarket.averageSellPrice || 0;
    const priceGBP = priceEUR * EUR_TO_GBP;

    const row = new Array(headerRow.length).fill("");
    row[SET_SHEET_COLUMNS.QUANTITY - 1] = 0;
    row[SET_SHEET_COLUMNS.CONDITION - 1] = "Near Mint";
    row[SET_SHEET_COLUMNS.NAME - 1] = card.name || "Unknown";
    row[SET_SHEET_COLUMNS.RARITY - 1] = card.rarity || "Unknown";
    row[SET_SHEET_COLUMNS.PRICE - 1] = priceGBP || 0;
    row[SET_SHEET_COLUMNS.TOTAL - 1] = 0;
    row[SET_SHEET_COLUMNS.OVERRIDE - 1] = "";
    row[SET_SHEET_COLUMNS.CONFIDENCE - 1] = "";

    const cardIdIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CARD_ID);
    if (cardIdIndex) row[cardIdIndex - 1] = card.id || "";
    return row;
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  ensureComputedColumns(sheet, { applyFormats: true });
  applySetSheetLayout(sheet);
  ensureHiddenTechnicalColumns(sheet);
  addConditionDropdown(sheet);
  const numRows = sheet.getLastRow() - 1;
  if (numRows > 0) {
    sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, numRows).setNumberFormat("\u00a3#,##0.00");
    sheet.getRange(2, SET_SHEET_COLUMNS.TOTAL, numRows).setNumberFormat("\u00a3#,##0.00");
    sheet.getRange(2, SET_SHEET_COLUMNS.OVERRIDE, numRows).setNumberFormat("\u00a3#,##0.00");
  }
}

function applySetSheetStyling(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastCol).setFontWeight("bold").setHorizontalAlignment("center");
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment("center");
    sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, lastRow - 1, 1).setHorizontalAlignment("center");
    sheet.getRange(2, SET_SHEET_COLUMNS.TOTAL, lastRow - 1, 1).setHorizontalAlignment("center");
  }

  const bandings = sheet.getBandings();
  bandings.forEach(banding => banding.remove());

  sheet.getRange(1, 1, lastRow, lastCol)
    .setBorder(true, true, true, true, true, true)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  sheet.autoResizeColumns(1, lastCol);
}

function addConditionDropdown(sheet) {
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount <= 0) return;
  const range = sheet.getRange(2, SET_SHEET_COLUMNS.CONDITION, rowCount);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(CONDITIONS), true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

