import { Line } from '@domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@domain/services/built-in-lines';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { LineConfigReader } from '@infrastructure/integrations/line-config.reader';
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

const line = () => {
  let next = 0;

  return Line.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });
};

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

  describe('writing one back', () => {
    it('writes it where that line is read from', () => {
      expect(new LineConfigReader().write(line())[0]?.path).toBe(
        '.spotlight/lines/delivery/line.yml',
      );
    });

    it('writes something it can read back itself', () => {
      const reader = new LineConfigReader();

      const read = reader.read([...reader.write(line())]);

      expect(read.problems).toEqual([]);
      expect(read.plans[0]?.stations.map((each) => each.key.value)).toEqual(
        [...line().stations]
          .sort((one, other) => one.position - other.position)
          .map((each) => each.key.value),
      );
    });
  });
});
