import {
  controlPlaneFactsOf,
  encodedFacts,
  journalEntryText,
} from '@runs/infrastructure/journal/control-plane-facts';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-11-07T10:00:00.000Z');

describe('control-plane journal facts', () => {
  it('reads back the facts it stored', () => {
    const call = {
      attempt: 2,
      hook: 'freeze',
      step: 'ask',
      kind: 'request' as const,
      target: 'https://hooks.example.com',
      request: { a: 1 },
      response: null,
      status: null,
      failed: true,
      startedAt: AT,
      ms: 40,
    };

    expect(
      controlPlaneFactsOf({
        type: 'hook.called',
        data: encodedFacts({ type: 'hook.called', at: AT, call }),
      }),
    ).toEqual({ type: 'hook.called', call });
    expect(
      controlPlaneFactsOf({
        type: 'run.paused',
        data: encodedFacts({ type: 'run.paused', at: AT, resumesAtOnce: true }),
      }),
    ).toEqual({ type: 'run.paused', resumesAtOnce: true });
  });

  it('names an entry whose facts do not read as unreadable', () => {
    const broken = Buffer.from('{"failure":', 'utf8').toString('base64');

    expect(
      controlPlaneFactsOf({ type: 'provision.failed', data: broken }),
    ).toEqual({ type: 'unreadable', entryType: 'provision.failed' });
    expect(
      journalEntryText({ type: 'run.paused', message: null, data: null }),
    ).toBe('Unreadable journal entry · run.paused');
  });

  it('keeps the message an entry came with, and words no runner entry', () => {
    expect(
      journalEntryText({ type: 'output', message: 'hello', data: null }),
    ).toBe('hello');
    expect(
      journalEntryText({ type: 'output', message: null, data: null }),
    ).toBeUndefined();
  });
});
