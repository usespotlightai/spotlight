import { type Content, diffIn } from '@work/infrastructure/acp/content';
import { decoded } from '@work/infrastructure/journal/journalled';

interface Spoken {
  update?: {
    sessionUpdate?: string;
    toolCallId?: string;
    content?: Content;
  };
}

export class ChangedPaths {
  #calls = new Map<string, number>();
  #changes: (string | null)[] = [];

  take(data: string): void {
    let sent: Spoken;
    try {
      sent = JSON.parse(decoded(data)) as Spoken;
    } catch {
      return;
    }

    const update = sent?.update;
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
