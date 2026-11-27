import { SubmitAssistResultCommand } from '@assist/application/commands/submit-assist-result.command';
import type { AssistResultSubmitted } from '@assist/application/dto/assist-result.dto';
import { RunnerAssistResultController } from '@assist/presentation/http/controllers/runner-assist-result.controller';
import type { CommandBus } from '@nestjs/cqrs';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const submitting = (answer: AssistResultSubmitted) => {
  const sent: unknown[] = [];
  const controller = new RunnerAssistResultController(
    partial<CommandBus>({
      execute: async (command: unknown) => {
        sent.push(command);
        return answer;
      },
    }),
  );

  return { controller, sent };
};

const problemOf = async (pending: Promise<unknown>) => {
  const thrown: unknown = await pending.catch((error: unknown) => error);

  if (!(thrown instanceof ProblemException)) {
    throw new Error('expected a ProblemException');
  }

  return thrown.problem;
};

describe('RunnerAssistResultController', () => {
  it('passes on the result the runner relayed for its run', async () => {
    const { controller, sent } = submitting({ outcome: 'accepted' });

    await expect(
      controller.submit('run_1', { result: { score: 0.8 } }, 'runner_1'),
    ).resolves.toEqual({ accepted: true });
    expect(sent).toEqual([
      new SubmitAssistResultCommand('run_1', 'runner_1', { score: 0.8 }),
    ]);
  });

  it('passes on no result when the body carries none', async () => {
    const { controller, sent } = submitting({ outcome: 'accepted' });

    await controller.submit('run_1', ['not', 'an', 'object'], 'runner_1');

    expect(sent).toEqual([
      new SubmitAssistResultCommand('run_1', 'runner_1', undefined),
    ]);
  });

  it('names the path of each problem in a result that does not fit', async () => {
    const { controller } = submitting({
      outcome: 'invalid',
      problems: [
        ConfigurationProblem.of({
          path: '',
          at: FieldPath.of(['claims', 0, 'passed']),
          reason: 'Expected boolean, received string',
        }),
      ],
    });

    const problem = await problemOf(
      controller.submit('run_1', { result: {} }, 'runner_1'),
    );

    expect(problem).toMatchObject({
      status: 422,
      type: 'urn:spotlight:problem:invalid',
      errors: [
        {
          path: 'claims[0].passed',
          message: 'Expected boolean, received string',
          severity: 'error',
        },
      ],
    });
  });

  it('answers a conflict for a run that is no assist session', async () => {
    const { controller } = submitting({ outcome: 'not-an-assist-run' });

    await expect(
      problemOf(controller.submit('run_1', { result: {} }, 'runner_1')),
    ).resolves.toMatchObject({ status: 409 });
  });

  it('answers a conflict once the session accepted a result', async () => {
    const { controller } = submitting({ outcome: 'not-accepted' });

    await expect(
      problemOf(controller.submit('run_1', { result: {} }, 'runner_1')),
    ).resolves.toMatchObject({
      status: 409,
      type: 'urn:spotlight:problem:assist-result-not-accepted',
    });
  });

  it('answers not found to a runner that does not lease the run', async () => {
    const { controller } = submitting({ outcome: 'not-leased' });

    await expect(
      problemOf(controller.submit('run_1', { result: {} }, 'runner_2')),
    ).resolves.toMatchObject({ status: 404 });
  });
});
