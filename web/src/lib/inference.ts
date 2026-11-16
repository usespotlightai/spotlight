import type {
  ConnectionTestResponseDto,
  InferenceEndpointResourceResponseDto,
} from '@/lib/api';

export type InferenceEndpoint = InferenceEndpointResourceResponseDto;

export type ConnectionTest = ConnectionTestResponseDto;

export const INFERENCE_ENDPOINT_DOCS = 'reference/terraform/inference-endpoint';

export const INFERENCE_NOTE =
  'The OpenAI-compatible endpoint for change stacks, agent decisions, answer grading and judges.';

export const NO_INFERENCE_ENDPOINT =
  'This workspace has no inference endpoint.';

export const NO_CREDITS = 'Sorry, the inference endpoint has no credits left.';

export const ADD_CREDITS = 'Please add credits at your provider.';

export const hostOf = (baseUrl: string): string => {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
};
