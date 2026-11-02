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

  texts(name: string): string[] {
    const value = this.values[name];

    return Array.isArray(value)
      ? value.filter((each): each is string => typeof each === 'string')
      : [];
  }

  number(name: string): number | null {
    const value = this.values[name];

    return typeof value === 'number' ? value : null;
  }
}
