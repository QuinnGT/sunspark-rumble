// Docks reference-scene art direction. Root integration applies these values to
// the existing sun, hemisphere, renderer and PMREM environment without new lights.
export const DOCKS_LIGHTING = Object.freeze({
  exposure: 1.0, sunColor: 0xffedce, sunIntensity: 2.35,
  skyColor: 0xc7dfff, groundColor: 0x84916f, hemisphereIntensity: .68,
  environmentIntensity: .32,
});
export const DOCKS_CLOUD_BANKS = Object.freeze([
  [10, 57, -195, 74, 53], [-115, 67, -164, 88, 60], [150, 61, -146, 69, 52],
  [-195, 62, -37, 76, 51], [201, 53, 28, 64, 44], [-146, 66, 143, 91, 62],
  [6, 57, 205, 71, 52], [155, 71, 146, 83, 57], [-196, 73, 90, 73, 54],
].map(bank => Object.freeze(bank)));
export function configureDocksClouds(clouds) {
  clouds.forEach((group, i) => {
    const [x, y, z, width, height] = DOCKS_CLOUD_BANKS[i % DOCKS_CLOUD_BANKS.length]; group.position.set(x, y, z);
    for (const cloud of group.children) if (cloud.isSprite) cloud.scale.set(width, height, 1);
  });
}
