/*
The send button shows the guitar emoji. The emoji font has only one guitar, so the set of
30 comes from 10 colours (hue rotation) in 3 poses (upright, mirrored, tilted).
*/
const HUES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
const POSES = [
  { flip: 1, tilt: 0 },
  { flip: -1, tilt: 0 },
  { flip: 1, tilt: -30 },
];

export const GUITARS = POSES.flatMap(pose => HUES.map(hue => ({ hue, ...pose })));

/* A random guitar that is not the one already showing */
export function nextGuitar(current) {
  let next = current;
  while (next === current) next = Math.floor(Math.random() * GUITARS.length);
  return next;
}

export function guitarStyle({ hue, flip, tilt }) {
  return {
    filter: `hue-rotate(${hue}deg)`,
    transform: `scaleX(${flip}) rotate(${tilt}deg)`,
  };
}
