import { ReactionDeferredError } from '@integrations/application/errors/reaction-deferred.error';
import { PullRequestConflictReactions } from '@integrations/application/services/pull-request-conflict-reactions.service';
import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const CONFLICT = {
  pullRequest: 'https://github.com/acme/api/pull/18',
  branch: 'spotlight/fix-the-queue',
  base: 'main',
};

const RAISED = partial<Happened>({
  happening: 'github.pull_request.conflicted',
});

const reactionsWith = (failure: DeliveryFailure | null) => {
  const react = vi.fn(async () => failure);
  const logger = partial<LoggerPort>({ warn: vi.fn() });

  return {
    react,
    logger,
    service: new PullRequestConflictReactions(
      { conflicted: () => [RAISED] },
      { react },
      logger,
    ),
  };
};

describe('PullRequestConflictReactions', () => {
  it('hands work what the conflict raises, once for its key', async () => {
    const { service, react } = reactionsWith(null);

    await service.conflicted(WORKSPACE, CONFLICT, 'github-conflict:evt_1');

    expect(react).toHaveBeenCalledWith(
      WORKSPACE,
      null,
      [RAISED],
      'github-conflict:evt_1',
    );
  });

  it('fails, to be tried again, when work could not react yet', async () => {
    const { service } = reactionsWith(DeliveryFailure.transient('busy'));

    await expect(
      service.conflicted(WORKSPACE, CONFLICT, 'github-conflict:evt_1'),
    ).rejects.toBeInstanceOf(ReactionDeferredError);
  });

  it('says so, and lets go, when work cannot react at all', async () => {
    const { service, logger } = reactionsWith(
      DeliveryFailure.permanent('no such line'),
    );

    await service.conflicted(WORKSPACE, CONFLICT, 'github-conflict:evt_1');

    expect(logger.warn).toHaveBeenCalled();
  });
});
