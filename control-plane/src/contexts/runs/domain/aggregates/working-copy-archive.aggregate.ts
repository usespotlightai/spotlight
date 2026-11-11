import { InvalidStartingPointError } from '@runs/domain/exceptions/invalid-starting-point.error';
import { InvalidWorkingCopyArchiveTransitionError } from '@runs/domain/exceptions/invalid-working-copy-archive-transition.error';
import { InvalidWorkingCopyArchiveError } from '@runs/domain/exceptions/invalid-working-copy-archive.error';
import { WorkingCopyArchiveNotUploadedError } from '@runs/domain/exceptions/working-copy-archive-not-uploaded.error';
import type { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import type { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import type { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { RestoredArchive } from '@runs/domain/value-objects/restored-archive.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

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

export interface HolderState {
  readonly released: boolean;
  readonly changedAt: Date;
}

export interface ArchiveFacts {
  readonly holder: HolderState | null;
  readonly supersededAt: Date | null;
  readonly lastStartedFromAt: Date | null;
  readonly pinned: boolean;
}

interface State {
  readonly id: WorkingCopyArchiveId;
  readonly workspaceId: WorkspaceId;
  readonly workingCopyKey: WorkingCopyKey;
  readonly grantedTo: ArchiveGrantee;
  readonly size: ArchiveSize;
  readonly digest: ArchiveDigest;
  readonly grantedAt: Date;
  readonly completedAt: Date | null;
  readonly version: number;
}

const after = (at: Date, ms: number): number => at.getTime() + ms;

export class WorkingCopyArchive extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded: boolean,
  ) {
    super();
  }

  static grant(input: {
    id: WorkingCopyArchiveId;
    workspaceId: WorkspaceId;
    workingCopyKey: WorkingCopyKey | null;
    held: boolean;
    grantee: ArchiveGrantee;
    size: ArchiveSize;
    digest: ArchiveDigest;
    at: Date;
  }): WorkingCopyArchive {
    const { workingCopyKey, held } = input;

    if (!workingCopyKey || !held) {
      throw new InvalidWorkingCopyArchiveError(
        'is stored only for work that continues in a later run',
      );
    }

    return new WorkingCopyArchive(
      {
        id: input.id,
        workspaceId: input.workspaceId,
        workingCopyKey,
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

  static rehydrate(state: State): WorkingCopyArchive {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'working copy archive',
        `has an impossible version (${state.version})`,
      );
    }

    if (state.completedAt && state.completedAt < state.grantedAt) {
      throw new InconsistentStateError(
        'working copy archive',
        'was completed before it was granted',
      );
    }

    return new WorkingCopyArchive(state, false);
  }

  get id(): WorkingCopyArchiveId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get workingCopyKey(): WorkingCopyKey {
    return this.state.workingCopyKey;
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

  get restored(): RestoredArchive {
    if (!this.isCompleted) {
      throw new InvalidStartingPointError(
        `names archive ${this.state.id.value}, which was never completed`,
      );
    }

    return RestoredArchive.of(
      this.state.id,
      this.state.workspaceId,
      this.state.workingCopyKey,
    );
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

  grantedForSandbox(sandboxId: SandboxId): boolean {
    return this.state.grantedTo.isSandbox(sandboxId);
  }

  complete(stored: StoredArchive | null, at: Date): WorkingCopyArchive {
    if (this.isCompleted) {
      return this;
    }

    if (!stored) {
      throw new WorkingCopyArchiveNotUploadedError(
        this.state.id.value,
        'was never uploaded',
      );
    }

    if (
      !stored.size.equals(this.state.size) ||
      !stored.digest.equals(this.state.digest)
    ) {
      throw new WorkingCopyArchiveNotUploadedError(
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

    if (facts.holder.released) {
      const since = Math.max(
        completedAt.getTime(),
        facts.holder.changedAt.getTime(),
      );

      return at >= since + RETENTION_AFTER_RELEASE_MS;
    }

    return false;
  }

  remove(now: Date, facts: ArchiveFacts): WorkingCopyArchive {
    if (!this.removableAt(now, facts)) {
      throw new InvalidWorkingCopyArchiveTransitionError(
        'can be removed only when no later run will restore it',
      );
    }

    const discarded = new WorkingCopyArchive(this.state, true);
    discarded.inheritEvents(this);

    return discarded;
  }

  private with(part: Partial<State>): WorkingCopyArchive {
    const next = new WorkingCopyArchive(
      { ...this.state, ...part },
      this.isDiscarded,
    );

    next.inheritEvents(this);

    return next;
  }
}
