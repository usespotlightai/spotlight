import { Injectable } from '@nestjs/common';

export type ForbiddenText = (
  kind: string,
) => readonly [title: string, detail: string];

@Injectable()
export class ForbiddenActs {
  readonly #texts = new Map<string, ForbiddenText>();

  register(texts: Readonly<Record<string, ForbiddenText>>): void {
    for (const [act, text] of Object.entries(texts)) {
      this.#texts.set(act, text);
    }
  }

  get acts(): readonly string[] {
    return [...this.#texts.keys()];
  }

  textOf(
    act: string,
    kind: string,
  ): readonly [title: string, detail: string] | null {
    return this.#texts.get(act)?.(kind) ?? null;
  }
}
