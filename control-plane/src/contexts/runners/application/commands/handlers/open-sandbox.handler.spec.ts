import { OpenSandboxHandler } from '@runners/application/commands/handlers/open-sandbox.handler';
import { OpenSandboxCommand } from '@runners/application/commands/sandbox.commands';
import { Sandboxes } from '@runners/application/services/sandboxes.service';
import {
  DRAIN_POLICY,
  sandboxTokens,
  storedSandboxes,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T10:00:00.000Z');

describe('OpenSandboxHandler', () => {
  it('requests a sandbox for a key with no run, then answers with the same one', async () => {
    const { stored, sandboxes } = storedSandboxes();
    const handler = new OpenSandboxHandler(
      new Sandboxes(
        sandboxes,
        DRAIN_POLICY,
        { generate: () => 'sandbox_1' },
        sandboxTokens(),
        {
          inTransaction: (work: () => Promise<unknown>) => work(),
        } as TransactionPort,
        { info: vi.fn() } as unknown as LoggerPort,
      ),
      { now: () => NOW, sleep: async () => {} },
    );

    const opened = await handler.execute(
      new OpenSandboxCommand('ws_1', 'chat-chat_1'),
    );
    const again = await handler.execute(
      new OpenSandboxCommand('ws_1', 'chat-chat_1'),
    );

    expect(opened).toEqual({ id: 'sandbox_1', state: 'starting' });
    expect(again).toEqual(opened);
    expect(stored.get('sandbox_1')?.hostId).toBeNull();
  });
});
