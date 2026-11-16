import type {
  InferenceTransportPort,
  ProbedEndpoint,
  ProbeResult,
} from '@inference/application/ports/inference-transport.port';
import { InferenceProblems } from '@inference/application/rendering/inference-problems';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const APPLIED_PROBE_WITHIN_MS = 10_000;

const unprobed = (error: unknown): ProbeResult => ({
  ok: false,
  message: error instanceof Error ? error.message : String(error),
});

export const appliedEndpointWarnings = async (
  transport: InferenceTransportPort,
  workspaceId: string,
  endpoint: () => Promise<ProbedEndpoint>,
): Promise<readonly ConfigurationProblem[]> => {
  const probed = await endpoint()
    .then((each) => transport.probe(workspaceId, each, APPLIED_PROBE_WITHIN_MS))
    .catch(unprobed);

  return probed.ok ? [] : [InferenceProblems.unanswered(probed.message)];
};
