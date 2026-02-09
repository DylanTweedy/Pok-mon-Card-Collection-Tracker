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

function test_UpdatePrices() {
  Logger.log("Running updatePrices...");
  updatePrices();
  Logger.log("updatePrices completed.");
}
