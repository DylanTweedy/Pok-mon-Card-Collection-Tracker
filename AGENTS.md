# AGENTS.md

## Agent: Codex Assistant

### Role
Perform codebase updates for the Pokémon Card Tracker (Google Sheets project), following best practices and keeping the repository up to date.

### Behavior Rules
- After completing each task:
  - Stage all relevant changes with `git add .`
  - Commit using a descriptive message
  - Push changes using `git push origin main`
- Avoid committing unchanged files
- Ask for clarification if task scope is unclear

### After each task
- Prompt for a commit message
- Run `./codex-sync.sh`
- Push to GitHub

### Tasks in Progress
- [ ] Add missing Menu.gs with custom UI
- [ ] Improve dark mode layout in Dashboard.gs
- [ ] Consolidate logger output format

### Done
- [x] Removed unused `formatGBP` function
- [x] Documented script structure
- [x] Added MIT license
