// Gera os ícones PNG do PWA a partir de icons/icon.svg (requer: npm i -D sharp)
import sharp from "sharp";
for (const size of [192, 512]) {
  await sharp("icons/icon.svg").resize(size, size).png().toFile(`icons/icon-${size}.png`);
  console.log(`✔ icons/icon-${size}.png`);
}
