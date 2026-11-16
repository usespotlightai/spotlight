export interface ReasoningEffortSubject {
  readonly owner: string;
  readonly revision: string;
}

interface Known {
  readonly revision: string;
  readonly supported: boolean;
}

const CAPACITY = 1_000;

export class ReasoningEffortSupport {
  private readonly known = new Map<string, Known>();

  constructor(private readonly capacity = CAPACITY) {}

  of(subject: ReasoningEffortSubject): boolean | null {
    const known = this.known.get(subject.owner);

    return known?.revision === subject.revision ? known.supported : null;
  }

  remember(subject: ReasoningEffortSubject, supported: boolean): void {
    this.known.delete(subject.owner);

    if (this.known.size >= this.capacity) {
      const [oldest] = this.known.keys();

      if (oldest !== undefined) {
        this.known.delete(oldest);
      }
    }

    this.known.set(subject.owner, { revision: subject.revision, supported });
  }
}
