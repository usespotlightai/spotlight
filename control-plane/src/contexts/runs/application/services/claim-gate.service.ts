import type {
  RunStartGate,
  RunStartGatesPort,
  StartDecision,
} from '@runs/application/ports/run-start-gates.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

const PAST_THE_POLL_MS = 5_000;

const MAX_GATE_MS = 12_000;

export type RunStart = 'starts' | 'denied' | 'requeued';

export class ClaimGate implements RunStartGatesPort {
  private readonly gates = new Map<string, RunStartGate>();

  constructor(
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  register(gate: RunStartGate): void {
    this.gates.set(gate.owner, gate);
  }

  async mayStart(
    run: Run,
    runner: RunnerId,
    pollUntil: Date,
  ): Promise<RunStart> {
    const decision = await this.decisionOn(run, pollUntil);

    if (decision.kind === 'allowed') {
      return 'starts';
    }

    if (decision.kind === 'denied') {
      await this.revised(run, runner, (current) =>
        current.deniedStart(runner, decision.reason),
      );
      return 'denied';
    }

    await this.revised(run, runner, (current) =>
      current.requeue(runner, this.clock.now(), decision.because),
    );
    return 'requeued';
  }

  private async decisionOn(run: Run, pollUntil: Date): Promise<StartDecision> {
    if (!run.policy.gated) {
      return { kind: 'allowed' };
    }

    const requester = run.requester;
    const gate = this.gates.get(requester.owner.value);

    if (!gate) {
      this.logger.error(
        { runId: run.id.value, owner: requester.owner.value },
        'No start gate answers for the owner of a gated run, so it was requeued',
      );

      return {
        kind: 'retry',
        because: `no start gate for ${requester.owner.value}`,
      };
    }

    try {
      return await gate.mayStart(
        {
          runId: run.id,
          workspaceId: run.workspaceId,
          requester: requester.parts,
        },
        this.gateUntil(pollUntil),
      );
    } catch (error) {
      const because = error instanceof Error ? error.message : String(error);

      this.logger.error(
        { runId: run.id.value, owner: requester.owner.value, error: because },
        'The start gate failed before a run started, so it was requeued to be claimed again',
      );

      return { kind: 'retry', because };
    }
  }

  private gateUntil(pollUntil: Date): Date {
    return new Date(
      Math.min(
        pollUntil.getTime() + PAST_THE_POLL_MS,
        this.clock.now().getTime() + MAX_GATE_MS,
      ),
    );
  }

  private async revised(
    run: Run,
    runner: RunnerId,
    change: (current: Run) => Run,
  ): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const found = await this.runs.findById(run.id);

      if (!found || found.hasEnded || !found.wasClaimedBy(runner)) {
        return;
      }

      try {
        await this.runs.save(change(found));
        return;
      } catch (error) {
        if (
          !(error instanceof RunVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
