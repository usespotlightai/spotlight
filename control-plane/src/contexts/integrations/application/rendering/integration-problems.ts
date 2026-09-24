import type { IntegrationHostFixedError } from '@integrations/domain/exceptions/integration-host-fixed.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const INTEGRATIONS = 'integrations';

export const integrationAt = (source: string): string =>
  `${INTEGRATIONS}/${source}`;

export const IntegrationProblems = {
  hostFixed(error: IntegrationHostFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: integrationAt(error.source),
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },
};
