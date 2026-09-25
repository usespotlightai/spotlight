import type { HostCredential } from '@runners/application/ports/runner-admissions.port';

export class HostRequirementsQuery {
  constructor(readonly credential: HostCredential) {}
}
