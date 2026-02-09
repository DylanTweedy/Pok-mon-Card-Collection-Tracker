/**
 * Test the API response for a single card ID to explore what data is available.
 */
function testTCGPlayerAPI() {
  const testCardId = "base1-8"; // example: Snorlax from Jungle (wrongly labeled base2 in your current setup)
  const url = `https://api.pokemontcg.io/v2/cards/${testCardId}`;
  const options = { headers: { 'X-Api-Key': API_KEY } };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  Logger.log(JSON.stringify(json, null, 2)); // view in Apps Script logs: View > Logs
}
