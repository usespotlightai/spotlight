import { SetMetadata } from '@nestjs/common';

export const MACHINE_ONLY = Symbol('MACHINE_ONLY');

export const MachineOnly = () => SetMetadata(MACHINE_ONLY, true);
