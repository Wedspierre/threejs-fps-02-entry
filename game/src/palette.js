// The look plan, in one place. The lighting makes every shade the game needs, so no
// other colour appears in the code. The same names are the CSS custom properties in
// index.html. Emberline's palette is a dusk foundry: warm amber against cold steel and
// rust — kept light enough that the yard reads at a glance instead of sinking to black.
export const PALETTE = {
  canvas: '#241c14',
  surface: '#3d332a',
  hairline: '#5b4c3c',
  ink: '#efe8da',
  muted: '#b3a48f',
  accent: '#e8a33d',
  rust: '#b4552d',
  teal: '#3fb8a6',
};

export function shade(name) {
  return PALETTE[name];
}
