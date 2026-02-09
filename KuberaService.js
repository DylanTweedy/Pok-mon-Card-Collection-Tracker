// KuberaService.js - optional gated integration

function kuberaIsEnabled() {
  return getFlag("KUBERA_SYNC_ENABLED", false);
}

function kuberaRequest(path, method, payload) {
  if (!kuberaIsEnabled()) {
    throw new Error("Kubera sync disabled (KUBERA_SYNC_ENABLED=false)");
  }

  const apiKey = requireSecret("KUBERA_API_KEY");
  const baseUrl = getOptionalSecret("KUBERA_BASE_URL", "https://api.kubera.com");

  Utilities.sleep(2000);
  const url = baseUrl.replace(/\/$/, "") + path;
  const options = {
    method: method,
    contentType: "application/json",
    headers: { Authorization: `Bearer ${apiKey}` },
    muteHttpExceptions: true,
    payload: payload ? JSON.stringify(payload) : undefined
  };

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  if (code >= 400) {
    throw new Error(`Kubera request failed (${code})`);
  }

  return JSON.parse(res.getContentText() || "{}");
}

function getOrCreateKuberaMapSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("KuberaMap");
  if (!sheet) {
    sheet = ss.insertSheet("KuberaMap");
    sheet.getRange(1, 1, 1, 3).setValues([["CardKey", "KuberaAssetId", "LastVerified"]]);
    sheet.hideSheet();
  }
  return sheet;
}

function kuberaLinkAssets() {
  if (!kuberaIsEnabled()) {
    SpreadsheetApp.getUi().alert("Kubera sync disabled. Set KUBERA_SYNC_ENABLED=true in Script Properties.");
    return;
  }

  const mapSheet = getOrCreateKuberaMapSheet();
  const existing = mapSheet.getLastRow() > 1
    ? mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 2).getValues()
    : [];
  const known = new Set(existing.map(r => r[0]));

  const rows = [];
  getActiveSets().forEach(sheet => {
    const headerIndex = buildHeaderIndex(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    data.forEach(row => {
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      if (qty <= 0) return;
      const key = getCardKey(sheet.getName(), row, headerIndex);
      if (!known.has(key)) {
        rows.push([key, "", ""]);
        known.add(key);
      }
    });
  });

  if (rows.length) {
    mapSheet.getRange(mapSheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  }

  SpreadsheetApp.getUi().alert("KuberaMap populated. Fill KuberaAssetId manually if needed.");
}

function kuberaSyncNextBatch() {
  if (!kuberaIsEnabled()) {
    SpreadsheetApp.getUi().alert("Kubera sync disabled. Set KUBERA_SYNC_ENABLED=true in Script Properties.");
    return;
  }

  const mapSheet = getOrCreateKuberaMapSheet();
  if (mapSheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("KuberaMap is empty. Run 'Kubera: Link Assets' first.");
    return;
  }

  const mapData = mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 3).getValues();
  const cursor = parseInt(PropertiesService.getDocumentProperties().getProperty("KUBERA_SYNC_CURSOR") || "0", 10);

  const ownedCards = getOwnedCardsForSync();
  const batch = ownedCards.slice(cursor, cursor + 25);

  batch.forEach(item => {
    const mapRow = mapData.find(r => r[0] === item.cardKey);
    if (!mapRow || !mapRow[1]) return;

    try {
      kuberaRequest(`/api/v2/assets/${mapRow[1]}`, "PATCH", {
        value: item.priceGBP,
        currency: "GBP"
      });
      mapRow[2] = new Date();
    } catch (err) {
    }
  });

  if (batch.length) {
    mapSheet.getRange(2, 1, mapData.length, 3).setValues(mapData);
  }

  const nextCursor = cursor + batch.length;
  PropertiesService.getDocumentProperties().setProperty("KUBERA_SYNC_CURSOR", String(nextCursor));
  SpreadsheetApp.getUi().alert(`Kubera sync batch complete. Processed ${batch.length} items.`);
}

function getOwnedCardsForSync() {
  const owned = [];
  getActiveSets().forEach(sheet => {
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerIndex = buildHeaderIndex(header);
    const chosenIndex = getOptionalColumnIndex(headerIndex, SET_SHEET_OPTIONAL_HEADERS.CHOSEN_PRICE);
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    data.forEach(row => {
      const qty = toNumber(row[SET_SHEET_COLUMNS.QUANTITY - 1]);
      if (qty <= 0) return;
      const cardKey = getCardKey(sheet.getName(), row, headerIndex);
      const price = chosenIndex ? toNumber(row[chosenIndex - 1]) : toNumber(row[SET_SHEET_COLUMNS.PRICE - 1]);
      if (!price) return;
      owned.push({ cardKey: cardKey, priceGBP: price });
    });
  });

  return owned;
}
