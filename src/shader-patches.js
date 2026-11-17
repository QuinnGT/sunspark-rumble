import { REVISION } from 'three';

// These patches are reviewed against the pinned Three.js release. A library
// update must deliberately revalidate shader chunks instead of silently losing art.
export const SHADER_REVISION = '180';
const applied = new Map(), failures = [];
export function assertShaderRevision(revision = REVISION) {
  if (revision !== SHADER_REVISION) throw new Error(`Shader pipeline expects Three.js r${SHADER_REVISION}, received r${revision}. Revalidate shader patches before upgrading.`);
}
export function patchShader(source, search, replacement, label, { count = 1 } = {}) {
  assertShaderRevision();
  if (typeof source !== 'string' || typeof search !== 'string' || !search || typeof replacement !== 'string') throw new TypeError('Shader patches require nonempty string search and string source/replacement.');
  const found = source.split(search).length - 1;
  if (found !== count) {
    const message = `Shader patch ${label}: expected ${count} occurrence(s), found ${found}.`;
    failures.push(message); if (failures.length > 16) failures.shift();
    throw new Error(message);
  }
  applied.set(label, (applied.get(label) || 0) + 1);
  return source.split(search).join(replacement);
}
export function shaderDiagnostics() { return { revision: REVISION, expectedRevision: SHADER_REVISION, applied: Object.fromEntries(applied), failures: [...failures] }; }
