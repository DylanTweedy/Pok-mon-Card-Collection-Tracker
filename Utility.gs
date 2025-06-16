
/**
 * Returns all sheets that are not explicitly excluded.
 * @return {GoogleAppsScript.Spreadsheet.Sheet[]} active data sheets
 */
function getActiveSets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().filter(s => !EXCLUDED_SHEETS.includes(s.getName()));
}
