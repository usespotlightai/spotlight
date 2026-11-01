import type { Duplex } from 'node:stream';
import type { EditorConnectionDto } from '@runners/application/dto/sandbox-editor.dto';
import type { EditorLeasesPort } from '@runners/application/ports/editor-leases.port';
import type { EditorSandboxesPort } from '@runners/application/ports/editor-sandboxes.port';
import type { SandboxTunnelsPort } from '@runners/application/ports/sandbox-tunnels.port';
import type { SandboxState } from '@runners/domain/aggregates/sandbox.aggregate';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

const ATTEMPTS = 3;

export class SandboxEditors implements EditorLeasesPort {
  constructor(
    private readonly sandboxes: EditorSandboxesPort,
    private readonly tunnels: SandboxTunnelsPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async hold(workspaceId: string, key: string): Promise<EditorConnectionDto> {
    const holder = this.ids.generate();

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const at = this.clock.now();
      const opened = await this.sandboxes.open(workspaceId, key, at);

      if (await this.sandboxes.holdForEditor(opened.id, holder, at)) {
        return { sandboxId: opened.id, holder };
      }
    }

    throw new Error(
      `The sandbox of ${key} drained each time an editor tried to hold it`,
    );
  }

  admits(connection: EditorConnectionDto): Promise<boolean> {
    return this.sandboxes.heldByEditor(
      connection.sandboxId,
      connection.holder,
      this.clock.now(),
    );
  }

  renew(connection: EditorConnectionDto): Promise<SandboxState | null> {
    return this.sandboxes.holdForEditor(
      connection.sandboxId,
      connection.holder,
      this.clock.now(),
    );
  }

  release(connection: EditorConnectionDto): Promise<void> {
    return this.sandboxes.releaseEditor(
      connection.sandboxId,
      connection.holder,
      this.clock.now(),
    );
  }

  stateOf(connection: EditorConnectionDto): Promise<SandboxState | null> {
    return this.sandboxes.stateOf(connection.sandboxId);
  }

  async stream(connection: EditorConnectionDto): Promise<Duplex | null> {
    const hostId = await this.sandboxes.readyOn(connection.sandboxId);

    return hostId ? this.tunnels.open(hostId, connection.sandboxId) : null;
  }
}
