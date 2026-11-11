import { HARNESS_CONNECTED } from '@runs/domain/value-objects/journal-entry-type';
import { diffIn } from '@runs/infrastructure/acp/content';
import {
  type FrameReader,
  frameReaderFor,
} from '@runs/infrastructure/acp/frame-reader';
import type { Journalled } from '@runs/infrastructure/journal/journalled';

export class ChangedPaths {
  #reader: FrameReader | null = frameReaderFor(null);
  #attempt: number | null = null;
  #calls = new Map<string, number>();
  #changes: (string | null)[] = [];

  take(
    event: Pick<Journalled, 'type' | 'message' | 'data'> & {
      readonly attempt: number;
    },
  ): void {
    if (event.attempt !== this.#attempt) {
      this.#attempt = event.attempt;
      this.#reader = frameReaderFor(null);
    }
    if (event.type === HARNESS_CONNECTED) {
      this.#reader = frameReaderFor(event.message);
      return;
    }
    if (event.type !== 'output' || event.message || !event.data) {
      return;
    }

    const update = this.#reader?.read(event.data)?.update;
    const id = update?.toolCallId;

    if (!id) {
      return;
    }

    if (update.sessionUpdate === 'tool_call') {
      this.#calls.set(id, this.#changes.push(null) - 1);
    }

    const at = this.#calls.get(id);
    const diff = diffIn(update.content);

    if (
      update.sessionUpdate === 'tool_call_update' &&
      at !== undefined &&
      diff
    ) {
      this.#changes[at] = diff.path ?? null;
    }
  }

  paths(): string[] {
    return this.#changes.filter((path): path is string => Boolean(path));
  }
}
