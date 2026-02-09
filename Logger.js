function logValueSnapshot(stats) {
  const computed = stats || computePortfolioStats();
  appendValueLogSnapshot(computed);
}
