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

function test_RefreshPricesAllPokemonTCG() {
  Logger.log("Running refreshPricesAllPokemonTCG...");
  refreshPricesAllPokemonTCG();
  Logger.log("refreshPricesAllPokemonTCG completed.");
}

function test_RefreshPricesOwnedOnlyPokemonTCG() {
  Logger.log("Running refreshPricesOwnedOnlyPokemonTCG...");
  refreshPricesOwnedOnlyPokemonTCG();
  Logger.log("refreshPricesOwnedOnlyPokemonTCG completed.");
}
