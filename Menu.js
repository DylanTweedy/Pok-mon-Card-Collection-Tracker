/**
 * Adds a custom menu to the spreadsheet when opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Pokémon Cards 🃏")
    .addItem("Create Set Sheet", "showSetSheetPrompt")
    .addItem("Refresh Prices (Owned Only)", "refreshPricesOwnedOnly")
    .addItem("Refresh Prices (All)", "refreshPricesAll")
    .addItem("Update Dashboard", "updateDashboard")
    .addItem("Export CSV", "exportSetsToCSV")
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


