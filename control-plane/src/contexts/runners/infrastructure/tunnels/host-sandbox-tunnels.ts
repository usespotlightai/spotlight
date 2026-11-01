import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { bearerIn, TRUST_HEADER } from '@platform/http/bearer';
import { API_PREFIX } from '@platform/http/routes';
import {
  DialBackTunnels,
  type TunnelRoute,
} from '@platform/websocket/dial-back-tunnels';
import type { SandboxTunnelsPort } from '@runners/application/ports/sandbox-tunnels.port';
import { HostAdmission } from '@runners/application/services/host-admission.service';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const TUNNEL_PATH = new RegExp(
  `^/${API_PREFIX}/hosts/([^/]+)/tunnel(?:/([^/]+))?$`,
);

const header = (request: IncomingMessage, name: string): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const routeOf = (pathname: string): TunnelRoute | null => {
  const matched = TUNNEL_PATH.exec(pathname);

  return matched
    ? {
        peer: decodeURIComponent(matched[1] ?? ''),
        stream: matched[2] ? decodeURIComponent(matched[2]) : null,
      }
    : null;
};

@Injectable()
export class HostSandboxTunnels
  implements
    SandboxTunnelsPort,
    OnApplicationBootstrap,
    BeforeApplicationShutdown
{
  private readonly tunnels: DialBackTunnels;

  constructor(
    private readonly adapters: HttpAdapterHost,
    admission: HostAdmission,
    @Inject(LOGGER) logger: LoggerPort,
  ) {
    this.tunnels = new DialBackTunnels({
      route: routeOf,
      admit: (request, hostId) =>
        admission.admit(
          {
            bearer: bearerIn(header(request, 'authorization')),
            trust: header(request, TRUST_HEADER),
          },
          hostId,
        ),
      refusals: {
        browser: 'Only hosts open a tunnel.',
        unadmitted:
          'Pool token is missing, rotated or unknown, no trust accepts this workload, or the host sent no heartbeat.',
        unknownStream: 'No editor waits for this stream.',
        replaced: 'Another tunnel of this host replaced this one.',
        stopping: 'The control plane stops.',
      },
      logger,
    });
  }

  onApplicationBootstrap(): void {
    this.tunnels.listen(this.adapters);
  }

  beforeApplicationShutdown(): void {
    this.tunnels.close();
  }

  open(hostId: string, sandboxId: string): Promise<Duplex | null> {
    return this.tunnels.open(hostId, { sandboxId });
  }
}
