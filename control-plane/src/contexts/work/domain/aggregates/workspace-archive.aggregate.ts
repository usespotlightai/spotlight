import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { InvalidWorkspaceArchiveTransitionError } from '@work/domain/exceptions/invalid-workspace-archive-transition.error';
import { WorkspaceArchiveNotUploadedError } from '@work/domain/exceptions/workspace-archive-not-uploaded.error';
import type { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import type { ArchiveGrantee } from '@work/domain/value-objects/archive-grantee.vo';
import type {
  ArchiveHolder,
  HolderState,
} from '@work/domain/value-objects/archive-holder.vo';
import type { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

const RETENTION_AFTER_RELEASE_MS = 7 * 24 * 60 * 60_000;
const RETENTION_AFTER_SUPERSEDED_MS = 60 * 60_000;
const RETENTION_AFTER_STARTED_FROM_MS = 30 * 24 * 60 * 60_000;
const INCOMPLETE_ARCHIVE_WAIT_MS = 24 * 60 * 60_000;

export interface StoredArchive {
  readonly size: ArchiveSize;
  readonly digest: ArchiveDigest;
}

export interface ArchiveRemovalCutoffs {
  readonly grantedIncompleteBy: Date;
  readonly supersededBy: Date;
  readonly releasedBy: Date;
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
  readonly resumeKey: ResumeKey;
  readonly holder: ArchiveHolder;
  readonly grantedTo: ArchiveGrantee;
  readonly size: ArchiveSize;
  readonly digest: ArchiveDigest;
  readonly grantedAt: Date;
  readonly completedAt: Date | null;
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

  static grant(input: {
    id: WorkspaceArchiveId;
    workspaceId: WorkspaceId;
    resumeKey: ResumeKey | null;
    holder: ArchiveHolder | null;
    grantee: ArchiveGrantee;
    size: ArchiveSize;
    digest: ArchiveDigest;
    at: Date;
  }): WorkspaceArchive {
    const { resumeKey, holder } = input;

    if (!resumeKey || !holder) {
      throw new InvalidWorkspaceArchiveError(
        'is stored only for work that continues in a later run',
      );
    }

    return new WorkspaceArchive(
      {
        id: input.id,
        workspaceId: input.workspaceId,
        resumeKey,
        holder,
        grantedTo: input.grantee,
        size: input.size,
        digest: input.digest,
        grantedAt: input.at,
        completedAt: null,
        version: 0,
      },
      false,
    );
  }

  static removalCutoffs(now: Date): ArchiveRemovalCutoffs {
    const before = (ms: number): Date => new Date(now.getTime() - ms);

    return {
      grantedIncompleteBy: before(INCOMPLETE_ARCHIVE_WAIT_MS),
      supersededBy: before(RETENTION_AFTER_SUPERSEDED_MS),
      releasedBy: before(RETENTION_AFTER_RELEASE_MS),
      startedFromBy: before(RETENTION_AFTER_STARTED_FROM_MS),
    };
  }

  static rehydrate(state: State): WorkspaceArchive {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'workspace archive',
        `has an impossible version (${state.version})`,
      );
    }

    if (state.completedAt && state.completedAt < state.grantedAt) {
      throw new InconsistentStateError(
        'workspace archive',
        'was completed before it was granted',
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

  get resumeKey(): ResumeKey {
    return this.state.resumeKey;
  }

  get holder(): ArchiveHolder {
    return this.state.holder;
  }

  get grantedTo(): ArchiveGrantee {
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

  get completedAt(): Date | null {
    return this.state.completedAt;
  }

  get isCompleted(): boolean {
    return this.state.completedAt !== null;
  }

  get version(): number {
    return this.state.version;
  }

  restoreInto(
    workspaceId: WorkspaceId,
    resumeKey: ResumeKey | null,
  ): RestoredArchive {
    const restored = RestoredArchive.of(
      this.state.id,
      this.state.workspaceId,
      this.state.resumeKey,
    );

    if (!this.isCompleted || !restored.restores(workspaceId, resumeKey)) {
      throw new InvalidStartingPointError(
        `names archive ${this.state.id.value}, which the run did not restore`,
      );
    }

    return restored;
  }

  isAvailableIn(workspaceId: WorkspaceId): boolean {
    return (
      this.isCompleted &&
      !this.isDiscarded &&
      this.state.workspaceId.equals(workspaceId)
    );
  }

  grantedFor(run: RunId): boolean {
    return this.state.grantedTo.isRun(run);
  }

  grantedForSandbox(sandboxId: string): boolean {
    return this.state.grantedTo.isSandbox(sandboxId);
  }

  complete(stored: StoredArchive | null, at: Date): WorkspaceArchive {
    if (this.isCompleted) {
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
        'was uploaded with a different size or SHA-256 than granted',
      );
    }

    return this.with({ completedAt: at });
  }

  removableAt(now: Date, facts: ArchiveFacts): boolean {
    const { completedAt, grantedAt } = this.state;
    const at = now.getTime();

    if (!completedAt) {
      return at >= after(grantedAt, INCOMPLETE_ARCHIVE_WAIT_MS);
    }

    if (!facts.holder) {
      return true;
    }

    if (facts.pinned) {
      return false;
    }

    if (
      facts.lastStartedFromAt &&
      at < after(facts.lastStartedFromAt, RETENTION_AFTER_STARTED_FROM_MS)
    ) {
      return false;
    }

    if (
      facts.supersededAt &&
      at >= after(facts.supersededAt, RETENTION_AFTER_SUPERSEDED_MS)
    ) {
      return true;
    }

    if (this.isReleasedBy(facts.holder)) {
      const since = Math.max(
        completedAt.getTime(),
        facts.holder.changedAt.getTime(),
      );

      return at >= since + RETENTION_AFTER_RELEASE_MS;
    }

    return false;
  }

  private isReleasedBy(now: HolderState): boolean {
    return now.kind === 'task' ? now.finished : !now.conversing;
  }

  remove(now: Date, facts: ArchiveFacts): WorkspaceArchive {
    if (!this.removableAt(now, facts)) {
      throw new InvalidWorkspaceArchiveTransitionError(
        'can be removed only when no later run will restore it',
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
