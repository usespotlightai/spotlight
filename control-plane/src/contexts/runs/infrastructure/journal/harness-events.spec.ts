import { harnessEventOf } from '@runs/infrastructure/journal/harness-events';
import { describe, expect, it } from 'vitest';

const event = (type: string, data: Record<string, unknown>) => ({
  type,
  data: Buffer.from(JSON.stringify(data)).toString('base64'),
});

describe('harnessEventOf', () => {
  it('reads the session states, turn stops, roles and background work the runner sends', () => {
    for (const read of [
      event('turn.started', { turn: 1, origin: 'self' }),
      event('turn.ended', { turn: 1, stop: 'refused' }),
      event('session.state', { state: 'needs-action' }),
      event('message', { id: 'm1', role: 'thought', text: 'Hm.' }),
      event('background.changed', {
        items: [{ id: 't1', kind: 'monitor', description: 'tail the log' }],
      }),
      event('child.changed', { child: 'c1', state: 'idle', stop: 'ended' }),
    ]) {
      expect(harnessEventOf(read)?.type).toBe(read.type);
    }
  });

  it('drops an event whose value is not one the runner sends', () => {
    for (const unread of [
      event('turn.started', { turn: 1, origin: 'cron' }),
      event('turn.ended', { turn: 1, stop: 'paused' }),
      event('session.state', { state: 'compacting' }),
      event('message', { id: 'm1', role: 'system', text: 'Hm.' }),
      event('background.changed', {
        items: [{ id: 't1', kind: 'daemon', description: 'tail the log' }],
      }),
      event('background.changed', {
        items: [{ kind: 'command', description: 'npx vitest run' }],
      }),
      event('background.changed', { items: [{ id: 't1', kind: 'command' }] }),
      event('child.changed', { child: 'c1', state: 'asleep' }),
    ]) {
      expect(harnessEventOf(unread)).toBeNull();
    }
  });
});
