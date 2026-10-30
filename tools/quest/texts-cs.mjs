// The game's texts (src/ui/i18n.js, en / es / fr / de) as C# for the Meta Quest version: one flat table per
// language, nested keys joined by dots ("lens.skills.boo"), a list's items numbered ("tips.0"). Texts.T()
// there looks a key up in the player's language, then in English, as t() does here.
import { LANGS, STRINGS } from '../../src/ui/i18n.js';

function flat(o, prefix, out) {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix + k;
    if (typeof v === 'string') out.push([key, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'string' ? out.push([`${key}.${i}`, x]) : flat({ [i]: x }, `${key}.`, out)));
    else if (v && typeof v === 'object') flat(v, `${key}.`, out);
  }
  return out;
}

export function textsCs(header) {
  const str = (s) => JSON.stringify(s); // (a JSON string is a valid C# regular string literal for these texts)
  let s = `${header}// ReSharper disable All\n#pragma warning disable\nusing System.Collections.Generic;\n\nnamespace TrickOrTreat.Rules {\n  public static partial class Texts {\n`;
  s += `    public static readonly (string code, string name)[] LANGS = { ${Object.entries(LANGS).map(([k, v]) => `(${str(k)}, ${str(v)})`).join(', ')} };\n`;
  s += '    public static readonly Dictionary<string, Dictionary<string, string>> STRINGS = new Dictionary<string, Dictionary<string, string>> {\n';
  for (const code of Object.keys(LANGS)) {
    s += `      [${str(code)}] = new Dictionary<string, string> {\n`;
    for (const [k, v] of flat(STRINGS[code], '', [])) s += `        [${str(k)}] = ${str(v)},\n`;
    s += '      },\n';
  }
  return s + '    };\n  }\n}\n';
}
