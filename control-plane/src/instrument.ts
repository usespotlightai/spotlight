import { sentryOptions } from '@platform/errors/sentry-options';
import { startOpenTelemetry } from '@platform/telemetry/open-telemetry';
import { init } from '@sentry/nestjs';

const openTelemetry = startOpenTelemetry(process.env);
const options = sentryOptions(process.env, { openTelemetry });

if (options) {
  init(options);
}
