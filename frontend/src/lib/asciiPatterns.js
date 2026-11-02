/*
35 small ASCII tiles. One is picked at random and repeated to fill the background of today's
cell (see CalendarGrid). Every line of a tile has the same width so the repeat lines up.
*/
export const ASCII_PATTERNS = [
  { name: "Dots", tile: [". ", " ."] },
  { name: "Plus", tile: ["+   ", "  + "] },
  { name: "Stars", tile: ["* . ", " . *"] },
  { name: "Slash", tile: ["/   ", " /  ", "  / ", "   /"] },
  { name: "Backslash", tile: ["\\   ", " \\  ", "  \\ ", "   \\"] },
  { name: "Lattice", tile: ["/\\", "\\/"] },
  { name: "Waves", tile: ["~~--", "--~~"] },
  { name: "Bricks", tile: ["_|_____", "___|___"] },
  { name: "Checker", tile: ["#.", ".#"] },
  { name: "Big checker", tile: ["##..", "##..", "..##", "..##"] },
  { name: "Hearts", tile: ["<3 ", " <3"] },
  { name: "Arrows", tile: [">  ", " > ", "  >"] },
  { name: "Chevrons", tile: ["^v", "v^"] },
  { name: "Grid", tile: ["+--", "|  "] },
  { name: "Circles", tile: ["o  ", " O ", "  o"] },
  { name: "Diamonds", tile: [" /\\ ", "/  \\", "\\  /", " \\/ "] },
  { name: "Cross hatch", tile: ["x ", " x"] },
  { name: "Rails", tile: ["====", "    "] },
  { name: "Percent", tile: ["%.", ".%"] },
  { name: "At signs", tile: ["@ . ", " . @"] },
  { name: "Rain", tile: [" '   ", "   ' ", "  ,  "] },
  { name: "Mountains", tile: ["  /\\  ", " /  \\ ", "/    \\"] },
  { name: "Braces", tile: ["{}  ", "  {}"] },
  { name: "Binary", tile: ["0101", "1010"] },
  { name: "Big stars", tile: ["  *  ", " *** ", "  *  "] },
  { name: "Dashes", tile: ["-- ", " --"] },
  { name: "Pipes", tile: ["| ", "| "] },
  { name: "Colons", tile: [":.", ".:"] },
  { name: "Faces", tile: ["^_^ ", "    "] },
  { name: "Cats", tile: ["=^.^= ", "      "] },
  { name: "Snow", tile: ["*  .", " .  ", ".  *", "  . "] },
  { name: "Double slash", tile: ["// ", " //"] },
  { name: "Grid dots", tile: ["+-", "|."] },
  { name: "Blocks", tile: ["[]  ", "  []"] },
  { name: "Stitches", tile: ["x-x-", "-x-x"] },
];

export function randomPattern() {
  return ASCII_PATTERNS[Math.floor(Math.random() * ASCII_PATTERNS.length)];
}

/* The tile repeated into a block of text; the cell clips whatever does not fit */
export function renderPattern(tile, cols = 90, rows = 36) {
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const row = tile[r % tile.length];
    lines.push(row.repeat(Math.ceil(cols / row.length)).slice(0, cols));
  }
  return lines.join("\n");
}
