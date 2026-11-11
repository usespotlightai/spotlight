import { InvalidToolInputsError } from '@integrations/domain/exceptions/invalid-tool-inputs.error';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { type JsonValue, sameJson } from '@shared-kernel/domain/json-value';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

type Values = Readonly<Record<string, JsonValue>>;

const fieldsOf = (written: unknown): Readonly<Record<string, unknown>> =>
  written && typeof written === 'object' && !Array.isArray(written)
    ? (written as Record<string, unknown>)
    : {};

const isUnset = (value: unknown): boolean =>
  value === undefined || value === null || value === '';

export class ToolInputs {
  private constructor(readonly values: Values) {}

  static of(
    provided: ProvidedTool,
    written: unknown,
    defaultFor: (name: string) => unknown,
  ): ToolInputs {
    const fields = fieldsOf(written);
    const values: Record<string, JsonValue> = {};

    for (const name of Object.keys(fields)) {
      if (!provided.inputs.some((input) => input.name === name)) {
        throw new InvalidToolInputsError(
          `${provided.tool.value} takes no input called ${name}`,
        );
      }
    }

    for (const input of provided.inputs) {
      const value = fields[input.name] ?? defaultFor(input.name) ?? undefined;

      if (isUnset(value)) {
        if (input.required) {
          throw new InvalidToolInputsError(
            `${provided.tool.value} needs its ${input.name} input`,
          );
        }

        continue;
      }

      const coerced = input.schema.coerce(value);
      const problem = input.schema.problemWith(coerced);

      if (problem) {
        throw new InvalidToolInputsError(
          `${provided.tool.value} takes ${input.name}, and ${
            problem.at.isRoot
              ? JSON.stringify(coerced)
              : FieldPath.of([input.name, ...problem.at.segments]).rendered
          } ${problem.why}`,
        );
      }

      values[input.name] = coerced as JsonValue;
    }

    return new ToolInputs(values);
  }

  equals(other: ToolInputs): boolean {
    return sameJson(this.values, other.values);
  }
}
