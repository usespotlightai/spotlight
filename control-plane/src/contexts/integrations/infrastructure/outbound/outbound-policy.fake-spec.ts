import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import { OutboundHosts } from '@platform/outbound/outbound-hosts';

export const allowingOutbound = (hosts: readonly string[]): OutboundPolicy =>
  new OutboundPolicy(new OutboundGuard(OutboundHosts.listed(hosts.join(','))));
