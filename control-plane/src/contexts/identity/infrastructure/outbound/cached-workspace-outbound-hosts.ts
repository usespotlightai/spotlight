import type { WorkspaceOutboundHostsPort } from '@identity/application/ports/workspace-outbound-hosts.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

const FRESH_FOR_MS = 30_000;

interface Held {
  readonly hosts: Promise<HostAllowList>;
  readonly until: number;
}

export class CachedWorkspaceOutboundHosts
  implements WorkspaceOutboundHostsPort
{
  private readonly held = new Map<string, Held>();

  constructor(
    private readonly workspaces: Pick<WorkspaceReaderPort, 'profileOf'>,
    private readonly now: () => number = () => performance.now(),
    private readonly freshForMs = FRESH_FOR_MS,
  ) {}

  of(workspaceId: string): Promise<HostAllowList> {
    const held = this.held.get(workspaceId);

    return held && held.until > this.now()
      ? held.hosts
      : this.fresh(workspaceId);
  }

  fresh(workspaceId: string): Promise<HostAllowList> {
    const hosts = this.read(workspaceId);
    this.held.set(workspaceId, { hosts, until: this.now() + this.freshForMs });
    hosts.catch(() => {
      if (this.held.get(workspaceId)?.hosts === hosts) {
        this.held.delete(workspaceId);
      }
    });

    return hosts;
  }

  forget(workspaceId: string): void {
    this.held.delete(workspaceId);
  }

  private async read(workspaceId: string): Promise<HostAllowList> {
    const profile = await this.workspaces.profileOf(workspaceId);

    if (!profile) {
      throw new Error(`workspace ${workspaceId} does not exist`);
    }

    return HostAllowList.restored(profile.outboundHosts);
  }
}
