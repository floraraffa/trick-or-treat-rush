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
// (how much candy lies on the streets is set per level, in DIFFICULTY)
export const MADNESS_SPECIALS = 6; // golden pumpkins and rainbow candy scattered when Madness starts
export const CANDY_RESPAWN = [2.5, 5];
export const PICKUP_R = 1.15;
export const PICKUP_SLACK = 1.2; // the session forgives this much lag on top

// Power-ups: held one at a time, used with the action button. Every power lasts POWER_SECONDS.
export const POWER_SECONDS = 20;
export const POWERUPS = {
  rain: { dur: POWER_SECONDS, radius: [1.5, 9], fall: 1.1, life: 10 }, // candy storm: how far, fall time, how long they wait (pieces a second: per level)
  shield: { dur: POWER_SECONDS }, // blocks one attack, or fades after this long
  magnet: { dur: POWER_SECONDS, radius: 16 },
  double: { dur: POWER_SECONDS },
};
export const POWERUP_KINDS = Object.keys(POWERUPS);
export const RAIN_MIX = { caramel: 55, lollipop: 30, chocolate: 12, pumpkin: 3 }; // lots of small candy
export const ORB_R = 1.5;

// Gems: crystals that give a power the moment you grab one.
//   giant: you grow huge, monsters can't hurt you, and any you touch is scared off and drops candy.
//   thief: every monster takes fright and flees; catch one to steal its candy (what it took, and more).
//   ghost: you turn into a ghost; monsters can't see or touch you, and you float through them and through walls.
export const GEMS = {
  giant: { dur: POWER_SECONDS, scale: 2.2, speed: 1.25, reach: 2 },
  thief: { dur: POWER_SECONDS },
  ghost: { dur: POWER_SECONDS, speed: 1.1 },
};
export const GEM_KINDS = Object.keys(GEMS);
export const GEM_R = 1.3;

// Players.
export const MOVE = { walk: 2.4, run: 5.0, accel: 16, turn: 10 };
export const SLOW_MUL = 0.5;
// Running on its own: keep going the same way for `after` seconds and the Bitmoji speeds up over
// `ramp` seconds to `mul` × the run speed, faster than any monster. Stopping, or turning more than
// `turn` degrees at once, drops back to the joystick's pace.
export const AUTORUN = { after: 1.1, ramp: 0.9, mul: 1.5, turn: 100 };

// Monsters: what every level shares (speeds on patrol, reach, what a hit costs, as asked).
export const MONSTERS = {
  ghost: { patrol: 1.7, reach: 1.0, penalty: 10 },
  zombie: { patrol: 0.9, reach: 1.15, slow: 5 },
};
// Levels: how many monsters, how fast and keen they are, how long a hit protects you, and how much
// help the night hands out.
//   lead: seconds ahead of a running player a chasing monster aims (it cuts you off); flee: how fast
//   frightened monsters run (× the medium speed).
//   help: candy on the streets (and in the Madness), power-up orbs out and how soon a taken one comes
//   back, gems (the first one, the gap to the next, how many out at once), how long a scared-off monster
//   stays away and the candy it drops on top of what it stole, candy rain pieces a second.
// Hard is meant to be really hard: four ghosts nearly as fast as a run (only running on your own gets
// you clear) that see far, chase for long and aim where you are going; a third zombie; in the Madness
// the ghosts outrun a run and only a flat-out sprint escapes; little protection after a hit; and scarce
// candy, orbs and gems.
export const DIFFICULTY = {
  easy: {
    ghost: { count: 2, chase: 2.6, detect: 5.5, giveUp: 9, maxChase: 4.5 },
    zombie: { count: 1, chase: 1.6, detect: 5, giveUp: 8, maxChase: 5 },
    madnessSpeed: 1.1, invulnerable: 5, recover: 3.5, grace: 10, refocus: 4.5, trickLife: 6, lead: 0, flee: 0.8,
    help: { candy: 26, candyMadness: 32, orbs: 4, orbBack: 8, gemFirst: 6, gemEvery: [8, 12], gems: 2, banished: 7, scareLoot: 15, rain: 6 },
  },
  medium: {
    ghost: { count: 2, chase: 3.1, detect: 7, giveUp: 12, maxChase: 6.5 },
    zombie: { count: 2, chase: 1.9, detect: 6, giveUp: 10, maxChase: 7 },
    madnessSpeed: 1.2, invulnerable: 3.5, recover: 2.5, grace: 7, refocus: 3.5, trickLife: 9, lead: 0.3, flee: 1,
    help: { candy: 22, candyMadness: 28, orbs: 3, orbBack: 12, gemFirst: 10, gemEvery: [10, 16], gems: 2, banished: 5, scareLoot: 10, rain: 5 },
  },
  hard: {
    ghost: { count: 4, chase: 4.8, detect: 12, giveUp: 18, maxChase: 11 },
    zombie: { count: 3, chase: 2.8, detect: 8.5, giveUp: 14, maxChase: 10 },
    madnessSpeed: 1.3, invulnerable: 2, recover: 1.4, grace: 3, refocus: 1.2, trickLife: 15, lead: 0.7, flee: 1.6,
    help: { candy: 16, candyMadness: 20, orbs: 2, orbBack: 25, gemFirst: 30, gemEvery: [30, 40], gems: 1, banished: 2, scareLoot: 0, rain: 3.5 },
  },
};
export const LEVELS = Object.keys(DIFFICULTY);
export const DEFAULT_LEVEL = 'medium';

// Network pacing.
export const SNAP_HZ = 10;
export const POSE_HZ = 15;
export const INTERP_DELAY = 0.12;
