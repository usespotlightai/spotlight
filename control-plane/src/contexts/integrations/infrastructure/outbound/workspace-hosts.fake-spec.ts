import type { WorkspaceHostsPort } from '@integrations/application/ports/workspace-hosts.port';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

export const onlyHosts = (...hosts: string[]): WorkspaceHostsPort => ({
  fresh: async () => HostAllowList.of(hosts),
});
