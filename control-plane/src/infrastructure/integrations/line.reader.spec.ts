import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { LineReader } from '@infrastructure/integrations/line.reader';
import { describe, expect, it } from 'vitest';

const WHOLE = `
version: 1
key: default
name: Default
stations:
  - key: backlog
    name: Backlog
    kind: backlog
  - key: code-review
    name: Code Review
  - key: completed
    name: Completed
    kind: completed
reactions:
  - happening: github.pull_request.merged
    to: completed
`;

const at = (path: string, text = WHOLE) => ConfigurationFile.of(path, text);

const reading = (files: ConfigurationFile[]) => new LineReader().read(files);

const line = () => {
  let next = 0;

  return AssemblyLine.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    newId: () => `id_${++next}`,
  });
};

describe('LineReader', () => {
  it('reads every line a workspace wrote', () => {
    const read = reading([at('.spotlight/lines/default.yml')]);

    expect(read.plans.map((each) => each.key.value)).toEqual(['default']);
    expect(read.plans[0]?.stations).toHaveLength(3);
    expect(read.problems).toEqual([]);
  });

  it('reads the reactions along with the stations', () => {
    const [plan] = reading([at('.spotlight/lines/default.yml')]).plans;

    expect(plan?.reactions).toHaveLength(1);
    expect(plan?.reactions[0]?.to.value).toBe('completed');
  });

  // Which of a repository's files are a team's lines is the configuration's
  // to say. This reads what it is handed.
  it('reads every file it is given, wherever it came from', () => {
    expect(reading([at('somewhere/else.yml')]).plans).toHaveLength(1);
  });

  it('keeps reading past a file that will not', () => {
    const read = reading([
      at('.spotlight/lines/broken.yml', 'version: 1\nkey: broken'),
      at('.spotlight/lines/default.yml'),
    ]);

    expect(read.plans.map((each) => each.key.value)).toEqual(['default']);
    expect(read.problems[0]?.path).toBe('.spotlight/lines/broken.yml');
  });

  // Two files describing one line is a workspace that has to choose.
  it('lets the first by path keep a line two files describe', () => {
    const read = reading([
      at('.spotlight/lines/a.yml'),
      at('.spotlight/lines/z.yml'),
    ]);

    expect(read.plans).toHaveLength(1);
    expect(read.problems[0]?.reason).toMatch(/already described by/);
  });

  describe('writing one back', () => {
    it('writes it where that line is read from', () => {
      expect(new LineReader().write(line()).path).toBe(
        '.spotlight/lines/default.yml',
      );
    });

    // Written and read by one reader, so the two cannot drift apart.
    it('writes something it can read back itself', () => {
      const reader = new LineReader();
      const written = reader.write(line());

      const read = reader.read([written]);

      expect(read.problems).toEqual([]);
      expect(read.plans[0]?.stations.map((each) => each.key.value)).toEqual(
        [...line().stations]
          .sort((one, other) => one.position - other.position)
          .map((each) => each.key.value),
      );
    });
  });
});
