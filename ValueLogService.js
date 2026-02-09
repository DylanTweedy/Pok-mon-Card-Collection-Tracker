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

  const header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 3)).getValues()[0];
  const hasHeader = header.filter(Boolean).length > 0;
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, 3).setValues([["Timestamp", "Total Cards", "Total Value"]]);
  }

  const finalHeader = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = buildHeaderIndex(finalHeader);

  const row = new Array(finalHeader.length).fill("");
  const timestampIdx = index["timestamp"] || 1;
  row[timestampIdx - 1] = new Date();

  const totalCardsIdx = index["totalcards"] || index["totalcardsowned"];
  if (totalCardsIdx) row[totalCardsIdx - 1] = stats.totalCardsOwned || 0;

  const totalValueIdx = index["totalvalue"] || index["totalvaluegbp"];
  if (totalValueIdx) row[totalValueIdx - 1] = stats.totalValue || 0;

  const distinctIdx = index["distinctcardsowned"];
  if (distinctIdx) row[distinctIdx - 1] = stats.distinctCardsOwned || 0;

  const coverageIdx = index["pricecoveragepct"];
  if (coverageIdx) row[coverageIdx - 1] = stats.priceCoveragePct || 0;

  const confidenceIdx = index["avgconfidence"];
  if (confidenceIdx) row[confidenceIdx - 1] = stats.avgConfidence || 0;

  sheet.appendRow(row);

  if (totalValueIdx) {
    sheet.getRange(sheet.getLastRow(), totalValueIdx, 1, 1).setNumberFormat("\u00a3#,##0.00");
  }
  if (coverageIdx) {
    sheet.getRange(sheet.getLastRow(), coverageIdx, 1, 1).setNumberFormat("0.0");
  }
  if (confidenceIdx) {
    sheet.getRange(sheet.getLastRow(), confidenceIdx, 1, 1).setNumberFormat("0.00");
  }
}

function upsertValueLogChart(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const valueLog = ss.getSheetByName("ValueLog");
  if (!valueLog) return;

  const lastRow = valueLog.getLastRow();
  if (lastRow < 2) return;

  const header = valueLog.getRange(1, 1, 1, valueLog.getLastColumn()).getValues()[0];
  const index = buildHeaderIndex(header);
  const timestampIdx = index["timestamp"] || 1;
  const totalValueIdx = index["totalvalue"] || index["totalvaluegbp"] || 2;

  const dataRange = valueLog.getRange(1, Math.min(timestampIdx, totalValueIdx), lastRow, Math.abs(totalValueIdx - timestampIdx) + 1);
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
    .addRange(valueLog.getRange(1, timestampIdx, lastRow, 1))
    .addRange(valueLog.getRange(1, totalValueIdx, lastRow, 1))
    .setOption("title", title)
    .setOption("legend", { position: "none" })
    .setOption("hAxis", { title: "Date" })
    .setOption("vAxis", { title: "Value (GBP)" })
    .setPosition(2, 8, 0, 0)
    .build();

  dashboard.insertChart(chart);
}
