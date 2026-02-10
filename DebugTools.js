// DebugTools.js - helpers for inspecting PTCG API responses

function debugPTCGCard() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("PTCG Debug", "Enter a PokémonTCG card ID (e.g. base1-4):", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const cardId = response.getResponseText().trim();
  if (!cardId) return;

  const url = `https://api.pokemontcg.io/v2/cards/${cardId}`;
  let payload = {};
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    payload = JSON.parse(res.getContentText() || "{}");
  } catch (err) {
    payload = { error: String(err) };
  }

  const data = payload && payload.data ? payload.data : {};
  const prices = data.cardmarket && data.cardmarket.prices ? data.cardmarket.prices : {};
  const tcg = data.tcgplayer && data.tcgplayer.prices ? data.tcgplayer.prices : {};
  let tcgBlock = null;
  if (tcg.holofoil) tcgBlock = tcg.holofoil;
  else if (tcg.normal) tcgBlock = tcg.normal;
  else if (tcg["1stEditionHolofoil"]) tcgBlock = tcg["1stEditionHolofoil"];
  else if (tcg["1stEditionNormal"]) tcgBlock = tcg["1stEditionNormal"];
  else {
    const keys = Object.keys(tcg);
    if (keys.length) tcgBlock = tcg[keys[0]];
  }

  const rows = [
    ["Card ID", data.id || ""],
    ["Name", data.name || ""],
    ["Set", data.set ? data.set.name : ""],
    ["CM Avg Sell", prices.averageSellPrice || ""],
    ["CM Trend", prices.trendPrice || ""],
    ["CM Low", prices.lowPrice || ""],
    ["CM Avg 1", prices.average1 || ""],
    ["CM Avg 7", prices.average7 || ""],
    ["CM Avg 30", prices.average30 || ""],
    ["TCG Low", tcgBlock ? tcgBlock.low || "" : ""],
    ["TCG Mid", tcgBlock ? tcgBlock.mid || "" : ""],
    ["TCG High", tcgBlock ? tcgBlock.high || "" : ""],
    ["TCG Market", tcgBlock ? tcgBlock.market || "" : ""],
    ["TCG Direct Low", tcgBlock ? tcgBlock.directLow || "" : ""]
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("PTCG Debug");
  if (!sheet) {
    sheet = ss.insertSheet("PTCG Debug");
  } else {
    sheet.clear();
  }

  sheet.getRange(1, 1, 1, 2).setValues([["Field", "Value"]]);
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 4).setValue("Raw JSON");
  sheet.getRange(2, 4).setValue(JSON.stringify(payload, null, 2));
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(4, 600);
}
