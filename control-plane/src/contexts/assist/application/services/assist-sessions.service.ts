import type { AssistResultSubmitted } from '@assist/application/dto/assist-result.dto';
import type {
  AssistOrder,
  AssistSessionsPort,
  AssistState,
} from '@assist/application/ports/assist-sessions.port';
import type {
  ResultChecksPort,
  ResultIssue,
} from '@assist/application/ports/result-checks.port';
import type {
  AssistRunEnqueueing,
  RunsPort,
} from '@assist/application/ports/runs.port';
import { AssistSession } from '@assist/domain/aggregates/assist-session.aggregate';
import { AssistSessionVersionConflictError } from '@assist/domain/exceptions/assist-session-version-conflict.error';
import type { AssistSessionRepository } from '@assist/domain/repositories/assist-session.repository';
import type { AssistFailureReason } from '@assist/domain/value-objects/assist-failure-reason.vo';
import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { isJsonValue, type JsonValue } from '@shared-kernel/domain/json-value';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const SAVE_TRIES = 3;

export interface AssistResultSubmission {
  readonly runId: string;
  readonly runnerId: string;
  readonly result: unknown;
}

export interface AssistRunRequest {
  readonly runId: string;
  readonly briefing: string;
  readonly files: Readonly<Record<string, string>>;
}

export interface AssistRunEnding {
  readonly runId: string;
  readonly failed: boolean;
  readonly endedAt: Date;
}

export interface AssistRunUsage {
  readonly runId: string;
  readonly call: ModelCall;
}

const FAILURE_OF: Readonly<
  Record<
    Exclude<AssistRunEnqueueing['outcome'], 'enqueued'>,
    AssistFailureReason
  >
> = {
  'no-harness': 'no-harness',
  'base-run-elsewhere': 'base-run-elsewhere',
  refused: 'run-failed',
};

const problemOf = (issue: ResultIssue): ConfigurationProblem =>
  ConfigurationProblem.of({
    path: '',
    at: FieldPath.of(issue.path),
    reason: issue.message,
  });

const NOT_JSON = ConfigurationProblem.of({
  path: '',
  at: FieldPath.root(),
  reason: 'The result must be plain JSON.',
});

export class AssistSessions implements AssistSessionsPort {
  constructor(
    private readonly sessions: AssistSessionRepository,
    private readonly runs: RunsPort,
    private readonly checks: ResultChecksPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async request(order: AssistOrder): Promise<AssistState> {
    const workspaceId = WorkspaceId.of(order.workspaceId);
    const purpose = AssistPurpose.of(order.purpose);
    const key = AssistSessionKey.of(order.key);
    const known = await this.sessions.findOrdered(workspaceId, purpose, key);

    if (known) {
      return known.state;
    }

    const session = AssistSession.order({
      id: AssistSessionId.of(this.ids.generate()),
      workspaceId,
      purpose,
      key,
      basedOn: RunId.of(order.basedOnRun),
      run: RunId.of(this.ids.generate()),
      resultSchema: order.resultSchema,
      briefing: order.briefing,
      files: order.files,
      at: this.clock.now(),
    });

    if (await this.sessions.add(session)) {
      return session.state;
    }

    const raced = await this.sessions.findOrdered(workspaceId, purpose, key);

    if (!raced) {
      throw new InconsistentStateError(
        'assist session',
        `${purpose.value} ${key.value} was refused as a duplicate, but no session has its key`,
      );
    }

    return raced.state;
  }

  /** Queues the run of a session ordered a moment ago, or fails the session when it cannot run. */
  async enqueueRun(request: AssistRunRequest): Promise<void> {
    const session = await this.sessions.findByRun(RunId.of(request.runId));

    if (session?.progress.status !== 'ordered') {
      return;
    }

    const enqueued = await this.runs.enqueue({
      run: session.run,
      session: session.id,
      workspaceId: session.workspaceId,
      purpose: session.purpose,
      basedOn: session.basedOn,
      briefing: request.briefing,
      files: request.files,
    });

    await this.sessions.save(
      enqueued.outcome === 'enqueued'
        ? session.runQueued(enqueued.on)
        : session.failed(FAILURE_OF[enqueued.outcome], this.clock.now()),
    );
  }

  async submit(
    submission: AssistResultSubmission,
  ): Promise<AssistResultSubmitted> {
    const run = RunId.of(submission.runId);

    if (!(await this.runs.isLeasedBy(run, submission.runnerId))) {
      return { outcome: 'not-leased' };
    }

    for (let tries = 1; ; tries += 1) {
      const session = await this.sessions.findByRun(run);

      if (!session) {
        return { outcome: 'not-an-assist-run' };
      }
      if (!session.takesResults) {
        return { outcome: 'not-accepted' };
      }

      const checked = this.checked(session, submission.result);

      if (checked.outcome === 'invalid') {
        return checked;
      }

      try {
        await this.sessions.save(
          session.submitted(checked.result, this.clock.now()),
        );
        return { outcome: 'accepted' };
      } catch (error) {
        if (
          !(error instanceof AssistSessionVersionConflictError) ||
          tries >= SAVE_TRIES
        ) {
          throw error;
        }
      }
    }
  }

  async runEnded(ending: AssistRunEnding): Promise<void> {
    const session = await this.sessions.findByRun(RunId.of(ending.runId));

    if (session) {
      const ended = session.runEnded(ending.failed, ending.endedAt);

      if (ended !== session) {
        await this.sessions.save(ended);
      }
    }
  }

  async usageRecorded(usage: AssistRunUsage): Promise<void> {
    const session = await this.sessions.findByRun(RunId.of(usage.runId));

    if (session) {
      await this.sessions.save(session.usageRecorded(usage.call));
    }
  }

  async workspaceDeleted(workspaceId: string): Promise<void> {
    for (const session of await this.sessions.ofWorkspace(
      WorkspaceId.of(workspaceId),
    )) {
      await this.sessions.remove(session);
    }
  }

  private checked(
    session: AssistSession,
    result: unknown,
  ):
    | { readonly outcome: 'checked'; readonly result: JsonValue }
    | Extract<AssistResultSubmitted, { outcome: 'invalid' }> {
    const checked = this.checks.check(session.resultSchema, result);

    if (!checked.fits) {
      return { outcome: 'invalid', problems: checked.issues.map(problemOf) };
    }

    return isJsonValue(checked.result)
      ? { outcome: 'checked', result: checked.result }
      : { outcome: 'invalid', problems: [NOT_JSON] };
  }
}
