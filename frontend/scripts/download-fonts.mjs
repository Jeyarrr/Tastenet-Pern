import fs from "node:fs/promises";
import path from "node:path";

const url =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&family=Quicksand:wght@400;600;700&display=swap";
const response = await fetch(url, {
  headers: {
    "user-agent":
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  },
});
if (!response.ok)
  throw new Error(`Font CSS request failed: ${response.status}`);
const css = await response.text();
const faces = [
  ...css.matchAll(/\/\* latin \*\/\s*@font-face\s*\{[^}]+\}/g),
].map((match) => match[0]);
if (!faces.length) throw new Error("No Latin font faces found");
const dir = path.resolve("public/vendor/fonts");
await fs.mkdir(dir, { recursive: true });
let localCss = faces.join("\n");
const urls = [
  ...new Set(
    [
      ...localCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g),
    ].map((match) => match[1]),
  ),
];
await Promise.all(
  urls.map(async (fontUrl) => {
    const result = await fetch(fontUrl);
    if (!result.ok)
      throw new Error(`Font file request failed: ${result.status}`);
    const name = path.basename(new URL(fontUrl).pathname);
    await fs.writeFile(
      path.join(dir, name),
      new Uint8Array(await result.arrayBuffer()),
    );
  }),
);
for (const fontUrl of urls)
  localCss = localCss.replaceAll(
    fontUrl,
    `/vendor/fonts/${path.basename(new URL(fontUrl).pathname)}`,
  );
await fs.writeFile(
  path.join(dir, "fonts.css"),
  `/* Inter, Poppins and Quicksand; original TasteNet font families. Source: Google Fonts. */\n${localCss}\n`,
);
console.log(`Downloaded ${urls.length} original font files for local serving.`);
