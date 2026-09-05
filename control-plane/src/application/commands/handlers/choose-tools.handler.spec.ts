import { ChooseToolsCommand } from '@application/commands/choose-tools.command';
import { ChooseToolsHandler } from '@application/commands/handlers/choose-tools.handler';
import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type {
  WriteConfiguration,
  Writing,
} from '@application/services/write-configuration.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { contributionOf } from '@domain/services/source-contribution';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ISSUE_CREATED = Happening.of('linear.issue.created');

let next = 0;
const bareLine = () =>
  AssemblyLine.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    newId: () => `id_${++next}`,
  });

const withLinearOpener = () =>
  bareLine().installing(contributionOf(SourceKey.of('linear')));

const members = {
  findTeamForMember: vi.fn(async () => ({
    workspaceId: 'ws_1',
    teamId: 'team_1',
    teamKey: 'team',
    slug: 'acme',
  })),
} as unknown as WorkspaceReaderPort;

const workspaces = {
  findBySlug: vi.fn(async () => ({}) as Workspace),
} as unknown as WorkspaceRepository;

const teams = {
  find: vi.fn(async () => ({}) as Team),
} as unknown as TeamRepository;

/** A handler over a team whose lines are these, with the writing captured. */
const over = (lines: AssemblyLine[]) => {
  let written: Writing | undefined;

  const writing = {
    write: vi.fn(async (_ws: Workspace, _team: Team, asked: Writing) => {
      written = asked;
      return { url: 'https://example/pr/1' };
    }),
  } as unknown as WriteConfiguration;

  const reader = {
    read: vi.fn(),
    write: vi.fn((line: AssemblyLine) =>
      ConfigurationFile.of(
        `.spotlight/lines/${line.name.value}.yml`,
        'written',
      ),
    ),
  } as unknown as LineReaderPort;

  const held = {
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    holding: vi.fn(),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => lines),
  } satisfies AssemblyLineRepository;

  const handler = new ChooseToolsHandler(
    workspaces,
    members,
    teams,
    writing,
    held,
    reader,
  );

  return { handler, reader, written: () => written };
};

const paths = (writing: Writing | undefined) =>
  (writing?.files ?? []).map((each) => each.path);

describe('ChooseTools', () => {
  it('puts a chosen tool’s opener on a line that was missing it', async () => {
    const { handler, reader, written } = over([bareLine()]);

    await handler.execute(
      new ChooseToolsCommand('team_1', ['linear'], 'user_1', []),
    );

    expect(reader.write).toHaveBeenCalledTimes(1);
    const rewritten = vi.mocked(reader.write).mock.calls[0]?.[0];
    expect(rewritten?.opensAt(ISSUE_CREATED)?.id).toEqual(
      rewritten?.backlog.id,
    );

    expect(paths(written())).toEqual([
      '.spotlight/integrations/linear.yml',
      '.spotlight/lines/Default.yml',
    ]);
  });

  it('leaves the line alone when the chosen tool’s opener is already on it', async () => {
    const { handler, reader, written } = over([withLinearOpener()]);

    await handler.execute(
      new ChooseToolsCommand('team_1', ['linear'], 'user_1', []),
    );

    expect(reader.write).not.toHaveBeenCalled();
    expect(paths(written())).toEqual(['.spotlight/integrations/linear.yml']);
  });

  it('takes a dropped tool’s reactions off the team’s lines in the same change', async () => {
    const { handler, reader, written } = over([withLinearOpener()]);

    await handler.execute(
      new ChooseToolsCommand('team_1', [], 'user_1', ['linear']),
    );

    expect(reader.write).toHaveBeenCalledTimes(1);
    const rewritten = vi.mocked(reader.write).mock.calls[0]?.[0];
    expect(rewritten?.opensAt(ISSUE_CREATED)).toBeNull();

    expect(paths(written())).toContain('.spotlight/lines/Default.yml');
    expect(written()?.removes).toContain('.spotlight/integrations/linear.yml');
  });

  it('leaves the lines alone when the dropped tool had nothing on them', async () => {
    const { handler, reader, written } = over([withLinearOpener()]);

    await handler.execute(
      new ChooseToolsCommand('team_1', [], 'user_1', ['sentry']),
    );

    expect(reader.write).not.toHaveBeenCalled();
    expect(paths(written())).toHaveLength(0);
    expect(written()?.removes).toContain('.spotlight/integrations/sentry.yml');
  });

  it('writes the chosen tool’s file beside the line it rewrites', async () => {
    const { handler, written } = over([withLinearOpener()]);

    await handler.execute(
      new ChooseToolsCommand('team_1', ['sentry'], 'user_1', ['linear']),
    );

    expect(paths(written())).toEqual([
      '.spotlight/integrations/sentry.yml',
      '.spotlight/lines/Default.yml',
    ]);
  });

  it('writes nothing where a team neither chose nor dropped a tool', async () => {
    const { handler, written } = over([withLinearOpener()]);

    const opened = await handler.execute(
      new ChooseToolsCommand('team_1', [], 'user_1', []),
    );

    expect(opened).toBeNull();
    expect(written()).toBeUndefined();
  });
});
