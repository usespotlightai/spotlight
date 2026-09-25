import type { HostCredential } from '@runners/application/ports/runner-admissions.port';
import type { ReportedImage } from '@runners/domain/value-objects/host-image.vo';

export interface ReportedHost {
  readonly name: string;
  readonly release: string;
  readonly executor: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly images: readonly ReportedImage[];
}

export class ReportHostPresenceCommand {
  constructor(
    readonly credential: HostCredential,
    readonly hostId: string,
    readonly report: ReportedHost,
  ) {}
}

export class LeaveAsHostCommand {
  constructor(
    readonly credential: HostCredential,
    readonly hostId: string,
  ) {}
}
