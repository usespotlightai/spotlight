import { Injectable } from '@nestjs/common';
import type {
  RunJournalEntryView,
  RunStreamPort,
} from '@runs/application/ports/run-stream.port';

@Injectable()
export class InMemoryRunStream implements RunStreamPort {
  private readonly watchers = new Map<
    string,
    Set<(event: RunJournalEntryView) => void>
  >();

  publish(runId: string, events: readonly RunJournalEntryView[]): void {
    const listeners = this.watchers.get(runId);
    if (!listeners) {
      return;
    }

    for (const event of events) {
      for (const listener of Array.from(listeners)) {
        listener(event);
      }
    }
  }

  subscribe(
    runId: string,
    listener: (event: RunJournalEntryView) => void,
  ): () => void {
    const listeners = this.watchers.get(runId) ?? new Set();
    listeners.add(listener);
    this.watchers.set(runId, listeners);

    return () => {
      const attached = this.watchers.get(runId);
      if (!attached) {
        return;
      }

      attached.delete(listener);

      if (attached.size === 0) {
        this.watchers.delete(runId);
      }
    };
  }
}
