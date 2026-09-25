import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
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
      throw new OutboundRefusedError(url, 'is not a URL that can be called');
    }

    if (!this.hosts.allow(host)) {
      throw new OutboundRefusedError(
        host.toLowerCase(),
        'is not among the hosts this deployment allows outbound calls to',
      );
    }
  }
}
