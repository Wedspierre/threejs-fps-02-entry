// The look plan, in one place. Six values and one accent hue; the lighting makes every
// shade the game needs, so no other colour appears in the code. The same names are the
// CSS custom properties in index.html. Emberline's palette is a dusk foundry: warm amber
// against cold steel and rust.
export const PALETTE = {
  canvas: '#17130f',
  surface: '#23201c',
  hairline: '#3a332b',
  ink: '#efe8da',
  muted: '#9a8f80',
  accent: '#e8a33d',
  rust: '#b4552d',
  teal: '#3fb8a6',
};

export function shade(name) {
  return PALETTE[name];
}
