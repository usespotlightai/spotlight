import { SetMetadata } from '@nestjs/common';

export const RUNNER_ONLY = Symbol('RUNNER_ONLY');

export const RunnerOnly = () => SetMetadata(RUNNER_ONLY, true);
