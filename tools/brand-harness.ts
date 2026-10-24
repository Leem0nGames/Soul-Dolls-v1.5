import { readFile } from 'node:fs/promises';
import { BRAND_TOKENS } from '../src/components/ui/BrandKit';

const stylesheet = await readFile('src/index.css', 'utf8');
const cabinet = await readFile('src/components/ui/GameCabinetModal.tsx', 'utf8');
const soulDex = await readFile('src/components/SoulDexModal.tsx', 'utf8');
const buttonSurfaces = [
  ['TopHUD', 'src/components/TopHUD.tsx'],
  ['BagModal', 'src/components/BagModal.tsx'],
  ['PartyModal', 'src/components/PartyModal.tsx'],
  ['ShopModal', 'src/components/ShopModal.tsx'],
  ['EvolutionModal', 'src/components/EvolutionModal.tsx'],
  ['SoulDexModal', 'src/components/SoulDexModal.tsx'],
];
const requiredClasses = [
  '.sd-brand-panel',
  '.sd-brand-button',
  '.sd-brand-button-ki',
  '.sd-brand-button-soul',
  '.sd-brand-button-select',
  ".sd-brand-button-select[aria-pressed='true']",
  '.sd-brand-badge',
  '.sd-cabinet-frame',
  '.sd-ornate-frame',
  '.sd-cabinet-header',
  '.sd-modal-backdrop',
  '.sd-dialog-ornate',
  '.sd-action-btn',
];
const missing: string[] = [];
for (const [token, expectedColor] of Object.entries(BRAND_TOKENS)) {
  const declaration = stylesheet.match(new RegExp(`--sd-${token}:\\s*(#[\\da-f]{6})`, 'i'));
  if (!declaration || declaration[1].toLowerCase() !== expectedColor.toLowerCase()) {
    missing.push(`--sd-${token}=${expectedColor}`);
  }
}
for (const className of requiredClasses) {
  if (!stylesheet.includes(className)) missing.push(className);
}
if (!cabinet.includes('sd-cabinet-frame') || !cabinet.includes('BrandButton')) {
  missing.push('GameCabinetModal brand-kit integration');
}
if (!soulDex.includes('<GameCabinetModal') || !soulDex.includes('<BrandPanel')) {
  missing.push('SoulDex shared modal/panel integration');
}
for (const [name, path] of buttonSurfaces) {
  const source = await readFile(path, 'utf8');
  if (!source.includes("from './ui/BrandKit'") || !source.includes('<BrandButton')) {
    missing.push(`${name} BrandButton integration`);
  }
}

console.log('SoulDolls Brand Harness');
console.log('=======================');
console.log(`Palette: ${Object.entries(BRAND_TOKENS).map(([name, color]) => `${name} ${color}`).join(' · ')}`);
console.log(`UI primitives: ${requiredClasses.length} shared styles · ${buttonSurfaces.length} button surfaces`);

if (missing.length > 0) {
  console.error(`\nMissing brand tokens/styles: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('\nBrand tokens and shared UI primitives are present.');
}
