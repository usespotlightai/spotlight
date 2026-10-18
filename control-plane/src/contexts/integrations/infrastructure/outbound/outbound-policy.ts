import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import { OutboundHosts } from '@platform/outbound/outbound-hosts';

export class OutboundPolicy {
  private readonly hosts: OutboundHosts;

  constructor(allowed: readonly string[]) {
    this.hosts = new OutboundHosts(allowed);
  }

  allow(url: string): void {
    let host: string;

    try {
      host = new URL(url).host;
    } catch {
      throw new EgressBlockedError(url, 'URL is not valid.');
    }

    if (!this.hosts.allow(host)) {
      throw new EgressBlockedError(
        host.toLowerCase(),
        'Host is not on the allowed list.',
      );
    }
  }
}
