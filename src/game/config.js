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
export const ORB_R = 1.5;

// Gems: rare crystals that give a power the moment you grab one.
//   giant: you grow huge, monsters can't hurt you, and any you touch is scared off and drops candy.
//   thief: every monster takes fright and flees; catch one to steal its candy (what it took, and more).
export const GEMS = {
  giant: { dur: 8, scale: 2.2, speed: 1.25, reach: 2 },
  thief: { dur: 18 },
};
export const GEM_KINDS = Object.keys(GEMS);
export const GEM_FIRST = 18; // the first gem appears this long after GO
export const GEM_EVERY = [20, 30]; // and the next one this long after the last was taken
export const GEM_R = 1.3;
export const SCARE_LOOT = { ghost: 10, zombie: 10 }; // candy a scared-off monster drops, on top of what it stole
export const BANISHED = 5; // a scared-off monster stays away this long, then comes back on its route

// Players.
export const MOVE = { walk: 2.4, run: 5.0, accel: 16, turn: 10 };
export const SLOW_MUL = 0.5;
// Sprint: a burst faster than any monster, on its own button. Stamina runs out in `last` seconds
// of sprinting and refills in `refill` seconds once you let go (after a short breath).
export const SPRINT = { mul: 1.55, last: 3, refill: 4.5, breath: 0.6 };

// Monsters: what every level shares (speeds on patrol, reach, what a hit costs, as asked).
export const MONSTERS = {
  ghost: { patrol: 1.7, reach: 1.0, penalty: 10 },
  zombie: { patrol: 0.9, reach: 1.15, slow: 5 },
};
// Levels: how many monsters, how fast and keen they are, and how long a hit protects you.
//   hard is the first tuning of the game; medium and easy hand out fewer hits.
export const DIFFICULTY = {
  easy: {
    ghost: { count: 2, chase: 2.6, detect: 5.5, giveUp: 9, maxChase: 4.5 },
    zombie: { count: 1, chase: 1.6, detect: 5, giveUp: 8, maxChase: 5 },
    madnessSpeed: 1.1, invulnerable: 5, recover: 3.5, grace: 10, refocus: 4.5, trickLife: 6,
  },
  medium: {
    ghost: { count: 2, chase: 3.1, detect: 7, giveUp: 12, maxChase: 6.5 },
    zombie: { count: 2, chase: 1.9, detect: 6, giveUp: 10, maxChase: 7 },
    madnessSpeed: 1.2, invulnerable: 3.5, recover: 2.5, grace: 7, refocus: 3.5, trickLife: 9,
  },
  hard: {
    ghost: { count: 3, chase: 3.6, detect: 9, giveUp: 15, maxChase: 9 },
    zombie: { count: 2, chase: 2.2, detect: 7.5, giveUp: 12, maxChase: 10 },
    madnessSpeed: 1.35, invulnerable: 2.5, recover: 1.6, grace: 5, refocus: 2.5, trickLife: 12,
  },
};
export const LEVELS = Object.keys(DIFFICULTY);
export const DEFAULT_LEVEL = 'medium';

// Network pacing.
export const SNAP_HZ = 10;
export const POSE_HZ = 15;
export const INTERP_DELAY = 0.12;
