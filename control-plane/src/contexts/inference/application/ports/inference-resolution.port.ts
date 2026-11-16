export const INFERENCE_RESOLUTION = Symbol('INFERENCE_RESOLUTION');

export interface InferenceResolutionPort {
  forget(workspaceId: string): void;
}
