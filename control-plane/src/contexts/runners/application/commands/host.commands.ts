import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';
import type { ReportedImage } from '@runners/domain/value-objects/host-image.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export interface ReportedHost {
  readonly name: string;
  readonly release: string;
  readonly containerRuntime: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly images: readonly ReportedImage[];
}

export class HostHeartbeatCommand {
  constructor(
    readonly credential: HostCredentials,
    readonly hostId: string,
    readonly bootId: string,
    readonly report: ReportedHost,
    readonly sandboxes: readonly string[],
  ) {}
}

export class DeregisterHostCommand {
  constructor(
    readonly credential: HostCredentials,
    readonly hostId: string,
  ) {}
}

export class DeleteHostCommand {
  constructor(
    readonly slug: string,
    readonly hostId: string,
    readonly principal: Principal,
  ) {}
}
