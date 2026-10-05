/**
 * Turn the photographer's JPEGs into the gallery's WebP files.
 *
 *   npm i --no-save sharp
 *   node scripts/gallery-convert.cjs <folder of JPEGs> src/assets/gallery
 *
 * For each photo in PLAN: a 2000px WebP for the lightbox and an 800px one in
 * thumb/ for grids, named <category>-<nn>.webp in the order listed (best
 * first). src/lib/gallery.ts picks up whatever is there. It refuses to run if
 * PLAN and the folder disagree, so a photo can be neither dropped nor shown
 * twice by accident.
 *
 * The keys are the source file names without .jpg, as they were in the
 * "1. PHOTOS" folder of the shoot's Google Drive.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const SRC = process.argv[2];
const OUT = process.argv[3];
// Category slug -> source files, best first.
const PLAN = {
  exterior: ["# (1)", "P-38", "P-37", "P-36", "P-4", "P-5"],
  pool: ["P-9", "# (9)", "# (10)", "P-11", "P-6", "P-12", "P-20"],
  outdoor: ["P-19", "P-7", "# (8)", "P-2", "P-8", "P-16", "P-17", "P-18", "P-1"],
  living: ["P-13", "# (4)", "P-10", "# (5)", "P-14", "# (11)", "# (12)", "# (13)"],
  dining: ["# (3)"],
  kitchen: ["# (6)", "# (7)"],
  rooms: ["P-24", "P-25", "# (2)", "P-27", "P-26", "P-28", "P-29", "P-30", "P-31"],
  bathrooms: ["P-15", "P-21"],
  seating: ["P-23", "P-22"],
  entrance: ["P-32", "P-34", "P-33", "P-35", "P-39", "P-40"],
  beach: ["P-3", "P-41", "P-42"],
};
const used = Object.values(PLAN).flat();
const all = fs
  .readdirSync(SRC)
  .filter((f) => /\.jpe?g$/i.test(f))
  .map((f) => f.replace(/\.jpg$/i, ""));
const missing = all.filter((f) => !used.includes(f));
const dup = used.filter((f, i) => used.indexOf(f) !== i);
if (missing.length || dup.length || used.length !== all.length) {
  console.error("plan mismatch", { missing, dup, used: used.length, all: all.length });
  process.exit(1);
}
fs.mkdirSync(path.join(OUT, "thumb"), { recursive: true });
(async () => {
  let total = 0;
  const sizes = [];
  for (const [cat, list] of Object.entries(PLAN)) {
    for (let i = 0; i < list.length; i++) {
      const name = `${cat}-${String(i + 1).padStart(2, "0")}.webp`;
      const src = path.join(SRC, list[i] + ".jpg");
      const full = await sharp(src)
        .rotate()
        .resize({ width: 2000, withoutEnlargement: true })
        .webp({ quality: 78, effort: 5 })
        .toFile(path.join(OUT, name));
      const th = await sharp(src)
        .rotate()
        .resize({ width: 800 })
        .webp({ quality: 70, effort: 5 })
        .toFile(path.join(OUT, "thumb", name));
      total += full.size + th.size;
      sizes.push(
        `${name}\t${list[i]}\t${full.width}x${full.height}\t${Math.round(full.size / 1024)}K\t${Math.round(th.size / 1024)}K`,
      );
    }
  }
  console.log(sizes.join("\n"));
  console.log("files", sizes.length, "total MB", (total / 1e6).toFixed(1));
})();
