import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type ArchiveFacts,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import {
  aCompletedArchive,
  aCompletedChatArchive,
  anArchive,
  later,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { InvalidWorkspaceArchiveTransitionError } from '@work/domain/exceptions/invalid-workspace-archive-transition.error';
import { WorkspaceArchiveNotUploadedError } from '@work/domain/exceptions/workspace-archive-not-uploaded.error';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@work/domain/value-objects/archive-grantee.vo';
import type { HolderState } from '@work/domain/value-objects/archive-holder.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { describe, expect, it } from 'vitest';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const carryingOn: HolderState = {
  kind: 'task',
  finished: false,
  changedAt: later(0),
};

const conversing: HolderState = {
  kind: 'chat',
  conversing: true,
  changedAt: later(0),
};

const owned: ArchiveFacts = {
  holder: carryingOn,
  supersededAt: null,
  lastStartedFromAt: null,
  pinned: false,
};

const factsOf = (holder: HolderState): ArchiveFacts => ({
  holder,
  supersededAt: null,
  lastStartedFromAt: null,
  pinned: false,
});

const finished = factsOf({
  kind: 'task',
  finished: true,
  changedAt: later(2 * DAY),
});

const leftItsConversation = factsOf({
  kind: 'chat',
  conversing: false,
  changedAt: later(2 * DAY),
});

describe('WorkspaceArchive', () => {
  it('is granted to one run, and waits to be completed', () => {
    const archive = anArchive({ run: 'run_7' });

    expect(archive.grantedFor(RunId.of('run_7'))).toBe(true);
    expect(archive.grantedFor(RunId.of('run_8'))).toBe(false);
    expect(archive.isCompleted).toBe(false);
  });

  it('is granted only for work that carries on in a later run', () => {
    const granted = (
      part: Partial<Parameters<typeof WorkspaceArchive.grant>[0]>,
    ) =>
      WorkspaceArchive.grant({
        id: WorkspaceArchiveId.of('archive_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        resumeKey: ResumeKey.forChat('chat_1'),
        holder: { kind: 'chat', chatId: ChatId.of('chat_1') },
        grantee: ArchiveGrantee.run(RunId.of('run_1')),
        size: ArchiveSize.of(1_024),
        digest: ArchiveDigest.of(SHA256),
        at: later(0),
        ...part,
      });

    expect(() => granted({ resumeKey: null })).toThrow(
      InvalidWorkspaceArchiveError,
    );
    expect(() => granted({ holder: null })).toThrow(
      InvalidWorkspaceArchiveError,
    );
    expect(granted({}).isCompleted).toBe(false);
  });

  it('is completed once storage has exactly what was granted', () => {
    const completed = anArchive().complete(storedAs(1_024), later(5_000));

    expect(completed.isCompleted).toBe(true);
    expect(completed.completedAt).toEqual(later(5_000));
  });

  it('cannot be completed when nothing was uploaded, or something else was', () => {
    expect(() => anArchive().complete(null, later(0))).toThrow(
      WorkspaceArchiveNotUploadedError,
    );
    expect(() => anArchive().complete(storedAs(2_048), later(0))).toThrow(
      WorkspaceArchiveNotUploadedError,
    );
    expect(() =>
      anArchive().complete(storedAs(1_024, 'b'.repeat(64)), later(0)),
    ).toThrow(WorkspaceArchiveNotUploadedError);
  });

  it('stays as it was completed when completed again', () => {
    const completed = aCompletedArchive();

    expect(completed.complete(null, later(DAY))).toBe(completed);
  });

  it('is removed a day after it was granted, if it was never completed', () => {
    const waiting = anArchive();

    expect(waiting.removableAt(later(DAY - 1), owned)).toBe(false);
    expect(waiting.removableAt(later(DAY), owned)).toBe(true);
  });

  it('is stored while the task or chat it belongs to carries on', () => {
    expect(aCompletedArchive().removableAt(later(365 * DAY), owned)).toBe(
      false,
    );
  });

  it('is removed at once when the task or chat it belongs to is gone', () => {
    expect(
      aCompletedArchive().removableAt(later(1), {
        holder: null,
        supersededAt: null,
        lastStartedFromAt: null,
        pinned: false,
      }),
    ).toBe(true);
  });

  it('is removed an hour after a newer archive of the same work is completed', () => {
    const facts = { ...owned, supersededAt: later(DAY) };

    expect(aCompletedArchive().removableAt(later(DAY + HOUR - 1), facts)).toBe(
      false,
    );
    expect(aCompletedArchive().removableAt(later(DAY + HOUR), facts)).toBe(
      true,
    );
  });

  it('is stored for a week after its task finished, counted from whichever came last', () => {
    expect(aCompletedArchive().removableAt(later(9 * DAY - 1), finished)).toBe(
      false,
    );
    expect(aCompletedArchive().removableAt(later(9 * DAY), finished)).toBe(
      true,
    );

    const completedLater = anArchive().complete(
      storedAs(1_024),
      later(3 * DAY),
    );

    expect(completedLater.removableAt(later(9 * DAY), finished)).toBe(false);
    expect(completedLater.removableAt(later(10 * DAY), finished)).toBe(true);
  });

  it('is stored for as long as its task is unfinished, however long ago it last changed', () => {
    expect(
      aCompletedArchive().removableAt(
        later(365 * DAY),
        factsOf({ ...carryingOn, changedAt: later(2 * DAY) }),
      ),
    ).toBe(false);
  });

  it('is stored while its chat converses, and for a week after it left its conversation', () => {
    expect(
      aCompletedChatArchive().removableAt(
        later(365 * DAY),
        factsOf(conversing),
      ),
    ).toBe(false);
    expect(
      aCompletedChatArchive().removableAt(
        later(9 * DAY - 1),
        leftItsConversation,
      ),
    ).toBe(false);
    expect(
      aCompletedChatArchive().removableAt(later(9 * DAY), leftItsConversation),
    ).toBe(true);
  });

  describe('once a task run started from it', () => {
    const startedFrom = (
      at: Date,
      facts: ArchiveFacts = owned,
    ): ArchiveFacts => ({
      ...facts,
      lastStartedFromAt: at,
    });

    it('is stored for thirty days after the latest such run started, though a newer one is completed', () => {
      const facts = startedFrom(later(2 * DAY), {
        ...owned,
        supersededAt: later(DAY),
      });

      expect(aCompletedArchive().removableAt(later(32 * DAY - 1), facts)).toBe(
        false,
      );
      expect(aCompletedArchive().removableAt(later(32 * DAY), facts)).toBe(
        true,
      );
    });

    it('is stored for thirty days though its task finished long before', () => {
      const facts = startedFrom(later(DAY), finished);

      expect(aCompletedArchive().removableAt(later(31 * DAY - 1), facts)).toBe(
        false,
      );
      expect(aCompletedArchive().removableAt(later(31 * DAY), facts)).toBe(
        true,
      );
    });

    it('is still stored while its task carries on, after the thirty days', () => {
      expect(
        aCompletedArchive().removableAt(
          later(365 * DAY),
          startedFrom(later(DAY)),
        ),
      ).toBe(false);
    });

    it('is removed at once when its task is gone', () => {
      expect(
        aCompletedArchive().removableAt(
          later(DAY + 1),
          startedFrom(later(DAY), {
            holder: null,
            supersededAt: null,
            lastStartedFromAt: null,
            pinned: false,
          }),
        ),
      ).toBe(true);
    });
  });

  describe('while a replay set pins it', () => {
    const pinned = (facts: ArchiveFacts): ArchiveFacts => ({
      ...facts,
      lastStartedFromAt: later(DAY),
      pinned: true,
    });

    it('is stored long after the thirty days, though a newer one is completed and its task finished', () => {
      expect(
        aCompletedArchive().removableAt(
          later(365 * DAY),
          pinned({ ...finished, supersededAt: later(DAY) }),
        ),
      ).toBe(false);
    });

    it('is removed at once when its task is gone', () => {
      expect(
        aCompletedArchive().removableAt(
          later(DAY + 1),
          pinned({
            holder: null,
            supersededAt: null,
            lastStartedFromAt: null,
            pinned: false,
          }),
        ),
      ).toBe(true);
    });

    it('is stored only the thirty days once the set lets it go', () => {
      const released = { ...pinned(finished), pinned: false };

      expect(
        aCompletedArchive().removableAt(later(31 * DAY - 1), released),
      ).toBe(false);
      expect(aCompletedArchive().removableAt(later(31 * DAY), released)).toBe(
        true,
      );
    });
  });

  it('vouches for itself as restored into a run of the same workspace and work, once completed', () => {
    const work = ResumeKey.forTask('task_1');
    const restored = aCompletedArchive().restoreInto(
      WorkspaceId.of('ws_1'),
      work,
    );

    expect(restored.id.value).toBe('archive_1');
    expect(restored.restores(WorkspaceId.of('ws_1'), work)).toBe(true);
  });

  it('does not vouch for a restore it could not have been', () => {
    const work = ResumeKey.forTask('task_1');

    for (const attempt of [
      () => anArchive().restoreInto(WorkspaceId.of('ws_1'), work),
      () => aCompletedArchive().restoreInto(WorkspaceId.of('ws_2'), work),
      () =>
        aCompletedArchive().restoreInto(
          WorkspaceId.of('ws_1'),
          ResumeKey.forTask('task_2'),
        ),
      () => aCompletedArchive().restoreInto(WorkspaceId.of('ws_1'), null),
    ]) {
      expect(attempt).toThrow(InvalidStartingPointError);
    }
  });

  it('is discarded when removed once no later run will restore it', () => {
    const gone: ArchiveFacts = {
      holder: null,
      supersededAt: null,
      lastStartedFromAt: null,
      pinned: false,
    };

    expect(aCompletedArchive().remove(later(1), gone).isDiscarded).toBe(true);
  });

  it('cannot be removed while a later run may still restore it', () => {
    expect(() => aCompletedArchive().remove(later(365 * DAY), owned)).toThrow(
      InvalidWorkspaceArchiveTransitionError,
    );
    expect(() => anArchive().remove(later(DAY - 1), owned)).toThrow(
      InvalidWorkspaceArchiveTransitionError,
    );
  });

  it('names the cutoffs before which the removal rules remove an archive', () => {
    const cutoffs = WorkspaceArchive.removalCutoffs(later(8 * DAY));

    expect(cutoffs).toEqual({
      grantedIncompleteBy: later(7 * DAY),
      supersededBy: later(8 * DAY - HOUR),
      releasedBy: later(DAY),
      startedFromBy: later(8 * DAY - 30 * DAY),
    });
    expect(anArchive().removableAt(later(DAY), owned)).toBe(true);
    expect(
      aCompletedArchive().removableAt(later(8 * DAY), {
        holder: { kind: 'task', finished: true, changedAt: later(DAY) },
        supersededAt: null,
        lastStartedFromAt: null,
        pinned: false,
      }),
    ).toBe(true);
    expect(
      aCompletedArchive().removableAt(later(8 * DAY), {
        holder: carryingOn,
        supersededAt: later(8 * DAY - HOUR),
        lastStartedFromAt: null,
        pinned: false,
      }),
    ).toBe(true);
  });

  it('carries the SHA-256 it was granted for', () => {
    expect(anArchive().digest.sha256).toBe(SHA256);
  });
});
