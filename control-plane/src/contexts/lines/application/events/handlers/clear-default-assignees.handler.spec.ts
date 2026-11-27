import type { MemberLookupPort } from '@identity/application/ports/member-lookup.port';
import { ClearDefaultAssignees } from '@lines/application/events/handlers/clear-default-assignees.handler';
import { Line } from '@lines/domain/aggregates/line.aggregate';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import { ConfigSource } from '@lines/domain/value-objects/config-source.vo';
import { DefaultAssignee } from '@lines/domain/value-objects/default-assignee.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const lineAssignedTo = (email: string, source: ConfigSource | null = null) => {
  let next = 0;
  const created = Line.create({
    by: changeActorIn(),
    workspaceId: WORKSPACE,
    teamId: TeamId.of('team_1'),
    line: BUILT_IN_LINES[0],
    harness: HarnessId.of('dev'),
    newId: () => `id_${++next}`,
  });

  return Line.rehydrate({
    id: created.id,
    workspaceId: created.workspaceId,
    teamId: created.teamId,
    key: created.key,
    name: created.name,
    stations: created.stations,
    reactions: created.reactions,
    defaultAssignee: DefaultAssignee.of(email),
    source,
    version: 1,
  });
};

const clearing = (found: readonly Line[], emails = ['ada@example.com']) => {
  const save = vi.fn<(line: Line) => Promise<void>>(async () => {});
  const withDefaultAssignee = vi.fn(() => Promise.resolve(found));
  const warn = vi.fn();
  const clearer = new ClearDefaultAssignees(
    partial<LineRepository>({ withDefaultAssignee, save }),
    partial<MemberLookupPort>({ emailsOf: () => Promise.resolve(emails) }),
    partial<LoggerPort>({ warn }),
  );

  return { clearer, save, withDefaultAssignee, warn };
};

describe('ClearDefaultAssignees', () => {
  it('looks for every email the person has', async () => {
    const { clearer, withDefaultAssignee } = clearing(
      [],
      ['ada@example.com', 'ada@work.example'],
    );

    await clearer.clearOf(WORKSPACE, UserId.of('user_1'));

    expect(withDefaultAssignee).toHaveBeenCalledWith(WORKSPACE, [
      'ada@example.com',
      'ada@work.example',
    ]);
  });

  it('takes the person off the lines that name them, and changes nothing else', async () => {
    const line = lineAssignedTo('ada@example.com');
    const { clearer, save } = clearing([line]);

    await clearer.clearOf(WORKSPACE, UserId.of('user_1'));

    const saved = save.mock.calls[0]?.[0];

    expect(saved.defaultAssignee).toBeNull();
    expect(saved.version).toBe(1);
    expect(saved.stations).toEqual(line.stations);
    expect(saved.name).toEqual(line.name);
  });

  it('leaves a line that Terraform manages, which would bring them back', async () => {
    const managed = lineAssignedTo(
      'ada@example.com',
      ConfigSource.of({ repository: 'acme/config', path: 'lines.tf' }),
    );
    const { clearer, save } = clearing([managed]);

    await clearer.clearOf(WORKSPACE, UserId.of('user_1'));

    expect(save).not.toHaveBeenCalled();
  });

  it('warns and fails where a line cannot be saved, so the delivery tries again', async () => {
    const { clearer, save, warn } = clearing([
      lineAssignedTo('ada@example.com'),
    ]);

    save.mockRejectedValueOnce(new Error('conflict'));

    await expect(
      clearer.clearOf(WORKSPACE, UserId.of('user_1')),
    ).rejects.toThrow('conflict');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
