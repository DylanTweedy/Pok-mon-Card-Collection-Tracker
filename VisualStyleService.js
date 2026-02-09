// VisualStyleService.js - layout and visibility helpers

function applySetSheetLayout(sheet) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastCol < SET_SHEET_COLUMNS.TOTAL) return;

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  sheet.setColumnWidth(SET_SHEET_COLUMNS.QUANTITY, 70);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.CONDITION, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.NAME, 260);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.RARITY, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.PRICE, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.TOTAL, 120);

  const overrideIndex = getOptionalColumnIndex(buildHeaderIndex(sheet.getRange(1, 1, 1, lastCol).getValues()[0]), SET_SHEET_OPTIONAL_HEADERS.MANUAL_PRICE);
  if (overrideIndex) sheet.setColumnWidth(overrideIndex, 130);

  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBackground("#1f1f1f")
    .setFontColor("#ffffff");

  const bandings = sheet.getBandings();
  bandings.forEach(banding => banding.remove());
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }

  applyComputedColumnFormats(sheet, buildHeaderIndex(sheet.getRange(1, 1, 1, lastCol).getValues()[0]));
  if (typeof addConditionDropdown === "function") {
    addConditionDropdown(sheet);
  }
}

function ensureHiddenTechnicalColumns(sheet) {
  const headerIndex = buildHeaderIndex(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const visibleCols = new Set([1, 2, 3, 4, 5, 6]);
  const overrideIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.MANUAL_PRICE);
  if (overrideIndex) visibleCols.add(overrideIndex);

  const technical = [
    SET_SHEET_OPTIONAL_HEADERS.EBAY_PRICE,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_PRICE,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_TREND,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_LOW,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_REV_HOLO,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG1,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG7,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG30,
    SET_SHEET_OPTIONAL_HEADERS.LAST_UPDATED,
    SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE,
    SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD,
    SET_SHEET_OPTIONAL_HEADERS.CARD_KEY,
    SET_SHEET_OPTIONAL_HEADERS.CARD_ID
  ];

  technical.forEach(name => {
    const idx = getOptionalColumnIndex(headerIndex, name);
    if (idx && !visibleCols.has(idx)) {
      sheet.hideColumns(idx);
    }
  });
}

function showTechnicalColumns(sheet) {
  const headerIndex = buildHeaderIndex(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const technical = [
    SET_SHEET_OPTIONAL_HEADERS.EBAY_PRICE,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_PRICE,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_TREND,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_LOW,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_REV_HOLO,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG1,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG7,
    SET_SHEET_OPTIONAL_HEADERS.POKEMONTCG_AVG30,
    SET_SHEET_OPTIONAL_HEADERS.LAST_UPDATED,
    SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE,
    SET_SHEET_OPTIONAL_HEADERS.PRICE_METHOD,
    SET_SHEET_OPTIONAL_HEADERS.CARD_KEY,
    SET_SHEET_OPTIONAL_HEADERS.CARD_ID
  ];

  technical.forEach(name => {
    const idx = getOptionalColumnIndex(headerIndex, name);
    if (idx) {
      sheet.showColumns(idx);
    }
  });
}

function repairLayoutAllSheets() {
  getActiveSets().forEach(sheet => {
    ensureComputedColumns(sheet, { applyFormats: true });
    applySetSheetLayout(sheet);
    ensureHiddenTechnicalColumns(sheet);
  });
}
