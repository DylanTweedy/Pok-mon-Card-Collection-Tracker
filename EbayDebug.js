// EbayDebug.js - diagnostics for eBay scraping

function debugEbayPrice() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("eBay Debug", "Enter card name (e.g. Alakazam) and set (e.g. Base), separated by |", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const text = response.getResponseText().trim();
  if (!text) return;
  const parts = text.split("|").map(p => p.trim());
  const cardName = parts[0] || "";
  const setName = parts[1] || "";
  if (!cardName || !setName) {
    ui.alert("Please enter both card name and set, separated by |");
    return;
  }

  const card = { cardKey: `${setName}|${cardName}`, name: cardName, setName: setName, qty: 1 };
  const result = fetchEbaySoldMedianGBP(card);
  const raw = debugEbayRawFetch(cardName, setName);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("eBay Debug");
  if (!sheet) sheet = ss.insertSheet("eBay Debug");
  sheet.clear();

  sheet.getRange(1, 1, 1, 2).setValues([["Field", "Value"]]);
  const rows = [
    ["Enabled", String(getFlag("EBAY_SCRAPE_ENABLED", true))],
    ["Query", `${cardName} ${setName} pokemon`],
    ["Result", result ? JSON.stringify(result) : "null"],
    ["Raw Count", String(raw.count)],
    ["Raw Sample", raw.sample],
    ["Raw Source", raw.source],
    ["Raw Size", String(raw.size)],
    ["Ebay Max/Run", String(getOptionalSecret("EBAY_MAX_FETCH_PER_RUN", "10"))],
    ["Ebay Cache Hours", String(getOptionalSecret("EBAY_CACHE_HOURS", "24"))]
  ];
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

function debugEbayRawFetch(cardName, setName) {
  try {
    const query = `${cardName} ${setName} pokemon`;
    const result = fetchEbayHtmlDebug(query);
    const html = result.text || "";
    const prices = extractEbayPrices(html);
    const sample = prices.slice(0, 5).map(p => `${p.currency}${p.amount}`).join(", ");
    return { count: prices.length, sample: sample, source: result.source || "unknown", size: html.length };
  } catch (err) {
    return { count: 0, sample: String(err), source: "error", size: 0 };
  }
}
