import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const INTEGRATIONS = 'integrations';

export const integrationAt = (source: string): string =>
  `${INTEGRATIONS}/${source}`;

export const IntegrationProblems = {
  immutableField(
    source: string,
    error: ImmutableFieldError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: integrationAt(source),
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
