// Génère les icônes PWA à partir du logo. Usage : node scripts/icons.mjs
import sharp from 'sharp'

const mark = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect x="140" y="104" width="60" height="304" rx="30" fill="#fff"/>
    <circle cx="276" cy="302" r="76" fill="none" stroke="#fff" stroke-width="60"/>
    <circle cx="276" cy="302" r="30" fill="#FFB199"/>
  </g>`
const svg = (rx, scale) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rx}" fill="#5F62DD"/>${mark(scale)}</svg>`)

await sharp(svg(116, 1)).resize(192).png().toFile('public/icon-192.png')
await sharp(svg(116, 1)).resize(512).png().toFile('public/icon-512.png')
await sharp(svg(0, 0.72)).resize(512).png().toFile('public/icon-maskable-512.png')
await sharp(svg(0, 0.86)).resize(180).png().toFile('public/apple-touch-icon.png')
console.log('Icônes générées.')
