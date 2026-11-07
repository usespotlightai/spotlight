import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { isJsonValue, sameJson } from '@shared-kernel/domain/json-value';

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

  get denyReason(): string | null {
    if (!this.succeeded || !isRecord(this.body)) {
      return null;
    }

    const { deny } = this.body;

    return typeof deny === 'string' && deny.trim() ? deny.trim() : null;
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
      (isJsonValue(this.body) && isJsonValue(other.body)
        ? sameJson(this.body, other.body)
        : this.body === other.body)
    );
  }
}
