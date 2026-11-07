import type {
  StationSourceEditFailureCode,
  StationSourceEditsPort,
  StationSourceField,
} from '@configuration/application/ports/station-source-edits.port';
import type { LineDefinitionStation } from '@lines/application/contracts/line-definition.contract';
import type {
  StationSourceEdit,
  StationSourceEdited,
  StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import { SEARCHABLE_FIELDS } from '@replays/domain/services/searchable-changes';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { ConfigPullRequestError } from '@replays/domain/value-objects/config-pull-request-state';

type Searchable = (typeof SEARCHABLE_FIELDS)[number];

const SOURCE_FIELDS: Readonly<Record<Searchable, StationSourceField>> = {
  prompt: 'prompt',
  harness: 'harness',
  model: 'model',
  effort: 'effort',
  profile: 'profile',
  skills: 'skills',
  tools: 'tools',
  decisions: 'decisions',
  memories: 'memories',
  description: 'description',
};

const ERRORS: Readonly<
  Record<StationSourceEditFailureCode, ConfigPullRequestError>
> = {
  unparsable: 'file-unparsable',
  'block-not-found': 'block-not-found',
  'blocks-ambiguous': 'blocks-ambiguous',
  'computed-attribute': 'computed-attribute',
  'base-changed': 'base-changed',
  'file-missing': 'file-missing',
  'edit-failed': 'edit-failed',
};

export class ConfigurationStationSourceEditor
  implements StationSourceEditorPort
{
  constructor(private readonly edits: StationSourceEditsPort) {}

  async edited(edit: StationSourceEdit): Promise<StationSourceEdited> {
    const edited = await this.edits.edited({
      file: edit.file,
      teamKey: edit.teamKey,
      lineKey: edit.lineKey,
      stationKey: edit.stationKey,
      seed: edit.seed.value as LineDefinitionStation,
      candidate: edit.candidate.value as LineDefinitionStation,
      fields: SEARCHABLE_FIELDS.map((each) => SOURCE_FIELDS[each]),
      configFiles: edit.configFiles,
    });

    return edited.ok
      ? { ok: true, files: edited.files, unchecked: edited.unchecked }
      : {
          ok: false,
          reason: ConfigPullRequestReason.of({
            code: ERRORS[edited.failure.code],
            message: edited.failure.message,
            attribute: edited.failure.attribute,
            expression: edited.failure.expression,
            wanted: edited.failure.wanted,
          }),
        };
  }
}
