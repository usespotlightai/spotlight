import type { RunInput, RunInputPort } from '@application/ports/run-input.port';
import { Injectable } from '@nestjs/common';

type Waiting = {
  readonly deliver: (input: RunInput[]) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

@Injectable()
// Held in this process, so this only works with one control plane.
export class InMemoryRunInput implements RunInputPort {
  private readonly pending = new Map<string, RunInput[]>();
  private readonly waiting = new Map<string, Waiting>();

  offer(runId: string, input: RunInput): void {
    const collector = this.waiting.get(runId);
    if (collector) {
      this.waiting.delete(runId);
      clearTimeout(collector.timer);
      collector.deliver([input]);
      return;
    }

    this.pending.set(runId, [...(this.pending.get(runId) ?? []), input]);
  }

  take(runId: string, timeoutMs: number): Promise<RunInput[]> {
    const parked = this.pending.get(runId);
    if (parked?.length) {
      this.pending.delete(runId);
      return Promise.resolve(parked);
    }

    const previous = this.waiting.get(runId);
    if (previous) {
      this.waiting.delete(runId);
      clearTimeout(previous.timer);
      previous.deliver([]);
    }

    return new Promise<RunInput[]>((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(runId);
        resolve([]);
      }, timeoutMs);

      this.waiting.set(runId, { deliver: resolve, timer });
    });
  }
}
