// VisualStyleService.js - layout and visibility helpers

function applySetSheetLayout(sheet) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastCol < SET_SHEET_COLUMNS.CONFIDENCE) return;

  ensureHeaderLabels(sheet);
  const headerIndex = buildHeaderIndex(sheet.getRange(1, 1, 1, lastCol).getValues()[0]);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);

  sheet.setColumnWidth(SET_SHEET_COLUMNS.QUANTITY, 70);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.CONDITION, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.NAME, 260);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.RARITY, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.PRICE, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.TOTAL, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.OVERRIDE, 120);
  sheet.setColumnWidth(SET_SHEET_COLUMNS.CONFIDENCE, 130);

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

  applyComputedColumnFormats(sheet, headerIndex);
  applyConfidenceFormatting(sheet);
  if (typeof addConditionDropdown === "function") {
    addConditionDropdown(sheet);
  }
}

function ensureHeaderLabels(sheet) {
  const planned = buildSetSheetHeaderRow();
  const lastCol = sheet.getLastColumn();
  const count = Math.min(planned.length, lastCol);
  if (count > 0) {
    sheet.getRange(1, 1, 1, count).setValues([planned.slice(0, count)]);
  }
}

function ensureHiddenTechnicalColumns(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol <= SET_SHEET_COLUMNS.CONFIDENCE) return;
  sheet.showColumns(1, SET_SHEET_COLUMNS.CONFIDENCE);
  sheet.hideColumns(SET_SHEET_COLUMNS.CONFIDENCE + 1, lastCol - SET_SHEET_COLUMNS.CONFIDENCE);
}

function showTechnicalColumns(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol <= SET_SHEET_COLUMNS.CONFIDENCE) return;
  sheet.showColumns(SET_SHEET_COLUMNS.CONFIDENCE + 1, lastCol - SET_SHEET_COLUMNS.CONFIDENCE);
}

function cleanupSetSheet(sheet, options) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastCol < SET_SHEET_COLUMNS.RARITY) return;

  const preserveComputed = options && options.preserveComputed;
  const planned = buildSetSheetHeaderRow();
  const plannedCount = planned.length;
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headerIndex = buildHeaderIndex(header);
  const optionalToPreserve = [
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
  const preserved = {};
  if (lastRow > 1) {
    const namesToKeep = preserveComputed ? optionalToPreserve : [SET_SHEET_OPTIONAL_HEADERS.CARD_ID];
    namesToKeep.forEach(name => {
      const idx = getOptionalColumnIndex(headerIndex, name);
      if (idx) {
        preserved[name] = sheet.getRange(2, idx, lastRow - 1, 1).getValues();
      }
    });
  }

  if (lastCol > plannedCount) {
    sheet.deleteColumns(plannedCount + 1, lastCol - plannedCount);
  } else if (lastCol < plannedCount) {
    sheet.insertColumnsAfter(lastCol, plannedCount - lastCol);
  }

  sheet.getRange(1, 1, 1, plannedCount).setValues([planned]);

  if (lastRow > 1 && !preserveComputed) {
    sheet.getRange(2, SET_SHEET_COLUMNS.PRICE, lastRow - 1, 1).clearContent();
    sheet.getRange(2, SET_SHEET_COLUMNS.TOTAL, lastRow - 1, 1).clearContent();
    sheet.getRange(2, SET_SHEET_COLUMNS.CONFIDENCE, lastRow - 1, 1).clearContent();
    if (plannedCount > SET_SHEET_COLUMNS.CONFIDENCE) {
      sheet.getRange(2, SET_SHEET_COLUMNS.CONFIDENCE + 1, lastRow - 1, plannedCount - SET_SHEET_COLUMNS.CONFIDENCE).clearContent();
    }
  }

  if (lastRow > 1) {
    const newHeaderIndex = buildHeaderIndex(sheet.getRange(1, 1, 1, plannedCount).getValues()[0]);
    Object.keys(preserved).forEach(name => {
      const values = preserved[name];
      const idx = getOptionalColumnIndex(newHeaderIndex, name);
      if (values && idx) {
        sheet.getRange(2, idx, lastRow - 1, 1).setValues(values);
      }
    });
  }
}

function repairLayoutAllSheets() {
  getActiveSets().forEach(sheet => {
    reorderSetSheetColumns(sheet);
    applySetSheetLayout(sheet);
    ensureHiddenTechnicalColumns(sheet);
  });
}

function applyConfidenceFormatting(sheet) {
  const col = SET_SHEET_COLUMNS.CONFIDENCE;
  const range = sheet.getRange(2, col, Math.max(1, sheet.getMaxRows() - 1), 1);
  const rules = sheet.getConditionalFormatRules().filter(rule => {
    const ranges = rule.getRanges() || [];
    return !ranges.some(r => r.getColumn() === col);
  });

  const high = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("🟢")
    .setBackground("#1f8b4c")
    .setFontColor("#ffffff")
    .setRanges([range])
    .build();

  const med = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("🟡")
    .setBackground("#c9a227")
    .setFontColor("#000000")
    .setRanges([range])
    .build();

  const low = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("🔴")
    .setBackground("#b23b3b")
    .setFontColor("#ffffff")
    .setRanges([range])
    .build();

  rules.push(high, med, low);
  sheet.setConditionalFormatRules(rules);
}

function reorderSetSheetColumns(sheet) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastCol < SET_SHEET_COLUMNS.RARITY) return;

  const planned = buildSetSheetHeaderRow();
  const data = sheet.getRange(1, 1, Math.max(1, lastRow), lastCol).getValues();
  const header = data[0] || [];
  const headerIndex = buildHeaderIndex(header);

  const plannedCount = planned.length;
  if (lastCol < plannedCount) {
    sheet.insertColumnsAfter(lastCol, plannedCount - lastCol);
  }

  const reordered = [];
  for (let r = 0; r < data.length; r++) {
    const row = new Array(plannedCount).fill("");
    for (let c = 0; c < plannedCount; c++) {
      const name = planned[c];
      const idx = getOptionalColumnIndex(headerIndex, name);
      row[c] = idx ? data[r][idx - 1] : "";
    }
    reordered.push(row);
  }

  reordered[0] = planned.slice();
  sheet.getRange(1, 1, reordered.length, plannedCount).setValues(reordered);
}
