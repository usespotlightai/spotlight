import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';

export class HostRequirementsQuery {
  constructor(readonly credential: HostCredentials) {}
}
