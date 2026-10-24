import sharp from 'sharp';
import { resolve } from 'node:path';

const NPC_SPRITES = ['tyler', 'vesper', 'merchant', 'iris', 'mother'] as const;
const FRAME_WIDTH = 96;
const FRAME_HEIGHT = 128;
const assetsDir = resolve('public/assets/npcs');

async function main(): Promise<void> {
  const frames = await Promise.all(
    NPC_SPRITES.map(async (name, index) => {
      const path = resolve(assetsDir, `${name}.png`);
      const metadata = await sharp(path).metadata();
      if (metadata.width !== FRAME_WIDTH || metadata.height !== FRAME_HEIGHT || !metadata.hasAlpha) {
        throw new Error(`${path} must be a ${FRAME_WIDTH}x${FRAME_HEIGHT} transparent PNG`);
      }
      return {
        input: await sharp(path).png().toBuffer(),
        left: index * FRAME_WIDTH,
        top: 0,
      };
    })
  );

  await sharp({
    create: {
      width: FRAME_WIDTH * NPC_SPRITES.length,
      height: FRAME_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(frames)
    .png()
    .toFile(resolve(assetsDir, 'npc-atlas.png'));

  console.log(`Baked ${NPC_SPRITES.length} NPC frames to public/assets/npcs/npc-atlas.png`);
}

main().catch((error: unknown) => {
  console.error('Could not bake the NPC sprite atlas:', error);
  process.exitCode = 1;
});
