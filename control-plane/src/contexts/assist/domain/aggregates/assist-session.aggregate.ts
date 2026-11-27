import { AssistSessionOrdered } from '@assist/domain/events/assist-session-ordered.event';
import { AssistSessionSettled } from '@assist/domain/events/assist-session-settled.event';
import { AssistResultNotAcceptedError } from '@assist/domain/exceptions/assist-result-not-accepted.error';
import type { AssistFailureReason } from '@assist/domain/value-objects/assist-failure-reason.vo';
import type { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import type { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import type { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import type { AssistState } from '@assist/domain/value-objects/assist-state.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { JsonObject, JsonValue } from '@shared-kernel/domain/json-value';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

/**
 * Where the session is: `ordered` until its run is queued, `running` once it is, then `submitted` with the result
 * its run sent, or `failed`. `model` is the harness and model the run was queued with.
 */
export type AssistProgress =
  | { readonly status: 'ordered' }
  | { readonly status: 'running'; readonly model: string }
  | {
      readonly status: 'submitted';
      readonly model: string;
      readonly result: JsonValue;
    }
  | { readonly status: 'failed'; readonly reason: AssistFailureReason };

export type AssistProgressStatus = AssistProgress['status'];

/** The harness a run was queued on, and the model when the run named one. */
export interface AssistHarness {
  readonly harness: string;
  readonly model: string | null;
}

interface AssistSessionFields {
  readonly id: AssistSessionId;
  readonly workspaceId: WorkspaceId;
  readonly purpose: AssistPurpose;
  readonly key: AssistSessionKey;
  readonly basedOn: RunId;
  readonly run: RunId;
  readonly resultSchema: JsonObject;
  readonly progress: AssistProgress;
  readonly usage: ModelCall | null;
  readonly orderedAt: Date;
  readonly settledAt: Date | null;
  readonly runEndedAt: Date | null;
  readonly version: number;
}

const isSettled = (progress: AssistProgress): boolean =>
  progress.status === 'submitted' || progress.status === 'failed';

const modelOf = ({ harness, model }: AssistHarness): string =>
  model !== null && model !== '' ? `${harness}/${model}` : harness;

export class AssistSession extends EventRecorder {
  private constructor(private readonly fields: AssistSessionFields) {
    super();
  }

  static order(input: {
    id: AssistSessionId;
    workspaceId: WorkspaceId;
    purpose: AssistPurpose;
    key: AssistSessionKey;
    basedOn: RunId;
    run: RunId;
    resultSchema: JsonObject;
    briefing: string;
    files: Readonly<Record<string, string>>;
    at: Date;
  }): AssistSession {
    const ordered = AssistSession.rehydrate({
      id: input.id,
      workspaceId: input.workspaceId,
      purpose: input.purpose,
      key: input.key,
      basedOn: input.basedOn,
      run: input.run,
      resultSchema: input.resultSchema,
      progress: { status: 'ordered' },
      usage: null,
      orderedAt: input.at,
      settledAt: null,
      runEndedAt: null,
      version: 0,
    });

    ordered.record(
      new AssistSessionOrdered(
        input.id,
        input.workspaceId,
        input.purpose,
        input.key,
        input.basedOn,
        input.run,
        input.briefing,
        { ...input.files },
      ),
    );

    return ordered;
  }

  static rehydrate(fields: AssistSessionFields): AssistSession {
    if (!Number.isInteger(fields.version) || fields.version < 0) {
      throw new InconsistentStateError(
        'assist session',
        `has an impossible version (${fields.version})`,
      );
    }

    if (isSettled(fields.progress) !== (fields.settledAt !== null)) {
      throw new InconsistentStateError(
        'assist session',
        'is settled exactly when it submitted or failed',
      );
    }

    return new AssistSession(fields);
  }

  get id(): AssistSessionId {
    return this.fields.id;
  }

  get workspaceId(): WorkspaceId {
    return this.fields.workspaceId;
  }

  get purpose(): AssistPurpose {
    return this.fields.purpose;
  }

  get key(): AssistSessionKey {
    return this.fields.key;
  }

  get basedOn(): RunId {
    return this.fields.basedOn;
  }

  get run(): RunId {
    return this.fields.run;
  }

  get resultSchema(): JsonObject {
    return this.fields.resultSchema;
  }

  get progress(): AssistProgress {
    return this.fields.progress;
  }

  get usage(): ModelCall | null {
    return this.fields.usage;
  }

  get orderedAt(): Date {
    return this.fields.orderedAt;
  }

  get settledAt(): Date | null {
    return this.fields.settledAt;
  }

  get runEndedAt(): Date | null {
    return this.fields.runEndedAt;
  }

  get version(): number {
    return this.fields.version;
  }

  get takesResults(): boolean {
    return this.fields.progress.status === 'running';
  }

  /** What the context that ordered the session sees: a submitted result counts once its run ended or reported usage. */
  get state(): AssistState {
    const { progress, usage, runEndedAt, orderedAt } = this.fields;

    switch (progress.status) {
      case 'failed':
        return progress;
      case 'submitted':
        return runEndedAt !== null || usage !== null
          ? {
              status: 'submitted',
              result: progress.result,
              usage,
              model: progress.model,
            }
          : { status: 'waiting', since: orderedAt };
      case 'ordered':
      case 'running':
        return { status: 'waiting', since: orderedAt };
    }
  }

  /** Notes that its run is queued on the harness and model of the run it is based on. */
  runQueued(on: AssistHarness): AssistSession {
    return this.fields.progress.status === 'ordered'
      ? this.with({ progress: { status: 'running', model: modelOf(on) } })
      : this;
  }

  submitted(result: JsonValue, at: Date): AssistSession {
    const { progress } = this.fields;

    if (progress.status !== 'running') {
      throw new AssistResultNotAcceptedError(progress.status);
    }

    return this.with({
      progress: { status: 'submitted', model: progress.model, result },
      settledAt: at,
    });
  }

  failed(reason: AssistFailureReason, at: Date): AssistSession {
    return isSettled(this.fields.progress)
      ? this
      : this.with({ progress: { status: 'failed', reason }, settledAt: at });
  }

  runEnded(failed: boolean, at: Date): AssistSession {
    if (this.fields.runEndedAt !== null) {
      return this;
    }

    return this.with({ runEndedAt: at }).failed(
      failed ? 'run-failed' : 'no-result',
      at,
    );
  }

  usageRecorded(call: ModelCall): AssistSession {
    return this.with({ usage: { ...call } });
  }

  private with(changes: Partial<AssistSessionFields>): AssistSession {
    const next = new AssistSession({ ...this.fields, ...changes });
    const settled = next.state;

    next.inheritEvents(this);

    if (this.state.status === 'waiting' && settled.status !== 'waiting') {
      next.record(
        new AssistSessionSettled(
          next.id,
          next.workspaceId,
          next.purpose,
          next.key,
          settled.status,
        ),
      );
    }

    return next;
  }
}
