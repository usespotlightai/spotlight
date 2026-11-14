export const INFERENCE_TRANSPORT = Symbol('INFERENCE_TRANSPORT');

export interface ProbedEndpoint {
  readonly baseUrl: string;
  readonly model: string;
  readonly supportsReasoningEffort: boolean;
  readonly apiKey: string | undefined;
}

export interface ProbeResult {
  readonly ok: boolean;
  readonly message: string;
}

export interface InferenceTransportPort {
  refusalOf(workspaceId: string, baseUrl: string): Promise<string | null>;

  probe(workspaceId: string, endpoint: ProbedEndpoint): Promise<ProbeResult>;
}
