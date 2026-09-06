import { ChooseToolsCommand } from '@application/commands/choose-tools.command';
import { ChooseToolsHandler } from '@application/commands/handlers/choose-tools.handler';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type {
  WriteConfiguration,
  Writing,
} from '@application/services/write-configuration.service';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { describe, expect, it, vi } from 'vitest';

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

/** A handler with the writing it asks for captured. */
const handler = () => {
  let written: Writing | undefined;

  const writing = {
    write: vi.fn(async (_ws: Workspace, _team: Team, asked: Writing) => {
      written = asked;
      return { url: 'https://example/pr/1' };
    }),
  } as unknown as WriteConfiguration;

  return {
    handler: new ChooseToolsHandler(workspaces, members, teams, writing),
    written: () => written,
  };
};

const paths = (writing: Writing | undefined) =>
  (writing?.files ?? []).map((each) => each.path);

describe('ChooseTools', () => {
  it('writes a chosen tool’s integration file', async () => {
    const { handler: choose, written } = handler();

    await choose.execute(
      new ChooseToolsCommand('team_1', ['linear'], 'user_1', []),
    );

    expect(paths(written())).toEqual(['.spotlight/integrations/linear.yml']);
  });

  it('removes a dropped tool’s integration file', async () => {
    const { handler: choose, written } = handler();

    await choose.execute(
      new ChooseToolsCommand('team_1', [], 'user_1', ['linear']),
    );

    expect(paths(written())).toHaveLength(0);
    expect(written()?.removes).toContain('.spotlight/integrations/linear.yml');
  });

  it('writes a chosen tool’s file beside a dropped one’s removal', async () => {
    const { handler: choose, written } = handler();

    await choose.execute(
      new ChooseToolsCommand('team_1', ['sentry'], 'user_1', ['linear']),
    );

    expect(paths(written())).toEqual(['.spotlight/integrations/sentry.yml']);
    expect(written()?.removes).toContain('.spotlight/integrations/linear.yml');
  });

  it('says nothing where a host nobody knows is the only one chosen', async () => {
    const { handler: choose, written } = handler();

    const opened = await choose.execute(
      new ChooseToolsCommand('team_1', ['nonesuch'], 'user_1', []),
    );

    expect(opened).toBeNull();
    expect(written()).toBeUndefined();
  });

  it('writes nothing where a team neither chose nor dropped a tool', async () => {
    const { handler: choose, written } = handler();

    const opened = await choose.execute(
      new ChooseToolsCommand('team_1', [], 'user_1', []),
    );

    expect(opened).toBeNull();
    expect(written()).toBeUndefined();
  });
});
