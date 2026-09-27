/**
 * Small, dependency-free flag vectors used by the language selectors.
 *
 * These are local, simplified geometric reconstructions: no network request,
 * emoji font, personal data or third-party runtime is involved. See LICENSE.md
 * in this directory for the CC0-1.0 dedication.
 */

const WIDTH = 48;
const HEIGHT = 32;

function dataUri(body: string): string {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

function horizontal(colors: readonly string[]): string {
  const height = HEIGHT / colors.length;
  return dataUri(colors.map((color, index) =>
    `<path fill="${color}" d="M0 ${index * height}h${WIDTH}v${height + 0.02}H0z"/>`,
  ).join(''));
}

function vertical(colors: readonly string[]): string {
  const width = WIDTH / colors.length;
  return dataUri(colors.map((color, index) =>
    `<path fill="${color}" d="M${index * width} 0h${width + 0.02}v${HEIGHT}H${index * width}z"/>`,
  ).join(''));
}

function nordic(background: string, cross: string, inner?: string): string {
  return dataUri(
    `<path fill="${background}" d="M0 0h48v32H0z"/>`
    + `<path fill="${cross}" d="M13 0h${inner ? 8 : 6}v11h27v${inner ? 10 : 6}H${inner ? 21 : 19}v15h-${inner ? 8 : 6}V${inner ? 21 : 17}H0V${inner ? 11 : 15}h13z"/>`
    + (inner ? `<path fill="${inner}" d="M15 0h4v13h29v6H19v13h-4V19H0v-6h15z"/>` : ''),
  );
}

const STAR = '24,6 26.2,12.5 33,12.5 27.5,16.5 29.6,23 24,19 18.4,23 20.5,16.5 15,12.5 21.8,12.5';

export const LOCAL_FLAG_SVG_BY_REGION = Object.freeze<Record<string, string>>({
  FR: vertical(['#0055A4', '#FFFFFF', '#EF4135']),
  GB: dataUri('<path fill="#012169" d="M0 0h48v32H0z"/><path stroke="#FFF" stroke-width="7" d="m0 0 48 32M48 0 0 32"/><path stroke="#C8102E" stroke-width="3" d="m0 0 48 32M48 0 0 32"/><path fill="#FFF" d="M19 0h10v11h19v10H29v11H19V21H0V11h19z"/><path fill="#C8102E" d="M22 0h4v14h22v4H26v14h-4V18H0v-4h22z"/>'),
  ES: dataUri('<path fill="#AA151B" d="M0 0h48v32H0z"/><path fill="#F1BF00" d="M0 8h48v16H0z"/>'),
  DE: horizontal(['#000000', '#DD0000', '#FFCE00']),
  IT: vertical(['#009246', '#FFFFFF', '#CE2B37']),
  PT: dataUri('<path fill="#046A38" d="M0 0h19v32H0z"/><path fill="#DA291C" d="M19 0h29v32H19z"/><circle cx="19" cy="16" r="5" fill="#FFCD00"/>'),
  NL: horizontal(['#AE1C28', '#FFFFFF', '#21468B']),
  PL: horizontal(['#FFFFFF', '#DC143C']),
  RU: horizontal(['#FFFFFF', '#0039A6', '#D52B1E']),
  CN: dataUri(`<path fill="#DE2910" d="M0 0h48v32H0z"/><polygon fill="#FFDE00" points="${STAR}" transform="translate(-14 -2) scale(.62)"/>`),
  JP: dataUri('<path fill="#FFF" d="M0 0h48v32H0z"/><circle cx="24" cy="16" r="8" fill="#BC002D"/>'),
  KR: dataUri('<path fill="#FFF" d="M0 0h48v32H0z"/><path fill="#CD2E3A" d="M24 9a7 7 0 0 1 0 14 3.5 3.5 0 0 0 0-7 3.5 3.5 0 0 1 0-7z"/><path fill="#0047A0" d="M24 23a7 7 0 0 1 0-14 3.5 3.5 0 0 0 0 7 3.5 3.5 0 0 1 0 7z"/><g stroke="#111" stroke-width="1.5"><path d="m8 8 7-4m-6 7 7-4m17 18 7-4m-6 7 7-4"/></g>'),
  SA: dataUri('<path fill="#006C35" d="M0 0h48v32H0z"/><path stroke="#FFF" stroke-width="1.8" stroke-linecap="round" d="M13 22h23M17 24h16"/><path fill="#FFF" d="M12 12h24v2H12zm3 4h18v2H15z"/>'),
  IN: dataUri('<path fill="#FF9933" d="M0 0h48v10.67H0z"/><path fill="#FFF" d="M0 10.67h48v10.66H0z"/><path fill="#138808" d="M0 21.33h48V32H0z"/><circle cx="24" cy="16" r="4" fill="none" stroke="#000080" stroke-width="1"/><circle cx="24" cy="16" r="1" fill="#000080"/>'),
  TR: dataUri('<path fill="#E30A17" d="M0 0h48v32H0z"/><circle cx="20" cy="16" r="8" fill="#FFF"/><circle cx="23" cy="16" r="6.5" fill="#E30A17"/><polygon fill="#FFF" points="32,11 33.5,14.3 37,14.6 34.3,16.9 35.1,20.4 32,18.6 28.9,20.4 29.7,16.9 27,14.6 30.5,14.3"/>'),
  SE: nordic('#006AA7', '#FECC00'),
  VN: dataUri(`<path fill="#DA251D" d="M0 0h48v32H0z"/><polygon fill="#FF0" points="${STAR}"/>`),
  TH: dataUri('<path fill="#A51931" d="M0 0h48v32H0z"/><path fill="#FFF" d="M0 5h48v22H0z"/><path fill="#2D2A4A" d="M0 10h48v12H0z"/>'),
  GR: dataUri('<path fill="#0D5EAF" d="M0 0h48v32H0z"/><g stroke="#FFF" stroke-width="3.55"><path d="M0 5.3h48M0 12.4h48M0 19.5h48M0 26.6h48"/></g><path fill="#0D5EAF" d="M0 0h18v18H0z"/><path fill="#FFF" d="M7 0h4v7h7v4h-7v7H7v-7H0V7h7z"/>'),
  CZ: dataUri('<path fill="#FFF" d="M0 0h48v16H0z"/><path fill="#D7141A" d="M0 16h48v16H0z"/><path fill="#11457E" d="m0 0 22 16L0 32z"/>'),
  RO: vertical(['#002B7F', '#FCD116', '#CE1126']),
  HU: horizontal(['#CE2939', '#FFFFFF', '#477050']),
  DK: nordic('#C60C30', '#FFFFFF'),
  FI: nordic('#FFFFFF', '#003580'),
  ID: horizontal(['#FF0000', '#FFFFFF']),
  NO: nordic('#BA0C2F', '#FFFFFF', '#00205B'),
  UA: horizontal(['#0057B7', '#FFD700']),
  CD: dataUri(`<path fill="#007FFF" d="M0 0h48v32H0z"/><path stroke="#F7D618" stroke-width="9" d="M-5 31 53 1"/><path stroke="#CE1021" stroke-width="5" d="M-5 31 53 1"/><polygon fill="#F7D618" points="${STAR}" transform="translate(-17 -3) scale(.55)"/>`),
  TZ: dataUri('<path fill="#1EB53A" d="M0 0h48v32H0z"/><path fill="#00A3DD" d="m48 0v32H0z"/><path stroke="#FCD116" stroke-width="11" d="M-5 34 53-2"/><path stroke="#000" stroke-width="7" d="M-5 34 53-2"/>'),
  SN: dataUri(`<path fill="#00853F" d="M0 0h16v32H0z"/><path fill="#FDEF42" d="M16 0h16v32H16z"/><path fill="#E31B23" d="M32 0h16v32H32z"/><polygon fill="#00853F" points="${STAR}" transform="translate(10 5) scale(.58)"/>`),
  NG: vertical(['#008751', '#FFFFFF', '#008751']),
  IL: dataUri('<path fill="#FFF" d="M0 0h48v32H0z"/><path fill="#0038B8" d="M0 4h48v3H0zm0 21h48v3H0z"/><path fill="none" stroke="#0038B8" stroke-width="1.4" d="m24 10 5 9H19zm0 12-5-9h10z"/>'),
  TW: dataUri('<path fill="#FE0000" d="M0 0h48v32H0z"/><path fill="#000095" d="M0 0h24v16H0z"/><circle cx="12" cy="8" r="4.2" fill="#FFF"/><circle cx="12" cy="8" r="2.4" fill="#000095"/>'),
  BD: dataUri('<path fill="#006A4E" d="M0 0h48v32H0z"/><circle cx="21" cy="16" r="8" fill="#F42A41"/>'),
});

export function localFlagSvg(region: string): string | null {
  return LOCAL_FLAG_SVG_BY_REGION[region.toUpperCase()] ?? null;
}
