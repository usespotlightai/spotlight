import type { Duplex } from 'node:stream';

export const SANDBOX_TUNNELS = Symbol('SANDBOX_TUNNELS');

export interface SandboxTunnelsPort {
  open(hostId: string, sandboxId: string): Promise<Duplex | null>;
}
