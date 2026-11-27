import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const MACHINE_ONLY = Symbol('MACHINE_ONLY');

export const MachineOnly = (): CustomDecorator<symbol> =>
  SetMetadata(MACHINE_ONLY, true);
