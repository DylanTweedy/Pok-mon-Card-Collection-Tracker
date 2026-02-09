/**
 * Minimal sanity tests for Apps Script execution.
 */
function test_UpdateDashboard() {
  Logger.log("Running updateDashboard...");
  updateDashboard();
  Logger.log("updateDashboard completed.");
}

function test_LogSnapshot() {
  Logger.log("Running logValueSnapshot...");
  logValueSnapshot();
  Logger.log("logValueSnapshot completed.");
}

function test_RefreshPricesAll() {
  Logger.log("Running refreshPricesAll...");
  refreshPricesAll();
  Logger.log("refreshPricesAll completed.");
}

function test_RefreshPricesOwnedOnly() {
  Logger.log("Running refreshPricesOwnedOnly...");
  refreshPricesOwnedOnly();
  Logger.log("refreshPricesOwnedOnly completed.");
}
