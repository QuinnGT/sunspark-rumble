// Explicit shared ownership for GPU resources. Releasing one asset cannot dispose
// a texture still retained by a second asset or the cache.
const references = new WeakMap();
export class ResourceScope {
  constructor(name = 'resources') { this.name = name; this.resources = new Set(); this.disposed = false; }
  retain(resource) {
    if (!resource?.dispose) return resource;
    if (this.disposed) throw new Error(`Resource scope ${this.name} is already disposed.`);
    if (!this.resources.has(resource)) { this.resources.add(resource); references.set(resource, (references.get(resource) || 0) + 1); }
    return resource;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources) {
      const remaining = (references.get(resource) || 1) - 1;
      if (remaining) references.set(resource, remaining);
      else { references.delete(resource); resource.dispose(); }
    }
    this.resources.clear();
  }
}

// Collect shared geometries/materials once. Attachments belong to their render
// targets and cached textures belong to their cache, not to borrowing materials.
export function captureSceneResources(scene, scope, { externalTextures = new Set(), skipRoots = new Set() } = {}) {
  const texture = value => { if (value?.isTexture && !value.isRenderTargetTexture && !externalTextures.has(value)) scope.retain(value); };
  const material = value => {
    if (!value) return;
    for (const m of Array.isArray(value) ? value : [value]) {
      scope.retain(m);
      for (const v of Object.values(m)) texture(v);
      for (const u of Object.values(m.uniforms || {})) { if (Array.isArray(u.value)) u.value.forEach(texture); else texture(u.value); }
    }
  };
  const visit=o=>{if(skipRoots.has(o))return;if(o.isInstancedMesh)scope.retain(o);scope.retain(o.geometry);material(o.material);material(o.customDepthMaterial);material(o.customDistanceMaterial);for(const child of o.children||[])visit(child);};visit(scene);
  texture(scene.environment); texture(scene.background);
  return scope;
}
