// === SetSheet.gs === (Updated to use cardmarket prices)

const COLS = {
  QUANTITY: 1,
  CONDITION: 2,
  NAME: 3,
  RARITY: 4,
  PRICE: 5,
  TOTAL: 6,
  CARD_ID: 7
};

function colToLetter(col) {
  let temp = '';
  while (col > 0) {
    let rem = (col - 1) % 26;
    temp = String.fromCharCode(65 + rem) + temp;
    col = Math.floor((col - 1) / 26);
  }
  return temp;
}

function createOrUpdateSetSheet(setId) {
  const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&orderBy=number&pageSize=250`;
  const options = { headers: { 'X-Api-Key': API_KEY } };
  const res = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(res.getContentText());
  const cards = Array.isArray(json.data) ? json.data : [];

  if (cards.length === 0) {
    SpreadsheetApp.getUi().alert(`No cards found for set ID: ${setId}`);
    return;
  }

  const sheetName = cards[0].set?.name || setId;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) sheet.clear(); else sheet = ss.insertSheet(sheetName);

  sheet.appendRow([
    "🧮 Quantity", "Condition", "📝 Name", "⭐ Rarity", "💰 Market Price (£)", "📈 Total (£)", "🆔 Card ID"
  ]);

  cards.forEach(card => {
    const cardmarket = card.cardmarket?.prices || {};
    const priceEUR = cardmarket.averageSellPrice || 0;
    const priceGBP = priceEUR * EUR_TO_GBP;
    const row = sheet.getLastRow() + 1;
    const totalFormula = `=A${row}*${colToLetter(COLS.PRICE)}${row}`;

    sheet.appendRow([
      0,
      "Near Mint",
      card.name || "Unknown",
      card.rarity || "Unknown",
      priceGBP,
      totalFormula,
      card.id || ""
    ]);
  });

  applySetSheetStyling(sheet);
  addConditionDropdown(sheet);
  const numRows = sheet.getLastRow() - 1;
  sheet.getRange(2, COLS.PRICE, numRows).setNumberFormat("\"\u00a3\"#,##0.00");
}

function applySetSheetStyling(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastCol).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment("center");
  sheet.getRange(2, COLS.PRICE, lastRow - 1, 1).setHorizontalAlignment("center");
  sheet.getRange(2, COLS.TOTAL, lastRow - 1, 1).setHorizontalAlignment("center");

  sheet.getRange(1, 1, lastRow, lastCol).setBorder(true, true, true, true, true, true).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  sheet.autoResizeColumns(1, lastCol);
}

function addConditionDropdown(sheet) {
  const range = sheet.getRange(2, COLS.CONDITION, sheet.getLastRow() - 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(CONDITIONS), true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function updateAllSetSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(sheet => {
    if (EXCLUDED_SHEETS.includes(sheet.getName())) return;

    const data = sheet.getDataRange().getValues();
    const priceValues = [];
    const totalFormulas = [];

    for (let i = 1; i < data.length; i++) {
      const cardId = data[i][COLS.CARD_ID - 1];
      const condition = (data[i][COLS.CONDITION - 1] || "Near Mint").trim();
      if (!cardId) {
        priceValues.push([""]);
        totalFormulas.push([""]);
        continue;
      }

      try {
        const url = `https://api.pokemontcg.io/v2/cards/${cardId}`;
        const options = { headers: { 'X-Api-Key': API_KEY } };
        const json = JSON.parse(UrlFetchApp.fetch(url, options).getContentText());
        const card = json.data;
        const cardmarket = card.cardmarket?.prices || {};
        const priceEUR = cardmarket.averageSellPrice || 0;
        const baseGBP = priceEUR * EUR_TO_GBP;
        const finalGBP = baseGBP * (CONDITIONS[condition] || 1);
        priceValues.push([finalGBP]);
        const r = i + 1;
        totalFormulas.push([`=A${r}*${colToLetter(COLS.PRICE)}${r}`]);
      } catch {
        priceValues.push(["Error"]);
        totalFormulas.push(["Error"]);
      }
    }

    if (priceValues.length) {
      sheet.getRange(2, COLS.PRICE, priceValues.length).setValues(priceValues).setNumberFormat("\"\u00a3\"#,##0.00");
      sheet.getRange(2, COLS.TOTAL, totalFormulas.length).setFormulas(totalFormulas);
    }
  });
}
