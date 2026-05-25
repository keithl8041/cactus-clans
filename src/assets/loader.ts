import Phaser from 'phaser';
import { assetUrl, type AssetOptions } from './manifest';

/**
 * Load an asset key into a Phaser texture inside a scene's preload().
 *
 * @param scene the Phaser scene (call from inside `preload()`)
 * @param textureKey the Phaser texture key to register
 * @param manifestKey the asset key from the manifest
 * @param opts options passed to the placeholder generator (e.g. colour)
 */
export function loadAsset(
  scene: Phaser.Scene,
  textureKey: string,
  manifestKey: string,
  opts?: AssetOptions,
): void {
  scene.load.image(textureKey, assetUrl(manifestKey, opts));
}
