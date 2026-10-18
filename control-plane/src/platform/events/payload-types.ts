import { Injectable } from '@nestjs/common';

export type EventType = { readonly name: string; readonly prototype: object };

@Injectable()
export class PayloadTypes {
  readonly #named = new Map<string, EventType>();
  readonly #names = new Map<EventType, string>();

  register(scope: string, types: readonly EventType[]): void {
    for (const type of types) {
      const name = `${scope}.${type.name}`;
      const existing = this.#named.get(name);

      if (existing && existing !== type) {
        throw new Error(
          `Two event types in ${scope} are both called ${type.name}; give one another name`,
        );
      }

      this.#named.set(name, type);
      this.#names.set(type, name);
    }
  }

  named(name: string): EventType | null {
    return this.#named.get(name) ?? null;
  }

  nameOf(type: EventType): string | null {
    return this.#names.get(type) ?? null;
  }
}
