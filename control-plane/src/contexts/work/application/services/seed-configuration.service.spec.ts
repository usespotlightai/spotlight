import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ConfigurationProposalsPort,
  Proposal,
} from '@work/application/ports/configuration-proposals.port';
import type { LineConfigWriterPort } from '@work/application/ports/line-config-writer.port';
import { SeedConfiguration } from '@work/application/services/seed-configuration.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { describe, expect, it, vi } from 'vitest';

const writer: LineConfigWriterPort = {
  write: (each) => ({
    files: [
      ConfigurationFile.of(
        `.spotlight/lines/${each.key.value}/line.yml`,
        `version: 1
name: ${each.name.value}
`,
      ),
    ],
    removes: [],
  }),
};

const TEAM = TeamId.of('team_1');

const line = () => {
  let next = 0;

  return Line.open({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });
};

describe('SeedConfiguration', () => {
  it('asks for a pull request carrying one file for each line', async () => {
    const seed = vi.fn(async () => ({
      url: 'https://github.com/acme/api/pull/1',
    }));
    const service = new SeedConfiguration(writer, {
      seed,
    } as unknown as ConfigurationProposalsPort);

    expect(await service.seed(TEAM, [line()])).toEqual({
      url: 'https://github.com/acme/api/pull/1',
    });

    const [teamId, proposal] = seed.mock.calls[0] as never as [
      TeamId,
      Proposal,
    ];
    expect(teamId).toEqual(TEAM);
    expect(proposal.title).toBe('Set up Spotlight');
    expect(proposal.files.map((each) => each.path)).toEqual([
      '.spotlight/lines/delivery/line.yml',
    ]);
    expect(proposal.files[0]?.text).toContain('version: 1');
  });
});
