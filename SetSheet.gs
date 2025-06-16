// === SetSheet.gs ===
// Handles creation and updating of set-specific sheets with Pokémon card data

const COLS = {
  QUANTITY: 1,
  CONDITION: 2,
  NAME: 3,
  RARITY: 4,
  PRICE: 5,
  TOTAL: 6,
  CARD_ID: 7
};

/**
 * Converts a 1-indexed column number to its letter representation.
 * @param {number} col Column index
 * @return {string} Column letter
 */
function colToLetter(col) {
  let temp = '';
  while (col > 0) {
    let rem = (col - 1) % 26;
    temp = String.fromCharCode(65 + rem) + temp;
    col = Math.floor((col - 1) / 26);
  }
  return temp;
}

/**
 * Creates or refreshes a sheet for the given set ID.
 * @param {string} setId The Pokémon TCG set identifier
 */
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
    const row = sheet.getLastRow() + 1;
    const totalFormula = `=A${row}*${colToLetter(COLS.PRICE)}${row}`;
    const conditionDropdown = "Near Mint";
    sheet.appendRow([0, conditionDropdown, card.name, card.rarity || "Unknown", priceGBP.toFixed(2), totalFormula, card.id]);
  }

  applySetSheetStyling(sheet);
  addConditionDropdown(sheet);
  sheet.getRange(2, COLS.PRICE, sheet.getLastRow() - 1).setNumberFormat("£#,##0.00");
}

/**
 * Applies borders and alignment to a set sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet to style
 */
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

/**
 * Adds a data validation dropdown for card condition.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Target sheet
 */
function addConditionDropdown(sheet) {
  const range = sheet.getRange(2, 2, sheet.getLastRow() - 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(CONDITIONS), true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

/**
 * Refreshes pricing information across all set sheets.
 */
function updateAllSetSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const sheet of getActiveSets()) {
    const data = sheet.getDataRange().getValues();
    const priceValues = [];
    const totalFormulas = [];

    for (let i = 1; i < data.length; i++) {
      const cardId = data[i][COLS.CARD_ID - 1];
      const condition = data[i][COLS.CONDITION - 1]?.trim() || "Near Mint";

      if (!cardId) {
        priceValues.push([""]);
        totalFormulas.push([""]);
        continue;
      }

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

        priceValues.push([adjustedPrice]);
        totalFormulas.push([`=A${i + 1}*${colToLetter(COLS.PRICE)}${i + 1}`]);
      } catch (e) {
        priceValues.push(["Error"]);
        totalFormulas.push(["Error"]);
      }
    }

    if (priceValues.length > 0) {
      sheet.getRange(2, COLS.PRICE, priceValues.length).setValues(priceValues);
      sheet.getRange(2, COLS.TOTAL, totalFormulas.length).setFormulas(totalFormulas);
      sheet.getRange(2, COLS.PRICE, priceValues.length).setNumberFormat("£#,##0.00");
    }
  }
}
