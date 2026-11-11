import type { WorkspaceOutboundHostsPort } from '@identity/application/ports/workspace-outbound-hosts.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const FRESH_FOR_MS = 30_000;

interface Held {
  readonly hosts: Promise<HostAllowList>;
  readonly until: number;
}

export class CachedWorkspaceOutboundHosts implements WorkspaceOutboundHostsPort {
  private readonly held = new Map<string, Held>();

  constructor(
    private readonly workspaces: Pick<WorkspaceReaderPort, 'profileOf'>,
    private readonly now: () => number = () => performance.now(),
    private readonly freshForMs = FRESH_FOR_MS,
  ) {}

  of(workspaceId: WorkspaceId): Promise<HostAllowList> {
    const held = this.held.get(workspaceId.value);

    return held && held.until > this.now()
      ? held.hosts
      : this.fresh(workspaceId);
  }

  fresh(workspaceId: WorkspaceId): Promise<HostAllowList> {
    const hosts = this.read(workspaceId);
    this.held.set(workspaceId.value, {
      hosts,
      until: this.now() + this.freshForMs,
    });
    hosts.catch(() => {
      if (this.held.get(workspaceId.value)?.hosts === hosts) {
        this.held.delete(workspaceId.value);
      }
    });

    return hosts;
  }

  forget(workspaceId: WorkspaceId): void {
    this.held.delete(workspaceId.value);
  }

  private async read(workspaceId: WorkspaceId): Promise<HostAllowList> {
    const profile = await this.workspaces.profileOf(workspaceId);

    if (!profile) {
      throw new Error(`workspace ${workspaceId.value} does not exist`);
    }

    return HostAllowList.restored(profile.outboundHosts);
  }
}
