import { SetMetadata } from '@nestjs/common';

export const MACHINE_HEARTBEAT = Symbol('MACHINE_HEARTBEAT');

export const RecordsMachineHeartbeat = () =>
  SetMetadata(MACHINE_HEARTBEAT, true);
