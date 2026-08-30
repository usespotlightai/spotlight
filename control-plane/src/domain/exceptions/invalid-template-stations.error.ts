export class InvalidTemplateStationsError extends Error {
  constructor(reason: string) {
    super(`A template's stations ${reason}`);
    this.name = 'InvalidTemplateStationsError';
  }
}
