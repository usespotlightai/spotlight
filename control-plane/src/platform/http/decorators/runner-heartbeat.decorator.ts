import { SetMetadata } from '@nestjs/common';

export const RUNNER_HEARTBEAT = Symbol('RUNNER_HEARTBEAT');

export const RecordsRunnerHeartbeat = () => SetMetadata(RUNNER_HEARTBEAT, true);
