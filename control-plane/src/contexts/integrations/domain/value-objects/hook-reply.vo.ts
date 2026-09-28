import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';

const isRecord = (body: unknown): body is Readonly<Record<string, unknown>> =>
  typeof body === 'object' && body !== null && !Array.isArray(body);

export class HookReply {
  private constructor(
    readonly status: number | null,
    readonly body: unknown,
  ) {}

  static answered(status: number, body: unknown): HookReply {
    return new HookReply(status, body);
  }

  static unanswered(): HookReply {
    return new HookReply(null, null);
  }

  get succeeded(): boolean {
    return this.status !== null && this.status >= 200 && this.status < 300;
  }

  get refusal(): string | null {
    if (!this.succeeded || !isRecord(this.body)) {
      return null;
    }

    const { refuse } = this.body;

    return typeof refuse === 'string' && refuse.trim() ? refuse.trim() : null;
  }

  failure(reason: string): HookFailure | null {
    if (this.succeeded) {
      return null;
    }

    return this.status === null
      ? HookFailure.of('unreachable', reason)
      : HookFailure.answered(this.status, reason);
  }

  equals(other: HookReply): boolean {
    return (
      this.status === other.status &&
      JSON.stringify(this.body) === JSON.stringify(other.body)
    );
  }
}
