import type { JsonValue } from '@shared-kernel/domain/services/json-value';

export class ToolInputs {
  private constructor(readonly values: Readonly<Record<string, JsonValue>>) {}

  static of(values: Readonly<Record<string, JsonValue>>): ToolInputs {
    return new ToolInputs({ ...values });
  }

  text(name: string): string | null {
    const value = this.values[name];

    return typeof value === 'string' ? value : null;
  }

  number(name: string): number | null {
    const value = this.values[name];

    return typeof value === 'number' ? value : null;
  }
}
