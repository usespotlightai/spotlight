import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { describe, expect, it } from 'vitest';

const WHOLE = `
version: 1
integration: linear
webhook:
  verify:
    hmac:
      algorithm: sha256
      secret: secret.LINEAR_WEBHOOK_SECRET
      header: linear-signature
  events:
    - when: \${{ body.type == "Issue" }}
      raise:
        happening: linear.issue.completed
        label: Issue completed
        told: The issue was moved to Done.
        marks:
          - kind: linear.issue
            value: \${{ body.data.identifier }}
`;

const at = (path: string, text = WHOLE) => ConfigurationFile.of(path, text);

const reading = (files: ConfigurationFile[]) =>
  new IntegrationReader().read(files);

describe('IntegrationReader', () => {
  it('reads every integration a workspace wrote', () => {
    const read = reading([
      at('.spotlight/teams/platform/integrations/linear.yml'),
    ]);

    expect(read.integrations.map((each) => each.source)).toEqual(['linear']);
    expect(read.problems).toEqual([]);
  });

  it('reads one written as .yaml just the same', () => {
    expect(
      reading([at('.spotlight/teams/platform/integrations/linear.yaml')])
        .integrations,
    ).toHaveLength(1);
  });

  it('reads every file it is given, wherever it came from', () => {
    expect(reading([at('somewhere/else.yml')]).integrations).toHaveLength(1);
  });

  it('keeps reading past a file that will not', () => {
    const read = reading([
      at('.spotlight/teams/platform/integrations/broken.yml', 'version: 2'),
      at('.spotlight/teams/platform/integrations/linear.yml'),
    ]);

    expect(read.integrations.map((each) => each.source)).toEqual(['linear']);
    expect(read.problems).not.toHaveLength(0);
    expect(read.problems[0]?.path).toBe(
      '.spotlight/teams/platform/integrations/broken.yml',
    );
  });

  it('lets the first by path keep a host two files claim', () => {
    const read = reading([
      at('.spotlight/teams/platform/integrations/a-linear.yml'),
      at('.spotlight/teams/platform/integrations/z-linear.yml'),
    ]);

    expect(read.integrations).toHaveLength(1);
    expect(read.problems).toHaveLength(1);
    expect(read.problems[0]?.path).toBe(
      '.spotlight/teams/platform/integrations/z-linear.yml',
    );
    expect(read.problems[0]?.reason).toMatch(/already declared by/);
  });

  it('says so rather than quietly dropping the one that lost', () => {
    const read = reading([
      at('.spotlight/teams/platform/integrations/a-linear.yml'),
      at('.spotlight/teams/platform/integrations/z-linear.yml'),
    ]);

    expect(read.problems[0]?.reason).toContain(
      '.spotlight/teams/platform/integrations/a-linear.yml',
    );
  });

  it('reads nothing at all from nothing at all', () => {
    expect(reading([])).toEqual({ integrations: [], problems: [] });
  });
});
