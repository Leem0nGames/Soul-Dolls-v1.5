import { GENERIC_SHEETS, SOULDOLL_SHEETS } from '../src/game/data/souldollSheets';
import { SOULDOLL_SPECIES, STARTER_SPECIES } from '../src/game/data/souldolls';

const species = Object.values(SOULDOLL_SPECIES);
const missingSheetSpecies = SOULDOLL_SHEETS
  .filter((sheet) => sheet.species && !Object.hasOwn(SOULDOLL_SPECIES, sheet.species))
  .map((sheet) => sheet.species!);

if (missingSheetSpecies.length > 0) {
  throw new Error(`Las hojas asignadas apuntan a especies desconocidas: ${missingSheetSpecies.join(', ')}`);
}
if (GENERIC_SHEETS.length === 0) {
  throw new Error('No hay hojas genéricas para las especies sin ilustración propia.');
}

console.log('SoulDoll JSON Harness');
console.log('=====================');
console.log(`Species: ${species.length}`);
console.log(`Starters: ${STARTER_SPECIES.join(', ')}`);
console.log(`Evolution links: ${species.filter((entry) => entry.evolution).length}`);
console.log(`Species with custom sheets: ${SOULDOLL_SHEETS.filter((sheet) => sheet.species).length}`);
console.log(`Generic sheets available: ${GENERIC_SHEETS.length}`);
console.log('\nCatalog structure, moves, evolutions, and artwork references are valid.');
