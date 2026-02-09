// Dashboard.js - layout and summary logic
function updateDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const dashboard = ss.getSheetByName("Dashboard") || ss.insertSheet("Dashboard");
  dashboard.clear();

  dashboard.setFrozenRows(1);
  dashboard.getRange("A1").setValue("Pokémon Collection Dashboard 🃏")
    .setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center")
    .setBackground("#1a1a1a").setFontColor("#ffffff");
  dashboard.getRange("A1:F1").merge();

  dashboard.getRange("A2").setValue("Last updated: " + new Date().toLocaleString())
    .setFontStyle("italic").setFontColor("#aaaaaa").setFontSize(10);

  dashboard.getRange("A4").setValue("Summary")
    .setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  dashboard.getRange("A5").setValue("Total Collection Value:").setFontWeight("bold");
  dashboard.getRange("B5").setNumberFormat("\u00a3#,##0.00");
  dashboard.getRange("A6").setValue("Total Cards Owned:").setFontWeight("bold");
  dashboard.getRange("B6").setNumberFormat("0");

  const setSheets = getActiveSets();
  let totalValue = 0;
  let totalOwned = 0;
  let distinctOwned = 0;
  let ownedWithPrice = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  const setSummary = [["Set", "Cards in Set", "Cards Owned", "Progress", "Value (GBP)"]];
  const topCards = [];
  const rarityCounts = {};

  setSheets.forEach(sheet => {
    const name = sheet.getName();
    const label = (typeof getLabelWithEmoji === "function") ? getLabelWithEmoji(name) : name;
    const data = sheet.getDataRange().getValues();
    const headerIndex = buildHeaderIndex(data[0] || []);
    const rows = data.slice(1);
    const totalCards = rows.filter(row => toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1])).length;
    let owned = 0;
    let value = 0;

    const priceConfidenceIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.PRICE_CONFIDENCE);

    rows.forEach(row => {
      const rowName = toTrimmedString(row[SET_SHEET_COLUMNS.NAME - 1]);
      if (!rowName) return;
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      const price = toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      const condition = toTrimmedString(row[SET_SHEET_COLUMNS.CONDITION - 1]) || "Near Mint";
      const rarity = toTrimmedString(row[SET_SHEET_COLUMNS.RARITY - 1]) || "Unknown";
      const multiplier = getConditionMultiplier(condition);

      if (qty > 0) {
        if (price > 0) {
          topCards.push({ name: rowName, set: name, price: price });
          ownedWithPrice++;
        }
        rarityCounts[rarity] = (rarityCounts[rarity] || 0) + qty;
        owned++;
        totalOwned += qty;
        distinctOwned++;
        if (priceConfidenceIndex) {
          confidenceSum += toNumber(row[priceConfidenceIndex - 1]);
          confidenceCount++;
        }
      }
      value += price * qty * multiplier;
    });

    totalValue += value;
    const percent = totalCards ? (owned / totalCards) : 0;
    setSummary.push([label, totalCards, owned, percent, value]);
  });

  dashboard.getRange("B5").setValue(totalValue);
  dashboard.getRange("B6").setValue(totalOwned);

  const setTableStart = 9;
  dashboard.getRange(`A${setTableStart - 1}:F${setTableStart - 1}`).merge()
    .setValue("Set Completion and Value").setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  dashboard.getRange(setTableStart, 1, 1, 5).setValues([setSummary[0]]).setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffffff");
  if (setSummary.length > 1) {
    dashboard.getRange(setTableStart + 1, 1, setSummary.length - 1, 5).setValues(setSummary.slice(1));
    dashboard.getRange(setTableStart + 1, 4, setSummary.length - 1, 1).setNumberFormat("0.0%");
    dashboard.getRange(setTableStart + 1, 5, setSummary.length - 1, 1).setNumberFormat("\u00a3#,##0.00");
    if (typeof applyRowBanding === "function") {
      applyRowBanding(dashboard.getRange(setTableStart + 1, 1, setSummary.length - 1, 5), setSummary.length - 1);
    }
  }

  const topStartRow = setTableStart + setSummary.length + 2;
  dashboard.getRange(`A${topStartRow - 1}:C${topStartRow - 1}`).merge()
    .setValue("Top 10 Most Valuable Cards").setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  dashboard.getRange(topStartRow, 1, 1, 3)
    .setValues([["Card", "Set", "Market Price (GBP)"]])
    .setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffffff");
  const top10 = topCards.sort((a, b) => b.price - a.price).slice(0, 10);
  if (top10.length) {
    dashboard.getRange(topStartRow + 1, 1, top10.length, 3)
      .setValues(top10.map(c => [c.name, c.set, c.price]))
      .setNumberFormat("\u00a3#,##0.00");
  }

  const rarityStart = topStartRow;
  dashboard.getRange(`E${rarityStart - 1}:F${rarityStart - 1}`).merge()
    .setValue("Rarity Breakdown").setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  const rarityRows = Object.keys(rarityCounts).map(k => [k, rarityCounts[k]]);
  dashboard.getRange(rarityStart, 5, 1, 2)
    .setValues([["Rarity", "Count"]])
    .setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffffff");
  if (rarityRows.length) {
    dashboard.getRange(rarityStart + 1, 5, rarityRows.length, 2).setValues(rarityRows);
  }

  dashboard.setColumnWidths(1, 1, 180);
  dashboard.setColumnWidths(5, 1, 140);
  dashboard.setHiddenGridlines(true);

  const coveragePct = distinctOwned ? (ownedWithPrice / distinctOwned) * 100 : 0;
  const avgConfidence = confidenceCount ? (confidenceSum / confidenceCount) : 0;
  logValueSnapshot({
    totalValue: totalValue,
    totalCardsOwned: totalOwned,
    distinctCardsOwned: distinctOwned,
    priceCoveragePct: coveragePct,
    avgConfidence: avgConfidence
  });

  upsertValueLogChart(dashboard);
}



