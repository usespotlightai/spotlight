import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

export const allowingOutbound = (hosts: readonly string[]): OutboundPolicy =>
  new OutboundPolicy(new OutboundGuard(HostAllowList.listed(hosts.join(','))));
