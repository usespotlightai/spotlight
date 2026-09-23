import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineConfigReader } from '@work/infrastructure/lines/line-config.reader';
import { describe, expect, it } from 'vitest';

const LINE = `version: 1
name: Default
stations: [backlog, code-review, completed]
reactions:
  - happening: github.pull_request.merged
    to: completed
`;

const STATIONS: Record<string, string> = {
  backlog: '---\nname: Backlog\nkind: backlog\npassesTo: [code-review]\n---\n',
  'code-review':
    '---\nname: Code Review\nends: true\n---\n\n## Code review\n\nReview it.\n',
  completed: '---\nname: Completed\nkind: completed\n---\n',
};

const folder = (key: string): ConfigurationFile[] => [
  ConfigurationFile.of(`.spotlight/lines/${key}/line.yml`, LINE),
  ...Object.entries(STATIONS).map(([station, text]) =>
    ConfigurationFile.of(
      `.spotlight/lines/${key}/stations/${station}.md`,
      text,
    ),
  ),
];

const reading = (files: ConfigurationFile[]) =>
  new LineConfigReader().read(files);

describe('LineConfigReader', () => {
  it('reads every line a workspace wrote, named for its folder', () => {
    const read = reading([...folder('delivery'), ...folder('factory')]);

    expect(read.plans.map((each) => each.key.value)).toEqual([
      'delivery',
      'factory',
    ]);
    expect(read.plans[0]?.stations.map((each) => each.key.value)).toEqual([
      'backlog',
      'code-review',
      'completed',
    ]);
    expect(read.problems).toEqual([]);
  });

  it('reads a station’s prompt from the body of its file', () => {
    const [plan] = reading(folder('delivery')).plans;

    expect(plan?.stations[1]?.agentPrompt?.value).toBe(
      '## Code review\n\nReview it.',
    );
    expect(plan?.stations[0]?.agentPrompt).toBeNull();
  });

  it('reads the reactions along with the stations', () => {
    const [plan] = reading(folder('delivery')).plans;

    expect(plan?.reactions).toHaveLength(1);
    expect(plan?.reactions[0]?.to.value).toBe('completed');
  });

  it('reads nothing outside the lines', () => {
    expect(
      reading([ConfigurationFile.of('somewhere/else/line.yml', LINE)]).plans,
    ).toEqual([]);
  });

  it('keeps reading past a line that will not', () => {
    const read = reading([
      ConfigurationFile.of('.spotlight/lines/broken/line.yml', 'version: 1'),
      ...folder('delivery'),
    ]);

    expect(read.plans.map((each) => each.key.value)).toEqual(['delivery']);
    expect(read.problems[0]?.path).toBe('.spotlight/lines/broken/line.yml');
  });

  it('warns of a file that sits in the lines folder itself, and reads it as no line', () => {
    const read = reading([
      ConfigurationFile.of('.spotlight/lines/delivery.yml', LINE),
    ]);

    expect(read.plans).toEqual([]);
    expect(read.problems[0]?.isWarning).toBe(true);
  });

  it('refuses a line whose folder holds no line.yml', () => {
    const read = reading(
      folder('delivery').filter((each) => !each.path.endsWith('line.yml')),
    );

    expect(read.plans).toEqual([]);
    expect(read.problems[0]?.path).toBe('.spotlight/lines/delivery/line.yml');
  });

  it('refuses a station the line lists and no file describes, where it is listed', () => {
    const read = reading(
      folder('delivery').filter((each) => !each.path.endsWith('backlog.md')),
    );

    expect(read.plans).toEqual([]);
    expect(read.problems[0]).toMatchObject({
      path: '.spotlight/lines/delivery/line.yml',
      at: 'stations.0',
    });
  });

  it('refuses a station file that opens with no frontmatter, where it is', () => {
    const read = reading([
      ...folder('delivery').filter(
        (each) => !each.path.endsWith('completed.md'),
      ),
      ConfigurationFile.of(
        '.spotlight/lines/delivery/stations/completed.md',
        'Just a prompt',
      ),
    ]);

    expect(read.plans).toEqual([]);
    expect(read.problems[0]?.path).toBe(
      '.spotlight/lines/delivery/stations/completed.md',
    );
  });

  it('places a problem with how a station hands on in that station’s file', () => {
    const read = reading([
      ...folder('delivery').filter((each) => !each.path.endsWith('backlog.md')),
      ConfigurationFile.of(
        '.spotlight/lines/delivery/stations/backlog.md',
        '---\nname: Backlog\nkind: backlog\npassesTo: [backlog]\n---\n',
      ),
    ]);

    expect(read.problems[0]).toMatchObject({
      path: '.spotlight/lines/delivery/stations/backlog.md',
      at: 'passesTo',
    });
  });

  it('places a problem with a reaction in line.yml, at that reaction', () => {
    const read = reading([
      ...folder('delivery').filter((each) => !each.path.endsWith('line.yml')),
      ConfigurationFile.of(
        '.spotlight/lines/delivery/line.yml',
        `${LINE}  - happening: github.checks.failed\n    to: nowhere\n`,
      ),
    ]);

    expect(read.problems[0]).toMatchObject({
      path: '.spotlight/lines/delivery/line.yml',
      at: 'reactions.1.to',
    });
  });

  it('places a problem with what a station gives in that station’s file', () => {
    const read = reading([
      ...folder('delivery').filter(
        (each) => !each.path.endsWith('code-review.md'),
      ),
      ConfigurationFile.of(
        '.spotlight/lines/delivery/stations/code-review.md',
        '---\nname: Code Review\nends: true\ntools: [pull-request, pull-request]\n---\n',
      ),
    ]);

    expect(read.problems[0]).toMatchObject({
      path: '.spotlight/lines/delivery/stations/code-review.md',
      at: 'tools',
    });
  });

  it('warns of a station file the line does not list, and reads the line anyway', () => {
    const read = reading([
      ...folder('delivery'),
      ConfigurationFile.of(
        '.spotlight/lines/delivery/stations/stray.md',
        '---\nname: Stray\n---\n',
      ),
    ]);

    expect(read.plans).toHaveLength(1);
    expect(read.problems).toHaveLength(1);
    expect(read.problems[0]?.isWarning).toBe(true);
    expect(read.problems[0]?.path).toBe(
      '.spotlight/lines/delivery/stations/stray.md',
    );
  });

  it('says a line is defined in the line.yml of its folder', () => {
    expect(new LineConfigReader().definedAt(LineKey.of('delivery'))).toBe(
      '.spotlight/lines/delivery/line.yml',
    );
  });
});
