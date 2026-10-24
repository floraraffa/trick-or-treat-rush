// Little flags for the language picker, drawn as inline SVG (emoji flags show as plain letters on some
// systems). Each language gets the flag of the variety its texts are written in: American English
// ("candy"), Rioplatense Spanish (vos), French, German. All on a 4:3 box.
const svg = (body) => `<svg class="flag" viewBox="0 0 640 480" aria-hidden="true" focusable="false">${body}</svg>`;

const usStripes = Array.from({ length: 13 }, (_, i) => (i % 2 ? '' : `<rect y="${(i * 480) / 13}" width="640" height="${480 / 13 + 0.5}" fill="#b22234"/>`)).join('');
const usStars = Array.from({ length: 5 }, (_, r) => Array.from({ length: r % 2 ? 5 : 6 }, (_, c) => `<circle cx="${(r % 2 ? 48 : 24) + c * 48}" cy="${28 + r * 50}" r="10" fill="#fff"/>`).join('')).join('');

export const FLAGS = {
  en: svg(`<rect width="640" height="480" fill="#fff"/>${usStripes}<rect width="288" height="${(7 * 480) / 13}" fill="#3c3b6e"/>${usStars}`),
  es: svg('<rect width="640" height="480" fill="#74acdf"/><rect y="160" width="640" height="160" fill="#fff"/><circle cx="320" cy="240" r="46" fill="#f6b40e" stroke="#85340a" stroke-width="5"/>'),
  fr: svg('<rect width="640" height="480" fill="#fff"/><rect width="213.3" height="480" fill="#002654"/><rect x="426.7" width="213.3" height="480" fill="#ce1126"/>'),
  de: svg('<rect width="640" height="160" fill="#000"/><rect y="160" width="640" height="160" fill="#dd0000"/><rect y="320" width="640" height="160" fill="#ffce00"/>'),
};
