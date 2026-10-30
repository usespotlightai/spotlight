import type { Duplex } from 'node:stream';
import type { EditorConnectionDto } from '@runners/application/dto/sandbox-editor.dto';
import type { SandboxEditors } from '@runners/application/services/sandbox-editors.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { createWebSocketStream, type WebSocket } from 'ws';

const EDITOR_CLOSE = {
  startTimedOut: 4408,
  sandboxStopped: 4410,
  hostUnreachable: 4502,
} as const;

export interface EditorTiming {
  readonly renewMs: number;
  readonly pollMs: number;
  readonly startWaitMs: number;
  readonly activityMs: number;
  readonly pingMs: number;
}

const EDITOR_TIMING: EditorTiming = {
  renewMs: 30_000,
  pollMs: 1_000,
  startWaitMs: 10 * 60_000,
  activityMs: 30 * 60_000,
  pingMs: 30_000,
};

const STOPPED = 'The sandbox stopped. Please connect again.';

export class EditorSession {
  private readonly editor: Duplex;
  private closed = false;
  private held = true;
  private lastTraffic = Date.now();

  constructor(
    private readonly websocket: WebSocket,
    private readonly connection: EditorConnectionDto,
    private readonly editors: SandboxEditors,
    private readonly logger: LoggerPort,
    private readonly timing: EditorTiming = EDITOR_TIMING,
  ) {
    this.editor = createWebSocketStream(websocket);
    this.editor.on('error', () => {});
    websocket.once('close', () => {
      this.closed = true;
    });
  }

  async run(): Promise<void> {
    const renewing = setInterval(() => void this.renew(), this.timing.renewMs);
    const pinging = setInterval(
      () => this.websocket.ping(),
      this.timing.pingMs,
    );

    try {
      if (!(await this.ready())) {
        return;
      }

      const host = await this.editors.stream(this.connection);

      if (!host) {
        this.close(
          EDITOR_CLOSE.hostUnreachable,
          'The host of the sandbox is not connected. Please try again.',
        );
        return;
      }

      await this.join(host);
    } catch (error) {
      this.logger.warn(
        { sandboxId: this.connection.sandboxId, error },
        'An editor connection failed',
      );
      this.close(1011, 'Sorry, the connection to the sandbox failed.');
    } finally {
      clearInterval(renewing);
      clearInterval(pinging);
      this.editor.destroy();
      await this.release();
    }
  }

  close(code: number, reason: string): void {
    this.closed = true;
    if (
      this.websocket.readyState === this.websocket.OPEN ||
      this.websocket.readyState === this.websocket.CONNECTING
    ) {
      this.websocket.close(code, reason);
    }
  }

  private async ready(): Promise<boolean> {
    const until = Date.now() + this.timing.startWaitMs;

    while (!this.closed) {
      const state = await this.editors.stateOf(this.connection);

      if (state === 'ready') {
        return true;
      }

      if (state !== 'starting') {
        this.close(EDITOR_CLOSE.sandboxStopped, STOPPED);
        return false;
      }

      if (Date.now() >= until) {
        this.close(
          EDITOR_CLOSE.startTimedOut,
          'The sandbox did not start in time. Please try again.',
        );
        return false;
      }

      await new Promise((done) => setTimeout(done, this.timing.pollMs));
    }

    return false;
  }

  private join(host: Duplex): Promise<void> {
    return new Promise((done) => {
      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        host.destroy();
        this.close(1000, 'The sandbox closed the connection.');
        done();
      };
      const touch = () => {
        this.lastTraffic = Date.now();
      };

      this.editor.pipe(host, { end: false });
      host.pipe(this.editor, { end: false });
      this.editor.on('data', touch);
      host.on('data', touch);
      for (const stream of [host, this.editor]) {
        stream.once('end', finish);
        stream.once('close', finish);
        stream.once('error', finish);
      }

      if (this.closed) {
        finish();
      }
    });
  }

  private async renew(): Promise<void> {
    if (this.closed) {
      return;
    }

    try {
      if (Date.now() - this.lastTraffic > this.timing.activityMs) {
        await this.release();
        return;
      }

      const state = await this.editors.renew(this.connection);
      this.held = state !== null;

      if (this.closed) {
        await this.release();
        return;
      }

      if (state !== 'starting' && state !== 'ready') {
        this.close(EDITOR_CLOSE.sandboxStopped, STOPPED);
      }
    } catch (error) {
      this.logger.warn(
        { sandboxId: this.connection.sandboxId, error },
        'Could not renew an editor lease',
      );
    }
  }

  private async release(): Promise<void> {
    if (!this.held) {
      return;
    }
    this.held = false;

    try {
      await this.editors.release(this.connection);
    } catch (error) {
      this.logger.warn(
        { sandboxId: this.connection.sandboxId, error },
        'Could not release an editor lease; it expires on its own',
      );
    }
  }
}
