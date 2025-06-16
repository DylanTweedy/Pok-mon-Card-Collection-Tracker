
function getActiveSets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().filter(s => !EXCLUDED_SHEETS.includes(s.getName()));
}

function formatGBP(val) {
  return typeof val === "string"
    ? parseFloat(val.replace(/[£,]/g, ""))
    : Number(val) || 0;
}
