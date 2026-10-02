import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { InvalidWorkspaceArchiveTransitionError } from '@work/domain/exceptions/invalid-workspace-archive-transition.error';
import { WorkspaceArchiveNotUploadedError } from '@work/domain/exceptions/workspace-archive-not-uploaded.error';
import type { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import type {
  ArchiveHolder,
  HolderState,
} from '@work/domain/value-objects/archive-holder.vo';
import type { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

const KEPT_AFTER_LET_GO_MS = 7 * 24 * 60 * 60_000;
const KEPT_AFTER_SUPERSEDED_MS = 60 * 60_000;
const KEPT_AFTER_STARTED_FROM_MS = 30 * 24 * 60 * 60_000;
const AWAITED_UNSEALED_MS = 24 * 60 * 60_000;

export interface StoredArchive {
  readonly size: ArchiveSize;
  readonly digest: ArchiveDigest;
}

export interface ArchiveRemovalCutoffs {
  readonly grantedUnsealedBy: Date;
  readonly supersededBy: Date;
  readonly letGoBy: Date;
  readonly startedFromBy: Date;
}

export interface ArchiveFacts {
  readonly holder: HolderState | null;
  readonly supersededAt: Date | null;
  readonly lastStartedFromAt: Date | null;
  readonly pinned: boolean;
}

interface State {
  readonly id: WorkspaceArchiveId;
  readonly workspaceId: WorkspaceId;
  readonly continuity: ContinuityKey;
  readonly holder: ArchiveHolder;
  readonly grantedTo: RunId;
  readonly size: ArchiveSize;
  readonly digest: ArchiveDigest;
  readonly grantedAt: Date;
  readonly sealedAt: Date | null;
  readonly version: number;
}

const after = (at: Date, ms: number): number => at.getTime() + ms;

export class WorkspaceArchive extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded: boolean,
  ) {
    super();
  }

  static granted(input: {
    id: WorkspaceArchiveId;
    workspaceId: WorkspaceId;
    continuity: ContinuityKey | null;
    holder: ArchiveHolder | null;
    run: RunId;
    size: ArchiveSize;
    digest: ArchiveDigest;
    at: Date;
  }): WorkspaceArchive {
    const { continuity, holder } = input;

    if (!continuity || !holder) {
      throw new InvalidWorkspaceArchiveError(
        'is kept only for work that carries on in a later run',
      );
    }

    return new WorkspaceArchive(
      {
        id: input.id,
        workspaceId: input.workspaceId,
        continuity,
        holder,
        grantedTo: input.run,
        size: input.size,
        digest: input.digest,
        grantedAt: input.at,
        sealedAt: null,
        version: 0,
      },
      false,
    );
  }

  static removalCutoffs(now: Date): ArchiveRemovalCutoffs {
    const before = (ms: number): Date => new Date(now.getTime() - ms);

    return {
      grantedUnsealedBy: before(AWAITED_UNSEALED_MS),
      supersededBy: before(KEPT_AFTER_SUPERSEDED_MS),
      letGoBy: before(KEPT_AFTER_LET_GO_MS),
      startedFromBy: before(KEPT_AFTER_STARTED_FROM_MS),
    };
  }

  static rehydrate(state: State): WorkspaceArchive {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'workspace archive',
        `has an impossible version (${state.version})`,
      );
    }

    if (state.sealedAt && state.sealedAt < state.grantedAt) {
      throw new InconsistentStateError(
        'workspace archive',
        'was sealed before it was granted',
      );
    }

    return new WorkspaceArchive(state, false);
  }

  get id(): WorkspaceArchiveId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get continuity(): ContinuityKey {
    return this.state.continuity;
  }

  get holder(): ArchiveHolder {
    return this.state.holder;
  }

  get grantedTo(): RunId {
    return this.state.grantedTo;
  }

  get size(): ArchiveSize {
    return this.state.size;
  }

  get digest(): ArchiveDigest {
    return this.state.digest;
  }

  get grantedAt(): Date {
    return this.state.grantedAt;
  }

  get sealedAt(): Date | null {
    return this.state.sealedAt;
  }

  get isSealed(): boolean {
    return this.state.sealedAt !== null;
  }

  get version(): number {
    return this.state.version;
  }

  restoredInto(
    workspaceId: WorkspaceId,
    continuity: ContinuityKey | null,
  ): RestoredArchive {
    const restored = RestoredArchive.of(
      this.state.id,
      this.state.workspaceId,
      this.state.continuity,
    );

    if (!this.isSealed || !restored.restores(workspaceId, continuity)) {
      throw new InvalidStartingPointError(
        `names archive ${this.state.id.value}, which the run could not have restored`,
      );
    }

    return restored;
  }

  isKeptIn(workspaceId: WorkspaceId): boolean {
    return (
      this.isSealed &&
      !this.isDiscarded &&
      this.state.workspaceId.equals(workspaceId)
    );
  }

  grantedFor(run: RunId): boolean {
    return this.state.grantedTo.equals(run);
  }

  sealed(stored: StoredArchive | null, at: Date): WorkspaceArchive {
    if (this.isSealed) {
      return this;
    }

    if (!stored) {
      throw new WorkspaceArchiveNotUploadedError(
        this.state.id.value,
        'was never uploaded',
      );
    }

    if (
      !stored.size.equals(this.state.size) ||
      !stored.digest.equals(this.state.digest)
    ) {
      throw new WorkspaceArchiveNotUploadedError(
        this.state.id.value,
        'was uploaded with a size or SHA-256 other than the one granted',
      );
    }

    return this.with({ sealedAt: at });
  }

  removableAt(now: Date, facts: ArchiveFacts): boolean {
    const { sealedAt, grantedAt } = this.state;
    const at = now.getTime();

    if (!sealedAt) {
      return at >= after(grantedAt, AWAITED_UNSEALED_MS);
    }

    if (!facts.holder) {
      return true;
    }

    if (facts.pinned) {
      return false;
    }

    if (
      facts.lastStartedFromAt &&
      at < after(facts.lastStartedFromAt, KEPT_AFTER_STARTED_FROM_MS)
    ) {
      return false;
    }

    if (
      facts.supersededAt &&
      at >= after(facts.supersededAt, KEPT_AFTER_SUPERSEDED_MS)
    ) {
      return true;
    }

    if (this.letGoBy(facts.holder)) {
      const since = Math.max(
        sealedAt.getTime(),
        facts.holder.changedAt.getTime(),
      );

      return at >= since + KEPT_AFTER_LET_GO_MS;
    }

    return false;
  }

  private letGoBy(now: HolderState): boolean {
    return now.kind === 'task' ? now.finished : !now.conversing;
  }

  removed(now: Date, facts: ArchiveFacts): WorkspaceArchive {
    if (!this.removableAt(now, facts)) {
      throw new InvalidWorkspaceArchiveTransitionError(
        'is removed only once no later run will restore it',
      );
    }

    const discarded = new WorkspaceArchive(this.state, true);
    discarded.inheritEvents(this);

    return discarded;
  }

  private with(part: Partial<State>): WorkspaceArchive {
    const next = new WorkspaceArchive(
      { ...this.state, ...part },
      this.isDiscarded,
    );

    next.inheritEvents(this);

    return next;
  }
}
