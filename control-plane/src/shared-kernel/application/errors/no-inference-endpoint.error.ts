export class NoInferenceEndpointError extends Error {
  constructor() {
    super('No model endpoint is set for this workspace');
    this.name = 'NoInferenceEndpointError';
  }
}
