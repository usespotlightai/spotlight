import { InvalidHarnessCommandError } from '@domain/exceptions/invalid-harness-command.error';
import { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import { describe, expect, it } from 'vitest';

describe('HarnessCommand', () => {
  it('starts an agent that needs no arguments', () => {
    const command = HarnessCommand.of({ executable: 'agent' });

    expect(command.started()).toEqual({ executable: 'agent', args: [] });
  });

  it('carries every argument the harness has to be started with', () => {
    const command = HarnessCommand.of({
      executable: 'agent',
      args: ['--serve'],
    });

    expect(command.started()).toEqual({
      executable: 'agent',
      args: ['--serve'],
    });
  });

  it('tells the harness what it needs telling, and nothing when there is none', () => {
    expect(
      HarnessCommand.of({ executable: 'agent' }).started(),
    ).not.toHaveProperty('env');

    const told = HarnessCommand.of({
      executable: 'agent',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
      env: { AGENT_STATE_DIR: '${SPOTLIGHT_STATE_DIR}/agent' },
    });

    expect(told.started()).toEqual({
      executable: 'agent',
      args: [],
      // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
      env: { AGENT_STATE_DIR: '${SPOTLIGHT_STATE_DIR}/agent' },
    });
  });

  it('is a different command when the harness is told something else', () => {
    const one = HarnessCommand.of({ executable: 'agent', env: { A: '1' } });

    expect(
      one.equals(HarnessCommand.of({ executable: 'agent', env: { A: '1' } })),
    ).toBe(true);
    expect(
      one.equals(HarnessCommand.of({ executable: 'agent', env: { A: '2' } })),
    ).toBe(false);
    expect(one.equals(HarnessCommand.of({ executable: 'agent' }))).toBe(false);
  });

  it('needs something to run', () => {
    expect(() => HarnessCommand.of({ executable: '   ' })).toThrow(
      InvalidHarnessCommandError,
    );
  });

  it('is the same command as one built the same way', () => {
    const one = HarnessCommand.of({
      executable: 'agent',
      args: ['--a', '--b'],
    });

    expect(
      one.equals(
        HarnessCommand.of({ executable: 'agent', args: ['--a', '--b'] }),
      ),
    ).toBe(true);
    expect(
      one.equals(HarnessCommand.of({ executable: 'agent', args: ['--a'] })),
    ).toBe(false);
    expect(
      one.equals(
        HarnessCommand.of({ executable: 'other', args: ['--a', '--b'] }),
      ),
    ).toBe(false);
  });
});
