export const EGRESS_RUNNERS = Symbol('EGRESS_RUNNERS');

// Tells whether a runner of the workspace can take a run whose secrets egress injects.
export interface EgressRunnerSource {
  anyIn(workspaceId: string): Promise<boolean>;
}

export interface EgressRunnersPort {
  register(source: EgressRunnerSource): void;

  anyIn(workspaceId: string): Promise<boolean>;
}
