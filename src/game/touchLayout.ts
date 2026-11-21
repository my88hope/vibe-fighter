export type TouchButtonId = 'left' | 'right' | 'jump' | 'light' | 'heavy' | 'special' | 'block';

export interface TouchButtonSpec {
  id: TouchButtonId;
  x: number;
  y: number;
  radius: number;
  hitRadius: number;
  accentColor: number;
  label?: string;
  arrow?: 'left' | 'right' | 'up';
}

export interface TouchFighterInput {
  left: boolean;
  right: boolean;
  crouch: boolean;
  block: boolean;
  jump: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
}

/**
 * Returns true when running on a phone, iPad, or tablet (including iPadOS Safari
 * which reports a MacIntel platform with multiple touch points).
 */
export function isTouchCapableDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';
  const maxTouchPoints = nav?.maxTouchPoints ?? 0;
  const isIpadOs = nav?.platform === 'MacIntel' && maxTouchPoints > 1;
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet/i.test(ua);
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  return isIpadOs || isMobileUa || hasCoarsePointer;
}

/**
 * Computes bottom-left movement arrow buttons and bottom-right action buttons
 * (Attack, Kick, Special, and Block) scaled to the active viewport size.
 */
export function computeTouchButtonLayout(width: number, height: number): TouchButtonSpec[] {
  const compact = width < 900;
  const scale = compact ? 0.84 : 1;
  const arrowR = Math.round(37 * scale);
  const actionR = Math.round(39 * scale);
  const blockR = Math.round(29 * scale);
  const padHitExtra = Math.round(13 * scale);

  // Bottom-left movement arrows (Left, Right, Jump/Up)
  const leftX = Math.round((compact ? 56 : 74) * scale);
  const rightX = leftX + Math.round(98 * scale);
  const moveY = height - Math.round(62 * scale);
  const jumpX = Math.round((leftX + rightX) / 2);
  const jumpY = moveY - Math.round(80 * scale);

  // Bottom-right combat buttons (Attack, Kick, Special, Block)
  const kickX = width - Math.round((compact ? 58 : 74) * scale);
  const attackX = kickX - Math.round(98 * scale);
  const primaryY = height - Math.round(64 * scale);
  const specialX = Math.round((attackX + kickX) / 2);
  const specialY = primaryY - Math.round(86 * scale);
  const blockX = attackX - Math.round(78 * scale);
  const blockY = height - Math.round(52 * scale);

  return [
    {
      id: 'left',
      x: leftX,
      y: moveY,
      radius: arrowR,
      hitRadius: arrowR + padHitExtra,
      accentColor: 0x94a3b8,
      arrow: 'left'
    },
    {
      id: 'right',
      x: rightX,
      y: moveY,
      radius: arrowR,
      hitRadius: arrowR + padHitExtra,
      accentColor: 0x94a3b8,
      arrow: 'right'
    },
    {
      id: 'jump',
      x: jumpX,
      y: jumpY,
      radius: arrowR,
      hitRadius: arrowR + padHitExtra,
      accentColor: 0x38bdf8,
      arrow: 'up'
    },
    {
      id: 'light',
      x: attackX,
      y: primaryY,
      radius: actionR,
      hitRadius: actionR + padHitExtra,
      accentColor: 0xf43f5e,
      label: 'ATK'
    },
    {
      id: 'heavy',
      x: kickX,
      y: primaryY,
      radius: actionR,
      hitRadius: actionR + padHitExtra,
      accentColor: 0xf59e0b,
      label: 'KICK'
    },
    {
      id: 'special',
      x: specialX,
      y: specialY,
      radius: Math.round(37 * scale),
      hitRadius: Math.round(37 * scale) + padHitExtra,
      accentColor: 0x38bdf8,
      label: 'SPECIAL'
    },
    {
      id: 'block',
      x: blockX,
      y: blockY,
      radius: blockR,
      hitRadius: blockR + padHitExtra,
      accentColor: 0x60a5fa,
      label: 'BLK'
    }
  ];
}

/**
 * Maps currently-held touch button IDs and the previous frame's pressed IDs
 * into a {@link TouchFighterInput}, keeping movement/block continuous and
 * jump/attack/kick/special edge-triggered.
 */
export function resolveTouchFighterInput(
  pressed: ReadonlySet<TouchButtonId>,
  previous: ReadonlySet<TouchButtonId>
): TouchFighterInput {
  const justPressed = (id: TouchButtonId): boolean => pressed.has(id) && !previous.has(id);

  return {
    left: pressed.has('left'),
    right: pressed.has('right'),
    crouch: false,
    block: pressed.has('block'),
    jump: justPressed('jump'),
    light: justPressed('light'),
    heavy: justPressed('heavy'),
    special: justPressed('special')
  };
}
