import type { HostCredential } from '@runners/application/ports/runner-admissions.port';

export interface ReportedHostHarness {
  readonly id: string;
  readonly models: readonly string[];
  readonly version?: string;
}

export interface ReportedHost {
  readonly name: string;
  readonly release: string;
  readonly executor: string;
  readonly capacity: number;
  readonly running: readonly string[];
  readonly harnesses: readonly ReportedHostHarness[];
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
