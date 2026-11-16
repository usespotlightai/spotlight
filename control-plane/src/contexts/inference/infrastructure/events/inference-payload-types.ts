import { InferenceEndpointCreated } from '@inference/domain/events/inference-endpoint-created.event';
import { InferenceEndpointDeleted } from '@inference/domain/events/inference-endpoint-deleted.event';
import { InferenceEndpointUpdated } from '@inference/domain/events/inference-endpoint-updated.event';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';

export const INFERENCE_PAYLOAD_TYPES = [
  InferenceEndpointId,
  InferenceEndpointCreated,
  InferenceEndpointUpdated,
  InferenceEndpointDeleted,
] as const;
