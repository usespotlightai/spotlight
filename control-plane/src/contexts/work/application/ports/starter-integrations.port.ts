export const STARTER_INTEGRATIONS = Symbol('STARTER_INTEGRATIONS');

export interface StarterIntegration {
  readonly source: string;
  readonly name: string;
  readonly summary: string;
}

export interface StarterIntegrationsPort {
  all(): readonly StarterIntegration[];
  fileFor(source: string): string | null;
}
