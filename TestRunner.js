/**
 * Minimal sanity tests for Apps Script execution.
 */
function test_UpdateDashboard() {
  Logger.log("Running updateDashboard...");
  updateDashboard();
  Logger.log("updateDashboard completed.");
}

function test_UpdateAllSetSheets() {
  Logger.log("Running updateAllSetSheets...");
  updateAllSetSheets();
  Logger.log("updateAllSetSheets completed.");
}

function test_LogSnapshot() {
  Logger.log("Running logValueSnapshot...");
  logValueSnapshot();
  Logger.log("logValueSnapshot completed.");
}

function test_RefreshPrices() {
  Logger.log("Running refreshPrices...");
  refreshPrices();
  Logger.log("refreshPrices completed (chunked).");
}
