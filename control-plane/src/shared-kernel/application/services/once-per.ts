export class OncePer {
  readonly #noted = new Map<string, number>();

  constructor(private readonly windowMs: number) {}

  due(key: string, now: Date): boolean {
    const at = now.getTime();
    const noted = this.#noted.get(key);

    if (noted !== undefined && at - noted < this.windowMs) {
      return false;
    }

    for (const [each, when] of this.#noted) {
      if (at - when >= this.windowMs) {
        this.#noted.delete(each);
      }
    }
    this.#noted.set(key, at);

    return true;
  }
}
