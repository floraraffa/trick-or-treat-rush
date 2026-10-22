// Every rule of the night in one place. Times in seconds, distances in metres.

export const ROUND_SECONDS = 180; // the whole round, exactly
export const MADNESS_AT = 60; // Monster Madness for the last minute
export const COUNTDOWN = 3; // 3, 2, 1, then GO!
export const MIN_PLAYERS = 2; // in a room; Snapchat itself runs one player per device (see README)
export const MAX_PLAYERS = 4;

// Trick or treat at the doors.
export const HOUSE_COOLDOWN = 15;
export const HOUSE_ODDS = { treat: 0.7, trick: 0.2, jackpot: 0.1 };
export const TREAT_CANDIES = [3, 6]; // a handful: min..max pieces, picked from TREAT_MIX
export const TREAT_MIX = { caramel: 60, lollipop: 32, chocolate: 8 };
export const JACKPOT = { candy: 'pumpkin', fullSlotBonus: 10 }; // a golden pumpkin and a power-up (or +10 with a full slot)
export const TRICKS = ['ghost', 'web']; // a ghost bursts out after you, or a sticky web holds you
export const TRAP_SLOW = 4;
export const TRICK_GHOST_LIFE = 12;

// Candy: points as asked, weights for what appears on the streets.
export const CANDY = {
  caramel: { points: 1, weight: 55 },
  lollipop: { points: 5, weight: 25 },
  chocolate: { points: 10, weight: 13 },
  pumpkin: { points: 25, weight: 5 }, // golden pumpkin
  rainbow: { points: 50, weight: 2 },
};
export const CANDY_MADNESS_WEIGHTS = { caramel: 40, lollipop: 25, chocolate: 17, pumpkin: 12, rainbow: 6 };
export const CANDY_ON_MAP = 22;
export const CANDY_ON_MAP_MADNESS = 28;
export const MADNESS_SPECIALS = 6; // golden pumpkins and rainbow candy scattered when Madness starts
export const CANDY_RESPAWN = [2.5, 5];
export const PICKUP_R = 1.15;
export const PICKUP_SLACK = 1.2; // the session forgives this much lag on top

// Power-ups: held one at a time, used with the action button.
export const POWERUPS = {
  speed: { dur: 8, mul: 2 },
  shield: { dur: 20 }, // blocks one attack, or fades after this long
  magnet: { dur: 8, radius: 7 },
  double: { dur: 10 },
};
export const POWERUP_KINDS = Object.keys(POWERUPS);
export const ORBS_ON_MAP = 3;
export const ORB_RESPAWN = 12;
export const ORB_R = 1.2;

// Players.
export const MOVE = { walk: 2.4, run: 5.0, accel: 16, turn: 10 };
export const SLOW_MUL = 0.5;
export const INVULNERABLE = 2.5; // protection after a hit, so one monster can't hit twice in a row

// Monsters.
export const MONSTERS = {
  ghost: { count: 3, patrol: 1.7, chase: 3.6, detect: 9, giveUp: 15, maxChase: 9, reach: 1.0, penalty: 10 },
  zombie: { count: 2, patrol: 0.9, chase: 2.2, detect: 7.5, giveUp: 12, maxChase: 10, reach: 1.15, slow: 5 },
  giant: { chase: 3.9, reach: 2.1, penalty: 10 },
};
export const MADNESS_SPEED = 1.35;
export const GRACE = 5; // no monster goes after anyone in the first seconds after GO
export const RECOVER = 1.6; // a monster backs off this long after an attack

// Network pacing.
export const SNAP_HZ = 10;
export const POSE_HZ = 15;
export const INTERP_DELAY = 0.12;
