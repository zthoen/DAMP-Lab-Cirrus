// Every paste-a-spreadsheet parser in this app (labTable.js, protocolImport.js)
// splits a line the same way: tab-separated, falling back to comma-separated
// when there's no tab on the line at all. Shared here so the two parsers can't
// drift out of sync with each other.
export const splitRow = (line) => (line.includes("\t") ? line.split("\t") : line.split(","))
  .map((c) => c.trim());
