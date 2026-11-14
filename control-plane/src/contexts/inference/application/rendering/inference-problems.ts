import type { InvalidInferenceEndpointError } from '@inference/domain/exceptions/invalid-inference-endpoint.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const INFERENCE_ENDPOINT = 'inference-endpoint';

export const INFERENCE_KEY_SECRET = 'SPOTLIGHT_INFERENCE_API_KEY';

export const InferenceProblems = {
  invalid(error: InvalidInferenceEndpointError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: INFERENCE_ENDPOINT,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  refused(reason: string): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: INFERENCE_ENDPOINT,
      at: FieldPath.of(['baseUrl']),
      reason: `is not allowed for this workspace. ${reason}`,
    });
  },
};
