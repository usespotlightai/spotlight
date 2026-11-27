import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const MACHINE_HEARTBEAT = Symbol('MACHINE_HEARTBEAT');

export const RecordsMachineHeartbeat = (): CustomDecorator<symbol> =>
  SetMetadata(MACHINE_HEARTBEAT, true);
