export class InvalidAssemblyLineNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`An assembly line name ${reason}`);
    this.name = 'InvalidAssemblyLineNameError';
  }
}
