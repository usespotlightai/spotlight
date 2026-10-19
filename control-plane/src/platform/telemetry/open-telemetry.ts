import type { IncomingMessage } from 'node:http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  scrubbedRequestSpan,
  withoutOutboundPath,
} from '@platform/telemetry/span-urls';
import { exportersOf } from '@platform/telemetry/telemetry-env';

const SERVICE_NAME = 'spotlight-control-plane';

const PROBES = new Set(['/api/health', '/api/health/ready']);

const isProbe = (request: IncomingMessage): boolean =>
  PROBES.has(request.url?.split('?', 1)[0] ?? '');

let started: NodeSDK | undefined;

export function startOpenTelemetry(env: NodeJS.ProcessEnv): boolean {
  const exporters = exportersOf(env);

  if (!exporters) {
    return false;
  }

  Object.assign(env, exporters);

  started = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME ? undefined : SERVICE_NAME,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: isProbe,
        requestHook: scrubbedRequestSpan,
      }),
      new UndiciInstrumentation({ requestHook: withoutOutboundPath }),
      new PgInstrumentation({ requireParentSpan: true }),
      new PinoInstrumentation({ disableLogSending: true }),
      new RuntimeNodeInstrumentation(),
    ],
  });
  started.start();

  return true;
}

export async function stopOpenTelemetry(): Promise<void> {
  await started?.shutdown();
  started = undefined;
}
