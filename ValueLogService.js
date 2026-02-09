// ValueLogService.js - portfolio snapshot + chart

function computePortfolioStats() {
  const setSheets = getActiveSets();
  let totalValue = 0;
  let totalCardsOwned = 0;
  let distinctCardsOwned = 0;
  let ownedWithPrice = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  setSheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    const headerIndex = buildHeaderIndex(data[0]);
    const priceConfidenceIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      if (!name) continue;
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      const price = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
      const multiplier = getConditionMultiplier(condition);

      if (qty > 0) {
        totalCardsOwned += qty;
        distinctCardsOwned++;
        if (price > 0) ownedWithPrice++;
        if (priceConfidenceIndex) {
          confidenceSum += toNumber(row[priceConfidenceIndex - 1]);
          confidenceCount++;
        }
      }

      totalValue += price * qty * multiplier;
    }
  });

  const priceCoveragePct = distinctCardsOwned ? (ownedWithPrice / distinctCardsOwned) * 100 : 0;
  const avgConfidence = confidenceCount ? (confidenceSum / confidenceCount) : 0;

  return {
    totalValue: totalValue,
    totalCardsOwned: totalCardsOwned,
    distinctCardsOwned: distinctCardsOwned,
    priceCoveragePct: priceCoveragePct,
    avgConfidence: avgConfidence
  };
}

function appendValueLogSnapshot(stats) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("ValueLog") || ss.insertSheet("ValueLog");

  const header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), VALUELOG_HEADERS.length)).getValues()[0];
  const existing = header.filter(Boolean).length ? header : [];
  const normalized = existing.map(h => String(h));
  const finalHeader = VALUELOG_HEADERS.slice();

  normalized.forEach(h => {
    if (finalHeader.indexOf(h) === -1) finalHeader.push(h);
  });

  if (finalHeader.join("|") !== header.join("|")) {
    sheet.getRange(1, 1, 1, finalHeader.length).setValues([finalHeader]);
  }

  const row = [
    new Date(),
    stats.totalValue || 0,
    stats.totalCardsOwned || 0,
    stats.distinctCardsOwned || 0,
    stats.priceCoveragePct || 0,
    stats.avgConfidence || 0
  ];

  sheet.appendRow(row);
  sheet.getRange(sheet.getLastRow(), 2, 1, 1).setNumberFormat("\u00a3#,##0.00");
  sheet.getRange(sheet.getLastRow(), 5, 1, 1).setNumberFormat("0.0");
  sheet.getRange(sheet.getLastRow(), 6, 1, 1).setNumberFormat("0.00");
}

function upsertValueLogChart(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const valueLog = ss.getSheetByName("ValueLog");
  if (!valueLog) return;

  const lastRow = valueLog.getLastRow();
  if (lastRow < 2) return;

  const dataRange = valueLog.getRange(1, 1, lastRow, 2);
  const title = "Portfolio Value Over Time";

  let existing = null;
  const charts = dashboard.getCharts();
  charts.forEach(chart => {
    const options = chart.getOptions();
    if (options && options.title === title) existing = chart;
  });

  if (existing) {
    dashboard.removeChart(existing);
  }

  const chart = dashboard.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(dataRange)
    .setOption("title", title)
    .setOption("legend", { position: "none" })
    .setOption("hAxis", { title: "Date" })
    .setOption("vAxis", { title: "Value (GBP)" })
    .setPosition(2, 8, 0, 0)
    .build();

  dashboard.insertChart(chart);
}
