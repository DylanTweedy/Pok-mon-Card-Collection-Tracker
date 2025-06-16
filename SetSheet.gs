// === SetSheet.gs ===
// Handles creation and updating of set-specific sheets with Pokémon card data

function createOrUpdateSetSheet(setId) {
  const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&orderBy=number&pageSize=250`;
  const options = {
    method: 'get',
    headers: { 'X-Api-Key': API_KEY }
  };

  const response = UrlFetchApp.fetch(url, options);
  const cards = JSON.parse(response.getContentText()).data;

  if (!cards || cards.length === 0) {
    SpreadsheetApp.getUi().alert(`No cards found for set ID: ${setId}`);
    return;
  }

  const sheetName = cards[0].set.name;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) sheet.clear(); else sheet = ss.insertSheet(sheetName);

  const headers = ["🧮 Quantity", "Condition", "📝 Name", "⭐ Rarity", "💰 Market Price (£)", "📈 Total (£)", "🆔 Card ID"];
  sheet.appendRow(headers);

  for (const card of cards) {
    const priceUSD = card.tcgplayer?.prices?.normal?.market || card.tcgplayer?.prices?.holofoil?.market || 0;
    const priceGBP = priceUSD * USD_TO_GBP;
    const totalFormula = `=A${sheet.getLastRow() + 1}*E${sheet.getLastRow() + 1}`;
    const conditionDropdown = "Near Mint";
    sheet.appendRow([0, conditionDropdown, card.name, card.rarity || "Unknown", priceGBP.toFixed(2), totalFormula, card.id]);
  }

  applySetSheetStyling(sheet);
  addConditionDropdown(sheet);
}

function applySetSheetStyling(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastCol).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment("center");
  sheet.getRange(2, 5, lastRow - 1, 2).setHorizontalAlignment("center");
  sheet.getRange(1, 1, lastRow, lastCol).setBorder(true, true, true, true, true, true);
  sheet.getRange(1, 1, lastRow, lastCol).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  sheet.autoResizeColumns(1, lastCol);
}

function addConditionDropdown(sheet) {
  const range = sheet.getRange(2, 2, sheet.getLastRow() - 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(CONDITIONS), true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function updateAllSetSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const sheet of getActiveSets()) {
    const data = sheet.getDataRange().getValues();
    const quantityCol = 1, conditionCol = 2, priceCol = 5, totalCol = 6, cardIdCol = 7;

    for (let i = 1; i < data.length; i++) {
      const cardId = data[i][cardIdCol - 1];
      const qty = +data[i][quantityCol - 1] || 0;
      const condition = data[i][conditionCol - 1]?.trim() || "Near Mint";

      if (!cardId) continue;

      const url = `https://api.pokemontcg.io/v2/cards/${cardId}`;
      const options = {
        method: 'get',
        headers: { 'X-Api-Key': API_KEY }
      };

      try {
        const response = UrlFetchApp.fetch(url, options);
        const card = JSON.parse(response.getContentText()).data;
        const priceUSD = card.tcgplayer?.prices?.normal?.market || card.tcgplayer?.prices?.holofoil?.market || 0;
        const basePriceGBP = priceUSD * USD_TO_GBP;
        const multiplier = CONDITIONS[condition] || 1;
        const adjustedPrice = basePriceGBP * multiplier;

        sheet.getRange(i + 1, priceCol).setValue(adjustedPrice.toFixed(2));
        sheet.getRange(i + 1, totalCol).setFormula(`=A${i + 1}*E${i + 1}`);
      } catch (e) {
        sheet.getRange(i + 1, priceCol).setValue("Error");
        sheet.getRange(i + 1, totalCol).setValue("Error");
      }
    }
  }
}
