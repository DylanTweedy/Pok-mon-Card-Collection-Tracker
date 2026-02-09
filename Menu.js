/**
 * Adds a custom menu to the spreadsheet when opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Pokémon Cards 🃏")
    .addItem("Create Set Sheet", "showSetSheetPrompt")
    .addItem("Refresh Prices (All)", "refreshPricesAll")
    .addItem("Refresh Prices (Owned Only)", "refreshPricesOwnedOnly")
    .addItem("Update Dashboard", "updateDashboard")
    .addItem("Export CSV", "exportSetsToCSV")
    .addToUi();
}

/**
 * Prompts the user for a set ID and creates or updates the sheet.
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


