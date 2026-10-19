export interface Refusal {
  readonly type?: string;
  readonly kind?: string;
  readonly error: string;
}

type WithLocals = { locals?: Record<string, unknown> };

const REFUSAL = 'refusal';

export function noteRefusal(response: unknown, refusal: Refusal): void {
  const withLocals = response as WithLocals;

  withLocals.locals ??= {};
  withLocals.locals[REFUSAL] = refusal;
}

export function refusalOf(response: unknown): Refusal | undefined {
  return (response as WithLocals).locals?.[REFUSAL] as Refusal | undefined;
}
