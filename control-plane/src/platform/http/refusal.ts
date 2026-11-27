import { fieldOf } from '@platform/json/field-of';
export interface Refusal {
  readonly type?: string;
  readonly kind?: string;
  readonly error: string;
}

const REFUSAL = 'refusal';

const isRefusal = (value: unknown): value is Refusal =>
  typeof fieldOf(value, 'error') === 'string';

export function noteRefusal(response: unknown, refusal: Refusal): void {
  if (typeof response !== 'object' || response === null) {
    return;
  }

  const locals = fieldOf(response, 'locals');

  if (typeof locals === 'object' && locals !== null) {
    Reflect.set(locals, REFUSAL, refusal);
  } else {
    Reflect.set(response, 'locals', { [REFUSAL]: refusal });
  }
}

export function refusalOf(response: unknown): Refusal | undefined {
  const refusal = fieldOf(fieldOf(response, 'locals'), REFUSAL);

  return isRefusal(refusal) ? refusal : undefined;
}
