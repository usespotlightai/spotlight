import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type ArchiveFacts,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import {
  anArchive,
  aSealedArchive,
  aSealedChatArchive,
  later,
  SHA256,
  storedAs,
} from '@work/domain/aggregates/workspace-archive.fake-spec';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { InvalidWorkspaceArchiveTransitionError } from '@work/domain/exceptions/invalid-workspace-archive-transition.error';
import { WorkspaceArchiveNotUploadedError } from '@work/domain/exceptions/workspace-archive-not-uploaded.error';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import type { HolderState } from '@work/domain/value-objects/archive-holder.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
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

const held: ArchiveFacts = {
  holder: carryingOn,
  supersededAt: null,
  lastStartedFromAt: null,
  pinned: false,
};

const standing = (holder: HolderState): ArchiveFacts => ({
  holder,
  supersededAt: null,
  lastStartedFromAt: null,
  pinned: false,
});

const finished = standing({
  kind: 'task',
  finished: true,
  changedAt: later(2 * DAY),
});

const leftItsConversation = standing({
  kind: 'chat',
  conversing: false,
  changedAt: later(2 * DAY),
});

describe('WorkspaceArchive', () => {
  it('is granted to one run, and waits to be sealed', () => {
    const archive = anArchive({ run: 'run_7' });

    expect(archive.grantedFor(RunId.of('run_7'))).toBe(true);
    expect(archive.grantedFor(RunId.of('run_8'))).toBe(false);
    expect(archive.isSealed).toBe(false);
  });

  it('is granted only for work that carries on in a later run', () => {
    const granted = (
      part: Partial<Parameters<typeof WorkspaceArchive.grant>[0]>,
    ) =>
      WorkspaceArchive.grant({
        id: WorkspaceArchiveId.of('archive_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        continuity: ContinuityKey.forChat('chat_1'),
        holder: { kind: 'chat', chatId: ChatId.of('chat_1') },
        run: RunId.of('run_1'),
        size: ArchiveSize.of(1_024),
        digest: ArchiveDigest.of(SHA256),
        at: later(0),
        ...part,
      });

    expect(() => granted({ continuity: null })).toThrow(
      InvalidWorkspaceArchiveError,
    );
    expect(() => granted({ holder: null })).toThrow(
      InvalidWorkspaceArchiveError,
    );
    expect(granted({}).isSealed).toBe(false);
  });

  it('is sealed once storage holds exactly what was granted', () => {
    const sealed = anArchive().seal(storedAs(1_024), later(5_000));

    expect(sealed.isSealed).toBe(true);
    expect(sealed.sealedAt).toEqual(later(5_000));
  });

  it('refuses to be sealed when nothing was uploaded, or something else was', () => {
    expect(() => anArchive().seal(null, later(0))).toThrow(
      WorkspaceArchiveNotUploadedError,
    );
    expect(() => anArchive().seal(storedAs(2_048), later(0))).toThrow(
      WorkspaceArchiveNotUploadedError,
    );
    expect(() =>
      anArchive().seal(storedAs(1_024, 'b'.repeat(64)), later(0)),
    ).toThrow(WorkspaceArchiveNotUploadedError);
  });

  it('stays as it was sealed when sealed again', () => {
    const sealed = aSealedArchive();

    expect(sealed.seal(null, later(DAY))).toBe(sealed);
  });

  it('is removed a day after it was granted, if it was never sealed', () => {
    const waiting = anArchive();

    expect(waiting.removableAt(later(DAY - 1), held)).toBe(false);
    expect(waiting.removableAt(later(DAY), held)).toBe(true);
  });

  it('is kept while the task or chat it belongs to carries on', () => {
    expect(aSealedArchive().removableAt(later(365 * DAY), held)).toBe(false);
  });

  it('is removed at once when the task or chat it belongs to is gone', () => {
    expect(
      aSealedArchive().removableAt(later(1), {
        holder: null,
        supersededAt: null,
        lastStartedFromAt: null,
        pinned: false,
      }),
    ).toBe(true);
  });

  it('is removed an hour after a newer archive of the same work is sealed', () => {
    const facts = { ...held, supersededAt: later(DAY) };

    expect(aSealedArchive().removableAt(later(DAY + HOUR - 1), facts)).toBe(
      false,
    );
    expect(aSealedArchive().removableAt(later(DAY + HOUR), facts)).toBe(true);
  });

  it('is kept for a week after its task finished, counted from whichever came last', () => {
    expect(aSealedArchive().removableAt(later(9 * DAY - 1), finished)).toBe(
      false,
    );
    expect(aSealedArchive().removableAt(later(9 * DAY), finished)).toBe(true);

    const sealedLater = anArchive().seal(storedAs(1_024), later(3 * DAY));

    expect(sealedLater.removableAt(later(9 * DAY), finished)).toBe(false);
    expect(sealedLater.removableAt(later(10 * DAY), finished)).toBe(true);
  });

  it('is kept for as long as its task is unfinished, however long ago it last changed', () => {
    expect(
      aSealedArchive().removableAt(
        later(365 * DAY),
        standing({ ...carryingOn, changedAt: later(2 * DAY) }),
      ),
    ).toBe(false);
  });

  it('is kept while its chat converses, and for a week after it left its conversation', () => {
    expect(
      aSealedChatArchive().removableAt(later(365 * DAY), standing(conversing)),
    ).toBe(false);
    expect(
      aSealedChatArchive().removableAt(later(9 * DAY - 1), leftItsConversation),
    ).toBe(false);
    expect(
      aSealedChatArchive().removableAt(later(9 * DAY), leftItsConversation),
    ).toBe(true);
  });

  describe('once a task run started from it', () => {
    const startedFrom = (
      at: Date,
      facts: ArchiveFacts = held,
    ): ArchiveFacts => ({
      ...facts,
      lastStartedFromAt: at,
    });

    it('is kept for thirty days after the latest such run started, though a newer one is sealed', () => {
      const facts = startedFrom(later(2 * DAY), {
        ...held,
        supersededAt: later(DAY),
      });

      expect(aSealedArchive().removableAt(later(32 * DAY - 1), facts)).toBe(
        false,
      );
      expect(aSealedArchive().removableAt(later(32 * DAY), facts)).toBe(true);
    });

    it('is kept for thirty days though its task finished long before', () => {
      const facts = startedFrom(later(DAY), finished);

      expect(aSealedArchive().removableAt(later(31 * DAY - 1), facts)).toBe(
        false,
      );
      expect(aSealedArchive().removableAt(later(31 * DAY), facts)).toBe(true);
    });

    it('is still kept while its task carries on, after the thirty days', () => {
      expect(
        aSealedArchive().removableAt(later(365 * DAY), startedFrom(later(DAY))),
      ).toBe(false);
    });

    it('is removed at once when its task is gone', () => {
      expect(
        aSealedArchive().removableAt(
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

    it('is kept long after the thirty days, though a newer one is sealed and its task finished', () => {
      expect(
        aSealedArchive().removableAt(
          later(365 * DAY),
          pinned({ ...finished, supersededAt: later(DAY) }),
        ),
      ).toBe(false);
    });

    it('is removed at once when its task is gone', () => {
      expect(
        aSealedArchive().removableAt(
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

    it('is kept only the thirty days once the set lets it go', () => {
      const released = { ...pinned(finished), pinned: false };

      expect(aSealedArchive().removableAt(later(31 * DAY - 1), released)).toBe(
        false,
      );
      expect(aSealedArchive().removableAt(later(31 * DAY), released)).toBe(
        true,
      );
    });
  });

  it('vouches for itself as restored into a run of the same workspace and work, once sealed', () => {
    const work = ContinuityKey.forTask('task_1');
    const restored = aSealedArchive().restoreInto(WorkspaceId.of('ws_1'), work);

    expect(restored.id.value).toBe('archive_1');
    expect(restored.restores(WorkspaceId.of('ws_1'), work)).toBe(true);
  });

  it('refuses to vouch for a restore it could not have been', () => {
    const work = ContinuityKey.forTask('task_1');

    for (const refused of [
      () => anArchive().restoreInto(WorkspaceId.of('ws_1'), work),
      () => aSealedArchive().restoreInto(WorkspaceId.of('ws_2'), work),
      () =>
        aSealedArchive().restoreInto(
          WorkspaceId.of('ws_1'),
          ContinuityKey.forTask('task_2'),
        ),
      () => aSealedArchive().restoreInto(WorkspaceId.of('ws_1'), null),
    ]) {
      expect(refused).toThrow(InvalidStartingPointError);
    }
  });

  it('is discarded when removed once no later run will restore it', () => {
    const gone: ArchiveFacts = {
      holder: null,
      supersededAt: null,
      lastStartedFromAt: null,
      pinned: false,
    };

    expect(aSealedArchive().remove(later(1), gone).isDiscarded).toBe(true);
  });

  it('refuses to be removed while a later run may still restore it', () => {
    expect(() => aSealedArchive().remove(later(365 * DAY), held)).toThrow(
      InvalidWorkspaceArchiveTransitionError,
    );
    expect(() => anArchive().remove(later(DAY - 1), held)).toThrow(
      InvalidWorkspaceArchiveTransitionError,
    );
  });

  it('names the cutoffs before which the removal rules let an archive go', () => {
    const cutoffs = WorkspaceArchive.removalCutoffs(later(8 * DAY));

    expect(cutoffs).toEqual({
      grantedUnsealedBy: later(7 * DAY),
      supersededBy: later(8 * DAY - HOUR),
      letGoBy: later(DAY),
      startedFromBy: later(8 * DAY - 30 * DAY),
    });
    expect(anArchive().removableAt(later(DAY), held)).toBe(true);
    expect(
      aSealedArchive().removableAt(later(8 * DAY), {
        holder: { kind: 'task', finished: true, changedAt: later(DAY) },
        supersededAt: null,
        lastStartedFromAt: null,
        pinned: false,
      }),
    ).toBe(true);
    expect(
      aSealedArchive().removableAt(later(8 * DAY), {
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
