import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { HclStationSourceEditor } from '@replays/infrastructure/hcl/station-source.editor';
import { describe, expect, it } from 'vitest';

const LINE = `resource "spotlight_line" "core_delivery" {
  key  = "delivery"
  name = "Delivery"

  station {
    key     = "build"
    name    = "Build"
    kind    = "work"
    harness = "claude-code"
    prompt  = file("\${path.module}/prompts/build.md")
    tools   = []
    skills  = []
  }

  station {
    key    = "ship"
    name   = "Ship"
    kind   = "work"
    prompt = file("\${path.module}/prompts/build.md")
  }
}
`;

const SEED = {
  key: 'build',
  name: 'Build',
  kind: 'work',
  harness: 'claude-code',
  prompt: 'Build it.\n',
  diffs: false,
  decisions: false,
  memories: false,
  alerts: [],
  tools: [],
  skills: [],
  passesTo: [],
  ends: false,
};

const edited = (
  candidate: Record<string, unknown>,
  file = LINE,
  seed: Record<string, unknown> = SEED,
) =>
  new HclStationSourceEditor().edited({
    file: { path: 'main.tf', content: file },
    teamKey: 'core',
    lineKey: 'delivery',
    stationKey: 'build',
    seed: StationBlock.of(seed),
    candidate: StationBlock.of({ ...SEED, ...candidate }),
    module: [],
    read: async (path) => (path === 'prompts/build.md' ? 'Build it.\n' : null),
  });

describe('HclStationSourceEditor', () => {
  it('changes only the searchable fields the candidate changed', async () => {
    const answer = await edited({
      prompt: 'Build it, in order.\n',
      decisions: true,
      model: 'opus',
    });

    expect(answer.ok && answer.files.map((each) => each.path)).toEqual([
      'main.tf',
      'prompts/core/delivery/build.md',
    ]);
    expect(answer.ok && answer.files[0]?.content).toBe(
      LINE.replace(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
        '    prompt  = file("${path.module}/prompts/build.md")',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a Terraform expression
        '    prompt  = file("${path.module}/prompts/core/delivery/build.md")',
      ).replace(
        '    skills  = []\n',
        '    skills  = []\n\n    model     = "opus"\n    decisions = true\n',
      ),
    );
  });

  it('names the error in the search’s own terms', async () => {
    const answer = await edited({ model: 'opus' }, 'resource "x" {\n');

    expect(answer.ok === false && answer.reason.code).toBe('file-unparsable');
    expect(
      (await edited({ model: 'opus' }, LINE.replace('"build"', '"ship"'))).ok,
    ).toBe(false);
  });

  it('rejects a block value it cannot write as a failed edit, not something to retry', async () => {
    const answer = await edited({ description: { nested: true } });

    expect(answer.ok === false && answer.reason.code).toBe('edit-failed');
  });

  it('writes a station whose judge’s claims and pass threshold are as the search began, and rejects one whose claims changed since', async () => {
    const judge = {
      claims: ['It adds a test.'],
      passThreshold: 0.5,
      sample: 0.2,
      minAgreement: 0.6,
    };
    const judged = (claims: string) =>
      LINE.replace(
        '    skills  = []\n',
        `    skills  = []\n\n    judge {\n      claims         = [${claims}]\n      pass_threshold = 0.5\n      sample         = 0.2\n      min_agreement  = 0.6\n    }\n`,
      );
    const seed = { ...SEED, judge };

    expect(
      (
        await edited(
          { judge, model: 'opus' },
          judged('"It adds a test."'),
          seed,
        )
      ).ok,
    ).toBe(true);

    const baseChanged = await edited(
      { judge, model: 'opus' },
      judged('"It adds two tests."'),
      seed,
    );
    expect(baseChanged.ok === false && baseChanged.reason.code).toBe(
      'base-changed',
    );
  });

  it('reads a pass threshold left out of the file as 1, and calls one set there since the search began drift', async () => {
    const judge = {
      claims: ['It adds a test.'],
      sample: 0.2,
      minAgreement: 0.6,
    };
    const judged = (passThreshold: string) =>
      LINE.replace(
        '    skills  = []\n',
        `    skills  = []\n\n    judge {\n      claims        = ["It adds a test."]${passThreshold}\n      sample        = 0.2\n      min_agreement = 0.6\n    }\n`,
      );
    const seed = { ...SEED, judge };

    expect((await edited({ judge, model: 'opus' }, judged(''), seed)).ok).toBe(
      true,
    );

    const baseChanged = await edited(
      { judge, model: 'opus' },
      judged('\n      pass_threshold = 0.5'),
      seed,
    );
    expect(baseChanged.ok === false && baseChanged.reason.code).toBe(
      'base-changed',
    );
  });
});
