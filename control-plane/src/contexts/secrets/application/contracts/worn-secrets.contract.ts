import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

interface Worn {
  readonly name: string;
  readonly value: string;
}

const WITHHELD = '[secret]';

export class WornSecrets implements Secret {
  readonly #worn: readonly Worn[];

  private constructor(worn: readonly Worn[]) {
    this.#worn = worn;
  }

  static none(): WornSecrets {
    return new WornSecrets([]);
  }

  static of(worn: readonly Worn[]): WornSecrets {
    return new WornSecrets(worn);
  }

  get [SECRET](): true {
    return true;
  }

  get isEmpty(): boolean {
    return this.#worn.length === 0;
  }

  get headerNames(): readonly string[] {
    return this.#worn.map((each) => each.name);
  }

  applyTo(headers: Record<string, string>): void {
    for (const each of this.#worn) {
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === each.name) {
          delete headers[name];
        }
      }

      headers[each.name] = each.value;
    }
  }

  toString(): string {
    return WITHHELD;
  }

  toJSON(): string {
    return WITHHELD;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `WornSecrets ${WITHHELD}`;
  }
}
