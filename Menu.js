/**
 * Adds a custom menu to the spreadsheet when opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Pokémon Cards 🃏")
    .addItem("Create Set Sheet", "showSetSheetPrompt")
    .addItem("🧹 Repair Layout", "repairLayoutAllSheets")
    .addItem("💷 Refresh Prices", "refreshPrices")
    .addItem("Update Dashboard", "updateDashboard")
    .addItem("Export CSV", "exportSetsToCSV")
    .addItem("Debug: PTCG Card", "debugPTCGCard")
    .addItem("Debug: eBay Price", "debugEbayPrice")
    .addItem("Kubera: Link Assets", "kuberaLinkAssets")
    .addItem("Kubera: Sync Next Batch (25)", "kuberaSyncNextBatch")
    .addToUi();
}

/**
 * Prompts the user for a set ID and creates the sheet if missing.
 */
function showSetSheetPrompt() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("Enter Set ID", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const id = response.getResponseText().trim();
    if (id) {
      createSetSheet(id);
    }
  }
}


