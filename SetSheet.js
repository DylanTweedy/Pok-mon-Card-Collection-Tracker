// === SetSheet.js === (Handles creation and styling of individual set sheets)

function createOrUpdateSetSheet(setId) {
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
    ensureComputedColumns(sheet);
    SpreadsheetApp.getUi().alert(`Sheet "${sheetName}" already exists. No rebuild performed.`);
    return;
  }

  sheet = ss.insertSheet(sheetName);
  sheet.appendRow(buildSetSheetHeaderRow());

  const rows = cards.map(card => {
    const cardmarket = card.cardmarket && card.cardmarket.prices ? card.cardmarket.prices : {};
    const priceEUR = cardmarket.averageSellPrice || 0;
    const priceGBP = priceEUR * EUR_TO_GBP;
    return [
      0,
      "Near Mint",
      card.name || "Unknown",
      card.rarity || "Unknown",
      priceGBP,
      0,
      card.id || ""
    ];
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  ensureComputedColumns(sheet);
  applySetSheetStyling(sheet);
  addConditionDropdown(sheet);
  const numRows = sheet.getLastRow() - 1;
  if (numRows > 0) {
    sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, numRows).setNumberFormat("\u00a3#,##0.00");
    sheet.getRange(2, SET_SHEET_COLUMNS.TOTAL, numRows).setNumberFormat("\u00a3#,##0.00");
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

