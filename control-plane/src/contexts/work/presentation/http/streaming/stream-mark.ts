import { isControlPlaneEntry } from '@work/application/contracts/run-journal.contract';
import type { RunEventView } from '@work/application/ports/run-stream.port';

const counted = (raw: string | undefined): number | null => {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export interface StreamCursor {
  readonly attempt: number;
  readonly seq: number;
}

export const cursorOf = (
  raw: string | undefined,
  attempt: number,
): StreamCursor => {
  const [first, second] = (raw ?? '').split(':');
  const seq = counted(second === undefined ? first : second) ?? 0;
  const at = second === undefined ? attempt : (counted(first) ?? 0);

  return at === attempt ? { attempt, seq } : { attempt, seq: 0 };
};

export const eventIdOf = (event: RunEventView): string | undefined =>
  isControlPlaneEntry(event.seq) ? undefined : `${event.attempt}:${event.seq}`;

export class StreamMark {
  private attempt: number;
  private sent: number;
  private readonly sentControlPlaneEntries = new Set<number>();

  constructor(from: StreamCursor) {
    this.attempt = from.attempt;
    this.sent = from.seq;
  }

  accepts(event: RunEventView): boolean {
    if (event.attempt < this.attempt) {
      return false;
    }

    if (event.attempt > this.attempt) {
      this.attempt = event.attempt;
      this.sent = 0;
      this.sentControlPlaneEntries.clear();
    }

    if (isControlPlaneEntry(event.seq)) {
      if (this.sentControlPlaneEntries.has(event.seq)) {
        return false;
      }

      this.sentControlPlaneEntries.add(event.seq);
      return true;
    }

    if (event.seq <= this.sent) {
      return false;
    }

    this.sent = event.seq;
    return true;
  }
}
