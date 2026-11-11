import type {
  StationSourceEditRequest,
  StationSourceEditsPort,
} from '@configuration/application/ports/station-source-edits.port';
import { SEARCHABLE_FIELDS } from '@replays/domain/services/searchable-changes';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { ConfigurationStationSourceEditor } from '@replays/infrastructure/acl/configuration-station-source.editor';
import { describe, expect, it } from 'vitest';

const edit = {
  file: { path: 'main.tf', content: '' },
  teamKey: 'core',
  lineKey: 'delivery',
  stationKey: 'build',
  seed: StationBlock.of({ key: 'build', model: 'sonnet' }),
  candidate: StationBlock.of({ key: 'build', model: 'opus' }),
  configFiles: [{ path: 'prompts/build.md', content: 'Build it.\n' }],
};

describe('ConfigurationStationSourceEditor', () => {
  it('asks Configuration to change only the fields a search may change', async () => {
    const asked: StationSourceEditRequest[] = [];
    const edits: StationSourceEditsPort = {
      edited: async (request) => {
        asked.push(request);
        return { ok: true, files: [], unchecked: [] };
      },
    };

    await new ConfigurationStationSourceEditor(edits).edited(edit);

    expect(asked[0]?.fields).toEqual([...SEARCHABLE_FIELDS]);
    expect(asked[0]?.candidate).toEqual({ key: 'build', model: 'opus' });
  });

  it('names a failure in the config pull request’s own terms', async () => {
    const edits: StationSourceEditsPort = {
      edited: async () => ({
        ok: false,
        failure: {
          code: 'unparsable',
          message: 'The file does not parse.',
          attribute: null,
          expression: null,
          wanted: null,
        },
      }),
    };

    const answer = await new ConfigurationStationSourceEditor(edits).edited(
      edit,
    );

    expect(!answer.ok && answer.reason.code).toBe('file-unparsable');
  });
});
