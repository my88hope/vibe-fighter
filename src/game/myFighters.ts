/**
 * YOUR FIGHTERS — add one line per fighter.
 *
 *   id    the folder name: public/assets/<id>/   (english, lowercase, no spaces)
 *   name  the name shown in the game
 *   flip  true if your pictures face RIGHT (the game needs fighters facing LEFT)
 *
 * Pictures go in public/assets/<id>/ :
 *   idle  walk  punch  kick  hit  ko        (needed)
 *   jump  crouch  block  special  portrait  (bonus)
 *
 * Full rules: ADD_CHARACTER.md
 */
export interface MyFighter {
  id: string;
  name: string;
  flip?: boolean;
  /** Extra forward attack reach (in 256px frame pixels) for signature specials. */
  specialReach?: number;
  /** Explicit attack-active frame indices for `special` (single contiguous span). */
  specialFrames?: number[];
  /** Only if auto-detect counts the poses wrong: { kick: 4 } */
  frames?: Record<string, number>;
}

export const MY_FIGHTERS: MyFighter[] = [
  { id: 'my-hero', name: 'My Hero' },
  { id: 'maki', name: 'Maki', flip: true },
  { id: 'ariungerel', name: 'Ariungerel', flip: true },
  { id: 'gojo', name: 'Gojo', flip: true, specialReach: 190, specialFrames: [3] },
  { id: 'naruto', name: 'Naruto', flip: true, specialReach: 80, specialFrames: [3] },
  { id: 'goku', name: 'Goku', flip: true, specialReach: 220, specialFrames: [2, 3] },
  { id: 'luffy', name: 'Luffy', flip: true, specialReach: 95, specialFrames: [3] },
  { id: 'tanjiro', name: 'Tanjiro', flip: true, specialReach: 120, specialFrames: [2] },
  { id: 'ichigo', name: 'Ichigo', flip: true, specialReach: 190, specialFrames: [2] }
];
