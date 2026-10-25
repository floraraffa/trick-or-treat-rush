// Downloads the CC0 photo textures from Poly Haven (polyhaven.com, public domain) and writes small
// WebP files the game loads: public/assets/tex/<name>.webp (colour) and <name>_n.webp (normal map).
//   NODE_USE_ENV_PROXY=1 node tools/fetch-textures.mjs [name ...]   (no names: all of them)
//   ... --lens   the larger set for the Spectacles Lens (25 MB budget), in tools/lens-studio/tex: the photos at
//                up to 2048 px and every normal map at 1024 (the Lens export reads them from there)
// The village tints every surface by vertex colour, so each photo is partly desaturated and brought to
// the brightness its stand-in had; the hue comes from the palette, the relief from the photo and its normals.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

// game name: [Poly Haven id, colour size, normal size, colour quality, saturation kept, mean grey (0..255)]
export const TEXTURES = {
  // Sizes are held down by the 8 MB budget, which Snap counts unzipped.
  grass: ['leafy_grass', 1024, 1024, 72], // the ground everywhere: the most seen surface
  dirt: ['forest_ground_04', 768, 512, 70],
  rock: ['rock_04', 512, 512],
  bark: ['pine_bark', 512, 512],
  siding: ['weathered_plank_siding', 768, 512, 75, 0.45, 150], // house walls, shutters, fences
  slates: ['roof_slates_03', 1024, 512, 72, 0.5, 165], // every roof and the door canopies
  cobbles: ['mossy_cobblestone', 1024, 1024, 70, 0.8, 120], // the streets
  flags: ['stone_tiles_02', 768, 512, 72, 0.5, 140], // the plaza and the door steps
  masonry: ['rustic_stone_wall', 768, 512, 72, 0.45, 125], // foundations, chimneys, the mausoleum, the tower base
  velvet: ['velour_velvet', 512, 512, 72, 0, 170], // costumes: the vampire's cape and collar, the witch's hat (satin is just gloss)
};

const api = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
const get = async (url) => Buffer.from(await (await fetch(url)).arrayBuffer());
const mean = async (img) => (await img.clone().stats()).channels.slice(0, 3).map((c) => c.mean);

const AO_K = 0.8; // how much of the AO map goes into the colour
const NQ = 60; // normal map quality: a little noise in a normal map is invisible, and it keeps the zip small

// The Lens's sizes: the ground and the streets (seen up close in first person) at 2048, the rest at 1024.
const LENS = { grass: [2048, 1024], cobbles: [2048, 1024], dirt: [1024, 1024], rock: [1024, 1024], bark: [1024, 1024], siding: [1024, 1024], slates: [1024, 1024], flags: [1024, 1024], masonry: [1024, 1024] };

const lens = process.argv.includes('--lens');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const out = lens ? 'tools/lens-studio/tex' : 'public/assets/tex';
mkdirSync(out, { recursive: true });
for (const [name, conf] of Object.entries(TEXTURES)) {
  if (only.length && !only.includes(name)) continue;
  if (lens && !LENS[name]) continue;
  const [id, size0, nsize0, q0 = 80, sat = 1, grey = 0] = conf;
  const [size, nsize, q] = lens ? [...LENS[name], 88] : [size0, nsize0, q0];
  const files = await api(id);
  const res = files.Diffuse['2k'] && size > 1024 ? '2k' : '1k';
  const diff = await get(files.Diffuse[res].jpg.url);
  const nrm = await get(files.nor_gl[nsize > 1024 ? '2k' : '1k'].jpg.url);
  // Ambient occlusion baked into the colour: hollows and cracks darken, so the surface reads with depth.
  const ao = files.AO ? await sharp(await get(files.AO['1k'].jpg.url)).resize(size, size).greyscale().linear(AO_K, 255 * (1 - AO_K)).toBuffer() : null;
  let img = sharp(diff).resize(size, size);
  if (ao) { // then restore the photo's average brightness, so only the relief changes
    const before = await mean(img);
    img = sharp(await img.composite([{ input: ao, blend: 'multiply' }]).toBuffer());
    const after = await mean(img);
    img = sharp(await img.linear(before.map((v, i) => v / after[i]), [0, 0, 0]).toBuffer());
  }
  if (sat !== 1) img = sharp(await img.modulate({ saturation: sat }).toBuffer());
  if (grey) { // the brightness the palette was tuned on
    const m = await mean(img), k = grey / ((m[0] + m[1] + m[2]) / 3);
    img = sharp(await img.linear([k, k, k], [0, 0, 0]).toBuffer());
  }
  const avg = (await mean(img)).map((v) => Math.round(Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  const a = await img.webp({ quality: q }).toBuffer();
  const b = await sharp(nrm).resize(nsize, nsize).webp({ quality: lens ? 85 : NQ }).toBuffer();
  writeFileSync(`${out}/${name}.webp`, a);
  writeFileSync(`${out}/${name}_n.webp`, b);
  console.log(`${name.padEnd(9)} ${id.padEnd(24)} ${(a.length / 1024).toFixed(0).padStart(4)} KB + ${(b.length / 1024).toFixed(0).padStart(4)} KB  average #${avg}`);
}
