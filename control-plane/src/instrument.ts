import { sentryOptions } from '@platform/errors/sentry-options';
import { init } from '@sentry/nestjs';

const options = sentryOptions(process.env);

if (options) {
  init(options);
}
