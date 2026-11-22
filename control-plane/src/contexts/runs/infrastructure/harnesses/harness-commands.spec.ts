import { TRACE_PARENT_VAR } from '@runs/application/contracts/run-spec.contract';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { HarnessCommands } from '@runs/infrastructure/harnesses/harness-commands';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { describe, expect, it } from 'vitest';

const commanding = () => {
  const chosen: unknown[] = [];
  const launch = {
    catalogue: () => [{ id: 'claude-code' }, { id: 'codex' }],
    commandFor: (id: HarnessId, picked: unknown) => {
      chosen.push([id.value, picked]);
      return { executable: id.value, args: ['-p'], env: { HOME: '/home' } };
    },
  } as unknown as HarnessLaunchPort;

  return { commands: new HarnessCommands(launch), chosen };
};

const CHOICE = { harness: 'claude-code', model: 'opus', effort: 'high' };

describe('HarnessCommands', () => {
  it('starts the chosen harness with its model and effort, traced to the trail and the run', () => {
    const { commands, chosen } = commanding();

    const command = commands.commandFor(CHOICE, 'session:assist_1', 'run_2');

    expect(chosen).toMatchObject([
      ['claude-code', { model: { value: 'opus' }, effort: { value: 'high' } }],
    ]);
    expect(command).toMatchObject({
      executable: 'claude-code',
      args: ['-p'],
      env: { HOME: '/home' },
    });
    expect(command?.env?.[TRACE_PARENT_VAR]).toMatch(/^00-[0-9a-f]{32}-/);
  });

  it('starts nothing for a harness no runner can start, or a model or effort it refuses', () => {
    const { commands, chosen } = commanding();

    expect(
      commands.commandFor({ ...CHOICE, harness: 'cursor' }, 'trail', 'run_2'),
    ).toBeNull();
    expect(
      commands.commandFor({ ...CHOICE, effort: 'extreme' }, 'trail', 'run_2'),
    ).toBeNull();
    expect(chosen).toEqual([]);
  });

  it('names what is wrong with a choice', () => {
    const { commands } = commanding();

    expect(commands.problemOf(CHOICE)).toBeNull();
    expect(commands.problemOf({ ...CHOICE, harness: 'cursor' })).toEqual({
      field: 'harness',
      reason:
        'Harness cursor is not one that a runner can start. Harnesses: claude-code, codex',
    });
    expect(commands.problemOf({ ...CHOICE, model: '' })).toMatchObject({
      field: 'model',
    });
    expect(commands.problemOf({ ...CHOICE, effort: 'extreme' })).toMatchObject({
      field: 'effort',
    });
  });
});
