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
export type MyFighterSheetSlot =
  | 'idle'
  | 'walk'
  | 'punch'
  | 'kick'
  | 'hit'
  | 'ko'
  | 'jump'
  | 'crouch'
  | 'block'
  | 'special'
  | 'portrait';

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
  /** Optional explicit filenames (e.g. { idle: 'idle.jpg' }) to skip extension probing. */
  files?: Partial<Record<MyFighterSheetSlot, string>>;
}

const JPG_BASE: Partial<Record<MyFighterSheetSlot, string>> = {
  idle: 'idle.jpg',
  walk: 'walk.jpg',
  punch: 'punch.jpg',
  kick: 'kick.jpg',
  hit: 'hit.jpg',
  ko: 'ko.jpg'
};

const JPG_WITH_SPECIAL: Partial<Record<MyFighterSheetSlot, string>> = {
  ...JPG_BASE,
  special: 'special.jpg'
};

export const MY_FIGHTERS: MyFighter[] = [
  {
    id: 'my-hero',
    name: 'My Hero',
    files: {
      idle: 'idle.png',
      walk: 'walk.png',
      punch: 'punch.png',
      kick: 'kick.png',
      hit: 'hit.png',
      ko: 'ko.png'
    }
  },
  { id: 'maki', name: 'Maki', flip: true, files: JPG_WITH_SPECIAL },
  { id: 'ariungerel', name: 'Ariungerel', flip: true, files: JPG_BASE },
  { id: 'gojo', name: 'Gojo', flip: true, specialReach: 190, specialFrames: [3], files: JPG_WITH_SPECIAL },
  { id: 'naruto', name: 'Naruto', flip: true, specialReach: 80, specialFrames: [3], files: JPG_WITH_SPECIAL },
  { id: 'goku', name: 'Goku', flip: true, specialReach: 220, specialFrames: [2, 3], files: JPG_WITH_SPECIAL },
  { id: 'luffy', name: 'Luffy', flip: true, specialReach: 95, specialFrames: [3], files: JPG_WITH_SPECIAL },
  { id: 'tanjiro', name: 'Tanjiro', flip: true, specialReach: 120, specialFrames: [2], files: JPG_WITH_SPECIAL },
  { id: 'ichigo', name: 'Ichigo', flip: true, specialReach: 190, specialFrames: [2], files: JPG_WITH_SPECIAL }
];
