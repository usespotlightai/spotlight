import { SetMetadata } from '@nestjs/common';

export const RUNNER_ONLY = Symbol('RUNNER_ONLY');

/**
 * Marks a route as authenticated by the runner enrollment token, not a user
 * session. The two are separate populations: a session never reaches a runner
 * route, and a runner never reaches a user one.
 */
export const RunnerOnly = () => SetMetadata(RUNNER_ONLY, true);
