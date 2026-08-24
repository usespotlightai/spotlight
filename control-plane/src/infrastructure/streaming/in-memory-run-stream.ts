import type {
  RunEventView,
  RunStreamPort,
} from '@application/ports/run-stream.port';
import { Injectable } from '@nestjs/common';

@Injectable()
// Held in this process, so fan-out only works with one control plane.
export class InMemoryRunStream implements RunStreamPort {
  private readonly watchers = new Map<
    string,
    Set<(event: RunEventView) => void>
  >();

  publish(runId: string, events: readonly RunEventView[]): void {
    const listeners = this.watchers.get(runId);
    if (!listeners) {
      return;
    }

    for (const event of events) {
      for (const listener of [...listeners]) {
        listener(event);
      }
    }
  }

  subscribe(
    runId: string,
    listener: (event: RunEventView) => void,
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
