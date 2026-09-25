import type { HostCredential } from '@runners/application/ports/runner-admissions.port';

export class HostHarnessesQuery {
  constructor(readonly credential: HostCredential) {}
}
