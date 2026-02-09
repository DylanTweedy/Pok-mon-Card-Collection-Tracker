
# Pokémon Card Tracker (Google Sheets)

Track and visualize your Pokémon TCG collection in Google Sheets with:
- Live market price syncing
- Per-set and rarity breakdowns
- Auto-generated dashboard with charts
- Modular Apps Script system

## Features
- Market value tracking via PokémonTCG.io API
- Top 10 most valuable cards table
- Stacked rarity charts
- Dark-mode friendly dashboard
- Per-set ownership and value summary

## Setup
1. Open a new Google Sheet and launch **Extensions > Apps Script**.
2. Copy all `.js` files from this repo into the Apps Script editor.
3. Obtain an API key from [pokemontcg.io](https://pokemontcg.io/) and set it in `Globals.js` under the `API_KEY` constant.
4. Run `createSetSheet(setId)` to create a sheet for a set.
5. Execute `updateDashboard()` (or use the custom menu) to build the dashboard.

---

This project is released under the [MIT License](LICENSE).
Built by Dylan Tweedy, 2025.
