import { HARNESS_CONNECTED } from '@runs/domain/value-objects/journal-entry-type';
import {
  harnessConnectedOf,
  harnessEventOf,
} from '@runs/infrastructure/journal/harness-events';
import type { Journalled } from '@runs/infrastructure/journal/journalled';

export const CHANGED_PATHS_TYPES = [HARNESS_CONNECTED, 'tool.changed'] as const;

export class ChangedPaths {
  #reading = false;
  #attempt: number | null = null;
  #calls = new Map<string, number>();
  #changes: (readonly string[])[] = [];

  take(
    event: Pick<Journalled, 'type' | 'data'> & { readonly attempt: number },
  ): void {
    if (event.attempt !== this.#attempt) {
      this.#attempt = event.attempt;
      this.#reading = false;
    }
    if (event.type === HARNESS_CONNECTED) {
      this.#reading = harnessConnectedOf(event) !== null;
      return;
    }

    const read = this.#reading ? harnessEventOf(event) : null;
    if (read?.type !== 'tool.changed') {
      return;
    }

    const call = read.data;
    const key = `${event.attempt}\n${call.session ?? ''}\n${call.id}`;
    const at = this.#calls.get(key) ?? this.#changes.push([]) - 1;
    this.#calls.set(key, at);

    if (call.status === 'completed' && call.files) {
      this.#changes[at] = call.files.map((file) => file.path);
    }
  }

  paths(): string[] {
    return this.#changes.flat();
  }
}
