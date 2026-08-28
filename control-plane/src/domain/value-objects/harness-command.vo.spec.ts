import { InvalidHarnessCommandError } from '@domain/exceptions/invalid-harness-command.error';
import { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import { describe, expect, it } from 'vitest';

describe('HarnessCommand', () => {
  it('needs something to run', () => {
    expect(() => HarnessCommand.of({ executable: '   ' })).toThrow(
      InvalidHarnessCommandError,
    );
  });

  it('runs an agent that needs no arguments', () => {
    const command = HarnessCommand.of({ executable: 'agent' });

    expect(command.briefedWith('do the thing')).toEqual({
      executable: 'agent',
      args: ['do the thing'],
    });
  });

  // The briefing goes last, where an agent CLI takes the prompt it is to work
  // on, so everything the pool carries is passed ahead of it.
  it('puts the briefing after everything the pool carries', () => {
    const command = HarnessCommand.of({
      executable: 'claude',
      args: ['--dangerously-skip-permissions'],
    });

    expect(command.briefedWith('## Fix the queue')).toEqual({
      executable: 'claude',
      args: ['--dangerously-skip-permissions', '## Fix the queue'],
    });
  });

  it('is not changed by what is done with it', () => {
    const command = HarnessCommand.of({ executable: 'agent', args: ['--one'] });

    command.briefedWith('first');
    command.briefedWith('second');

    expect(command.args).toEqual(['--one']);
  });

  it('is the same command as one built the same way', () => {
    const one = HarnessCommand.of({ executable: 'agent', args: ['--a', '--b'] });

    expect(one.equals(HarnessCommand.of({ executable: 'agent', args: ['--a', '--b'] }))).toBe(true);
    expect(one.equals(HarnessCommand.of({ executable: 'agent', args: ['--a'] }))).toBe(false);
    expect(one.equals(HarnessCommand.of({ executable: 'other', args: ['--a', '--b'] }))).toBe(false);
  });
});
