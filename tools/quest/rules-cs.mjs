// The game's rule numbers and village plan as C# for the Meta Quest version (a Unity project in its own
// repository, trick-or-treat-rush-quest): every value comes from config.js and layout.js, so a change to the
// game here reaches the Quest by exporting again. Only the data is generated; the logic (authority, view,
// player, collisions) is ported by hand there and checked against traces of this game (trace.mjs).
//
// Types: a number is a double, a string a string, arrays of them double[] / string[]; objects become classes
// named by SCHEMA (a key missing in some of a class's objects becomes nullable), `Table<T>` keeps a JS
// object's keys in their order, `Weights` a { name: weight } object (pick() walks it in order).
import * as C from '../../src/game/config.js';
import * as L from '../../src/world/layout.js';
import '../../src/world/collide.js'; // (it gives every box collider its cos / sin)
import * as U from '../../src/dev/lens-ui.js';

const SCHEMA = {
  HOUSE_ODDS: 'HouseOdds', JACKPOT: 'JackpotInfo', SWARM: 'SwarmShape', CANDY: 'Table<CandyInfo>',
  POWERUPS: 'PowerUps', 'PowerUps.rain': 'RainPower', 'PowerUps.shield': 'PowerUpInfo', 'PowerUps.magnet': 'MagnetPower', 'PowerUps.double': 'PowerUpInfo',
  GEMS: 'Table<GemInfo>', MOVE: 'MoveInfo', AUTORUN: 'AutorunInfo', MONSTERS: 'Table<MonsterInfo>', DIFFICULTY: 'Table<Difficulty>',
  'Difficulty.ghost': 'MonsterLevel', 'Difficulty.zombie': 'MonsterLevel', 'Difficulty.swarm': 'SwarmLevel', 'Difficulty.help': 'Help',
  SKILL: 'SkillInfo', 'SkillInfo.boo': 'BooSkill', 'SkillInfo.dodge': 'DodgeSkill', 'SkillInfo.smell': 'SmellSkill', 'SkillInfo.sneak': 'SneakSkill',
  TREAT_MIX: 'Weights', CANDY_MADNESS_WEIGHTS: 'Weights', RAIN_MIX: 'Weights',
  NIGHTS: 'Night[]', NIGHT_RULES: 'Difficulty[]',
  HOUSES: 'House[]', 'House.door': 'Door', 'House.tower': 'Tower', COLLIDERS: 'Collider[]', SPAWNS: 'Spawn[]', PATROLS: 'Patrols',
  CEMETERY: 'Cemetery',
  // the panels (src/dev/lens-ui.js: the Spectacles Lens's, drawn into ui.glb)
  UI: 'Table<UiPanel>', 'UiPanel.items': 'UiItem[]', 'UiPanel.texts': 'UiText[]', 'UiItem.text': 'UiTextStyle', UI_COLORS: 'UiColors',
};

const pascal = (k) => k[0].toUpperCase() + k.slice(1);
const num = (v) => {
  if (v === Infinity) return 'double.PositiveInfinity';
  if (v === -Infinity) return 'double.NegativeInfinity';
  if (!Number.isFinite(v)) throw new Error(`not a number: ${v}`);
  return `${Object.is(v, -0) ? '-0' : String(v)}d`; // (String(v): the shortest that reads back as the same double)
};
const str = (s) => JSON.stringify(s);
const classes = new Map(); // name → Map(key → { type, missing })

function infer(v, at) {
  if (typeof v === 'number') return 'double';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'boolean') return 'bool';
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'number')) return 'double[]';
    if (v.every((x) => typeof x === 'string')) return 'string[]';
    if (v.every((x) => Array.isArray(x) && x.every((y) => typeof y === 'number'))) return 'double[][]';
    if (v.every((x) => Array.isArray(x) && x.every((y) => Array.isArray(y)))) return 'double[][][]';
  }
  throw new Error(`${at}: no C# type for ${JSON.stringify(v).slice(0, 80)} (add it to SCHEMA)`);
}

/** The C# expression for value `v` of type `type`; classes are collected on the way. */
function value(v, type, at) {
  if (v === undefined || v === null) return 'null';
  if (type === 'double') return num(v);
  if (type === 'string') return str(v);
  if (type === 'bool') return v ? 'true' : 'false';
  if (type === 'double[]') return `new double[] { ${v.map(num).join(', ')} }`;
  if (type === 'string[]') return `new string[] { ${v.map(str).join(', ')} }`;
  if (type === 'double[][]') return `new double[][] { ${v.map((x) => value(x, 'double[]', at)).join(', ')} }`;
  if (type === 'double[][][]') return `new double[][][] {\n      ${v.map((x) => value(x, 'double[][]', at)).join(',\n      ')} }`;
  if (type === 'Weights') return `new Weights(${Object.entries(v).map(([k, w]) => `(${str(k)}, ${num(w)})`).join(', ')})`;
  let m = type.match(/^Table<(\w+)>$/);
  if (m) return `new Table<${m[1]}>(\n    ${Object.entries(v).map(([k, x]) => `(${str(k)}, ${value(x, m[1], `${at}.${k}`)})`).join(',\n    ')})`;
  m = type.match(/^(\w+)\[\]$/);
  if (m) return `new ${m[1]}[] {\n    ${v.map((x, i) => value(x, m[1], `${at}[${i}]`)).join(',\n    ')} }`;
  // a class
  if (!classes.has(type)) classes.set(type, { fields: new Map(), seen: 0 });
  const cls = classes.get(type);
  cls.seen++;
  const parts = [];
  for (const [k, x] of Object.entries(v)) {
    if (x === undefined) continue;
    const t = SCHEMA[`${type}.${k}`] || infer(x, `${at}.${k}`);
    const f = cls.fields.get(k) || { type: t, count: 0 };
    if (f.type !== t) throw new Error(`${at}.${k}: ${t}, but ${type}.${k} was ${f.type} before`);
    f.count++;
    cls.fields.set(k, f);
    parts.push(`${pascal(k)} = ${value(x, t, `${at}.${k}`)}`);
  }
  return `new ${type} { ${parts.join(', ')} }`;
}

const VALUE_TYPES = new Set(['double', 'bool']);
// (classes whose missing numbers are just 0: a circle collider has no hx, a box no r)
const PLAIN = new Set(['Collider']);
function classDefs() {
  let s = '';
  for (const [name, { fields, seen }] of classes) {
    s += `  public sealed partial class ${name} {\n`;
    for (const [k, { type, count }] of fields) {
      const opt = count < seen && VALUE_TYPES.has(type) && !PLAIN.has(name) ? '?' : '';
      s += `    public ${type}${opt} ${pascal(k)};\n`;
    }
    s += '  }\n';
  }
  return s;
}

/** A static class of constants and read-only values. */
function block(name, entries) {
  let s = `  public static partial class ${name} {\n`;
  for (const [k, v] of entries) {
    const type = SCHEMA[k] || infer(v, k);
    if (type === 'double' || type === 'string') s += `    public const ${type} ${k} = ${value(v, type, k)};\n`;
    else s += `    public static readonly ${type} ${k} = ${value(v, type, k)};\n`;
  }
  return s + '  }\n';
}

/** The panels' layout (centimetres) as C#: the same boxes ui.glb's plates were drawn for. */
export function uiCs(header) {
  classes.clear();
  const ui = block('UiLayout', [['UI_PX', U.UI_PX], ['UI_PAD', U.UI_PAD], ['NIGHT_COUNT', U.NIGHT_COUNT], ['COSTUME_IDS', U.COSTUME_IDS], ['UI', U.UI], ['UI_COLORS', U.UI_COLORS]]);
  return `${header}// ReSharper disable All\n#pragma warning disable\nnamespace TrickOrTreat.Rules {\n${ui}\n${classDefs()}}\n`;
}

export function rulesCs(header) {
  classes.clear();
  // Config: everything config.js exports but its functions; a night's rules come ready-made (nightRules).
  const conf = Object.entries(C).filter(([, v]) => typeof v !== 'function').map(([k, v]) => {
    if (k === 'NIGHTS') return [k, v.map((n) => ({ base: n.base, skill: n.skill, stars: n.stars, rob: n.rob }))];
    return [k, v];
  });
  conf.push(['NIGHT_RULES', C.NIGHTS.map((_, i) => C.nightRules(i))]);
  // Layout: what the rules and the placing of things need (the models come with the village's own glb).
  const houses = L.HOUSES.map((h) => ({ id: h.id, name: h.name, x: h.x, z: h.z, yaw: h.yaw, angle: h.angle, w: h.w, d: h.d, height: h.height, door: h.door, tower: h.tower || undefined }));
  const lay = [
    ['MAP_R', L.MAP_R], ['PLAZA_R', L.PLAZA_R], ['TOWER_R', L.TOWER_R], ['PLAYER_R', L.PLAYER_R], ['DOOR_RANGE', L.DOOR_RANGE], ['RING_W', L.RING_W],
    ['CEMETERY', L.CEMETERY], ['HOUSES', houses], ['COLLIDERS', L.COLLIDERS], ['CANDY_SPOTS', L.CANDY_SPOTS], ['ORB_SPOTS', L.ORB_SPOTS],
    ['SPAWNS', L.SPAWNS], ['PATROLS', L.PATROLS],
  ];
  const conf2 = block('Config', conf), lay2 = block('Layout', lay);
  return `${header}// ReSharper disable All\n#pragma warning disable\nnamespace TrickOrTreat.Rules {\n${conf2}\n${lay2}\n${classDefs()}}\n`;
}
