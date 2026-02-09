// Styling.js - layout helpers

const sectionColors = [
  "#1e1e1e",
  "#252525",
  "#2c2c2c",
  "#333333"
];

function applyRowBanding(range, rowCount) {
  for (let i = 0; i < rowCount; i++) {
    const color = sectionColors[i % sectionColors.length];
    range.getCell(i + 1, 1).offset(0, 0, 1, range.getWidth())
      .setBackground(color)
      .setFontColor("#dddddd");
  }
}







function getLabelWithEmoji(name) {
  return "🃏 " + name;
}

