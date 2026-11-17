export class AssetReadiness {
  constructor() { this.pending = new Set(); this.failed = []; }
  track(name, promise) {
    const task = Promise.resolve(promise).catch(error => { this.failed.push({ name, message: String(error?.message || error) }); }).finally(() => this.pending.delete(task));
    this.pending.add(task); return task;
  }
  async ready() {
    while (this.pending.size) await Promise.all([...this.pending]);
    if (this.failed.length) throw new Error(`Assets failed to load: ${this.failed.map(f => f.name).join(', ')}`);
  }
}
