/**
 * The chalet's photography, as the Photos page and the home page use it.
 *
 * Every photo exists twice under src/assets/gallery: a 2000px original for
 * the lightbox, and an 800px copy in thumb/ for grids and filmstrips, where
 * the full file would be several times the bytes for no visible difference.
 * Both are WebP, made from the photographer's JPEGs (323 MB for the 55, 12.5
 * MB as WebP) by scripts/gallery-convert.cjs.
 *
 * Files are named <category>-<nn>.webp, nn being the order they are shown
 * in, best first. Adding a photo is adding the two files: the glob picks it
 * up and the category lists it in name order.
 */
const full = import.meta.glob<string>("../assets/gallery/*.webp", {
  eager: true,
  import: "default",
});
const thumbs = import.meta.glob<string>("../assets/gallery/thumb/*.webp", {
  eager: true,
  import: "default",
});

export interface Photo {
  /** For the lightbox. */
  full: string;
  /** For grids and filmstrips. */
  thumb: string;
}

const byName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** The photos of one category, in display order. */
export function photosFor(category: string): Photo[] {
  return Object.keys(full)
    .filter((p) => byName(p).startsWith(`${category}-`))
    .sort()
    .map((p) => {
      const thumb = thumbs[`../assets/gallery/thumb/${byName(p)}`];
      return { full: full[p], thumb: thumb ?? full[p] };
    });
}

/** One named photo, for the places that show a particular shot. */
export function photo(name: string): Photo {
  const p = `../assets/gallery/${name}.webp`;
  if (!full[p]) throw new Error(`No gallery photo called ${name}`);
  return { full: full[p], thumb: thumbs[`../assets/gallery/thumb/${name}.webp`] ?? full[p] };
}
