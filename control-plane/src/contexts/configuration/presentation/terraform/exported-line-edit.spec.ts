import { STATION_SOURCE_FIELDS } from '@configuration/application/ports/station-source-edits.port';
import { HclStationSourceEdits } from '@configuration/infrastructure/terraform/hcl-station-source-edits';
import { CONFIGURATION } from '@configuration/presentation/terraform/exportable-configuration.fake-spec';
import { workspaceTerraform } from '@configuration/presentation/terraform/terraform-configuration';
import type { LineDefinitionStation } from '@lines/application/contracts/line-definition.contract';
import {
  formattedByTerraform,
  TERRAFORM_INSTALLED,
} from '@platform/hcl/terraform-cli.fake-spec';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { describe, expect, it } from 'vitest';

const ROOT = 'infra/spotlight';

const EXPORTED = workspaceTerraform(CONFIGURATION).map((each) => ({
  path: `${ROOT}/${each.path}`,
  content: each.content,
}));

const LINE = EXPORTED.find(
  (each) => each.path === `${ROOT}/line-core-delivery.tf`,
) ?? {
  path: '',
  content: '',
};

const PROMPT = `${ROOT}/prompts/core/delivery/implementation.md`;

const SEED: LineDefinitionStation = {
  key: 'implementation',
  name: 'Implementation',
  kind: 'work',
  alerts: [],
  ends: false,
  harness: 'claude-code',
  profile: 'careful',
  prompt: 'Implement the task.\n\n',
  decisions: true,
  memories: false,
  tools: ['linear.comment', 'github.comment', 'catalog.web-search@1.1.0'],
  skills: ['grafana', 'catalog.research@1.0.0'],
  check: 'npm test',
  passesTo: [],
  judge: {
    rubric: 'A good run changes only what the task requests.\n',
    sample: 0.2,
    minAgreement: 0.6,
  },
};

const editedTo = (now: Partial<LineDefinitionStation>) =>
  new HclStationSourceEdits().edited({
    file: LINE,
    teamKey: 'core',
    lineKey: LineKey.of('delivery'),
    stationKey: StationKey.of('implementation'),
    seed: SEED,
    candidate: { ...SEED, ...now },
    fields: STATION_SOURCE_FIELDS,
    configFiles: EXPORTED.filter((each) => each.path !== LINE.path),
  });

describe('editing a line Spotlight exported', () => {
  it('changes the station’s prompt file and values, leaving every other byte of the export', async () => {
    const edited = await editedTo({
      prompt: 'Implement the task, smallest change first.\n',
      harness: 'codex',
      model: 'gpt-5',
      decisions: false,
    });

    expect(edited.ok && edited.unchecked).toEqual([]);

    const files = edited.ok ? edited.files : [];
    const line = files.find((each) => each.path === LINE.path)?.content ?? '';

    expect(files.find((each) => each.path === PROMPT)?.content).toBe(
      'Implement the task, smallest change first.\n',
    );
    expect(line).toBe(
      LINE.content
        .replace(
          '    harness   = "claude-code"\n    profile',
          '    harness   = "codex"\n    profile',
        )
        .replace(
          '    decisions = true\n    memories  = false\n',
          '    decisions = false\n    memories  = false\n',
        )
        .replace(
          '    ends      = true\n\n    judge {',
          '    ends      = true\n\n    model = "gpt-5"\n\n    judge {',
        ),
    );
    if (TERRAFORM_INSTALLED) {
      expect(formattedByTerraform(LINE.content)).toBe(LINE.content);
      expect(formattedByTerraform(line)).toBe(line);
    }
  });

  it('changes tools, skills and the profile the export wrote as references, keeping references where the export has the resource', async () => {
    const edited = await editedTo({
      tools: ['github.comment', 'linear.comment'],
      skills: ['catalog.research@1.0.0', 'grafana'],
      profile: 'bold',
    });
    const line = edited.ok ? (edited.files[0]?.content ?? '') : '';

    expect(edited.ok).toBe(true);
    expect(line).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: HCL interpolation, written literally
      '    tools     = ["github.comment", "${spotlight_integration.core_linear.integration}.comment"]\n',
    );
    expect(line).toContain(
      '    skills    = ["catalog.research@1.0.0", spotlight_skill.core_grafana.key]\n',
    );
    expect(line).toContain('    profile   = "bold"\n');
    if (TERRAFORM_INSTALLED) {
      expect(formattedByTerraform(line)).toBe(line);
    }
  });
});
