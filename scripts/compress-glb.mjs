import { NodeIO } from '@gltf-transform/core';
import {
  KHRDracoMeshCompression,
  KHRMeshQuantization,
  KHRMaterialsUnlit,
  EXTTextureWebP,
  KHRLightsPunctual,
  KHRTextureTransform,
  KHRMaterialsSpecular,
  KHRMaterialsIOR,
  KHRMaterialsVolume,
  KHRMaterialsTransmission,
  KHRMaterialsClearcoat,
  KHRMaterialsSheen,
  KHRMaterialsIridescence,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsAnisotropy
} from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
import draco3d from 'draco3dgltf';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('1. Initializing NodeIO for SCENE.glb...');
  const dracoDecoder = await draco3d.createDecoderModule();
  const dracoEncoder = await draco3d.createEncoderModule();

  const io = new NodeIO()
    .registerExtensions([
      KHRDracoMeshCompression,
      KHRMeshQuantization,
      KHRMaterialsUnlit,
      EXTTextureWebP,
      KHRLightsPunctual,
      KHRTextureTransform,
      KHRMaterialsSpecular,
      KHRMaterialsIOR,
      KHRMaterialsVolume,
      KHRMaterialsTransmission,
      KHRMaterialsClearcoat,
      KHRMaterialsSheen,
      KHRMaterialsIridescence,
      KHRMaterialsEmissiveStrength,
      KHRMaterialsAnisotropy
    ])
    .registerDependencies({
      'draco3d.decoder': dracoDecoder,
      'draco3d.encoder': dracoEncoder,
    });

  const targetGlbPath = path.resolve('public/SCENE.glb');
  const backupGlbPath = path.resolve('public/SCENE_original.glb');

  // 1. If SCENE_original.glb does not exist yet, copy SCENE.glb as backup
  if (!fs.existsSync(backupGlbPath) && fs.existsSync(targetGlbPath)) {
    fs.copyFileSync(targetGlbPath, backupGlbPath);
    console.log(`✓ Created backup GLB at "${backupGlbPath}".`);
  }

  // 2. If a new Blender export (> 15MB) is saved to SCENE.glb, update the backup file
  if (fs.existsSync(targetGlbPath)) {
    const targetSize = fs.statSync(targetGlbPath).size;
    if (targetSize > 15 * 1024 * 1024) {
      fs.copyFileSync(targetGlbPath, backupGlbPath);
      console.log(`✓ Updated raw backup file (${(targetSize / 1024 / 1024).toFixed(2)} MB) at "${backupGlbPath}".`);
    }
  }

  // Read from backupGlbPath if available, otherwise targetGlbPath
  const sourcePath = fs.existsSync(backupGlbPath) ? backupGlbPath : targetGlbPath;

  console.log(`2. Reading input GLB "${sourcePath}"...`);
  const document = await io.read(sourcePath);

  console.log('3. Resizing and converting image textures with Sharp (WebP 82% quality, max 2048px)...');
  const textures = document.getRoot().listTextures();
  console.log(`Found ${textures.length} textures.`);

  let textureIndex = 0;
  for (const texture of textures) {
    textureIndex++;
    const name = texture.getName() || `texture_${textureIndex}`;
    const imageBuffer = texture.getImage();
    if (!imageBuffer || imageBuffer.length === 0) continue;

    try {
      const sharpImage = sharp(imageBuffer);
      const metadata = await sharpImage.metadata();

      let targetWidth = metadata.width;
      let targetHeight = metadata.height;

      // Downscale textures larger than 2048px down to 2048px max
      const MAX_SIZE = 2048;
      if (targetWidth > MAX_SIZE || targetHeight > MAX_SIZE) {
        if (targetWidth >= targetHeight) {
          targetHeight = Math.round((targetHeight * MAX_SIZE) / targetWidth);
          targetWidth = MAX_SIZE;
        } else {
          targetWidth = Math.round((targetWidth * MAX_SIZE) / targetHeight);
          targetHeight = MAX_SIZE;
        }
      }

      // Convert image to webp with 82 quality
      const compressedBuffer = await sharpImage
        .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
        .toFormat('webp', { quality: 82, reductionEffort: 6 })
        .toBuffer();

      texture.setImage(compressedBuffer);
      texture.setMimeType('image/webp');
    } catch (err) {
      console.warn(`  [${textureIndex}/${textures.length}] Warning on ${name}: ${err.message}`);
    }
  }

  console.log('4. Pruning unused nodes, deduplicating accessors and animations...');
  await document.transform(
    prune(),
    dedup(),
    resample()
  );

  console.log(`5. Overwriting "${targetGlbPath}" with compressed model...`);
  const outBuffer = await io.writeBinary(document);
  fs.writeFileSync(targetGlbPath, outBuffer);

  const initialSizeMb = (fs.statSync(sourcePath).size / 1024 / 1024).toFixed(2);
  const finalSizeMb = (outBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`\n🎉 Optimization Complete!`);
  console.log(`Input GLB Size:      ${initialSizeMb} MB`);
  console.log(`Compressed GLB Size: ${finalSizeMb} MB`);
}

main().catch(err => {
  console.error('Error optimizing GLB:', err);
  process.exit(1);
});
