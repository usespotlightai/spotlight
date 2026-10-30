import type { Duplex } from 'node:stream';
import type { EditorConnectionDto } from '@runners/application/dto/sandbox-editor.dto';
import type { EditorSandboxesPort } from '@runners/application/ports/editor-sandboxes.port';
import type { SandboxTunnelsPort } from '@runners/application/ports/sandbox-tunnels.port';
import type { SandboxState } from '@runners/domain/aggregates/sandbox.aggregate';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class SandboxEditors {
  constructor(
    private readonly sandboxes: EditorSandboxesPort,
    private readonly tunnels: SandboxTunnelsPort,
    private readonly clock: ClockPort,
  ) {}

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
