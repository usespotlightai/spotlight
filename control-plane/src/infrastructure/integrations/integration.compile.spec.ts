import { compileIntegration } from '@infrastructure/integrations/integration.compile';
import { describe, expect, it } from 'vitest';

const PATH = '.spotlight/integrations/linear.yml';

const WHOLE = `
version: 1
source: linear
verify:
  scheme: hmac-sha256
  header: linear-signature
  secret: LINEAR_WEBHOOK_SECRET
happenings:
  - happening: linear.issue.completed
    label: Issue completed
    told: The issue was moved to Done.
    when: \${{ body.type == "Issue" }}
    concerns:
      marks:
        - kind: linear.issue
          value: \${{ body.data.identifier }}
`;

/** The same file with one block left out, the way somebody forgetting it. */
const WITHOUT_VERIFY = WHOLE.split('\n')
  .filter((each) => !/^verify:|^ {2}(scheme|header|secret):/.test(each))
  .join('\n');

const problems = (text: string) => {
  const read = compileIntegration(PATH, text);

  return read.ok ? [] : read.problems;
};

const complaining = (text: string, about: string) =>
  problems(text).filter((each) => each.at.includes(about));

describe('compiling an integration', () => {
  it('compiles one that is whole', () => {
    const read = compileIntegration(PATH, WHOLE);

    expect(read.ok).toBe(true);
    expect(read.ok && read.readable.integration.source.value).toBe('linear');
    expect(read.ok && read.readable.integration.declares).toHaveLength(1);
  });

  it('calls it by its source where the file gives no name', () => {
    const read = compileIntegration(PATH, WHOLE);

    expect(read.ok && read.readable.integration.name).toBe('linear');
  });

  describe('says what is wrong, where it is', () => {
    it('names the file that will not parse as YAML', () => {
      const [problem] = problems('version: 1\n  bad: [indent');

      expect(problem?.path).toBe(PATH);
      expect(problem?.reason).toMatch(/is not YAML/);
    });

    it('points at the field, the way a person would', () => {
      const text = WHOLE.split('\n')
        .filter((each) => !each.includes('label:'))
        .join('\n');

      expect(complaining(text, 'happenings.0.label')).toHaveLength(1);
    });

    it('reports everything wrong at once, not the first thing', () => {
      expect(problems('version: 2\nsource: LINEAR').length).toBeGreaterThan(1);
    });

    // An unsigned endpoint takes anybody's word for what happened, and what
    // happens next is an agent running on it.
    it('refuses a file that would verify nothing', () => {
      const [problem] = complaining(WITHOUT_VERIFY, 'verify');

      expect(problem?.reason).toMatch(/no way to say it does not/);
    });

    it('refuses a scheme it does not sign by', () => {
      expect(
        complaining(WHOLE.replace('hmac-sha256', 'md5'), 'verify.scheme'),
      ).toHaveLength(1);
    });

    it('refuses a secret named as anything but a secret', () => {
      expect(
        complaining(
          WHOLE.replace('LINEAR_WEBHOOK_SECRET', 'my-secret'),
          'verify.secret',
        ),
      ).toHaveLength(1);
    });

    it('refuses a source named unlike a source', () => {
      expect(
        complaining(
          WHOLE.replace('source: linear', 'source: Linear'),
          'source',
        ),
      ).toHaveLength(1);
    });

    it('refuses a version it does not know', () => {
      expect(
        complaining(WHOLE.replace('version: 1', 'version: 2'), 'version'),
      ).toHaveLength(1);
    });

    // A file raising another host's words would have stations waiting on
    // something this source never says.
    it('refuses a word named for another source', () => {
      const [problem] = complaining(
        WHOLE.replace('linear.issue.completed', 'github.issue.completed'),
        'happenings.0.happening',
      );

      expect(problem?.reason).toMatch(/must begin with linear\./);
    });

    it('refuses a word that names no source at all', () => {
      expect(
        complaining(
          WHOLE.replace('linear.issue.completed', 'completed'),
          'happenings.0.happening',
        ),
      ).not.toHaveLength(0);
    });

    it('refuses an expression that will not parse', () => {
      const [problem] = complaining(
        WHOLE.replace('body.type == "Issue"', 'body.type =='),
        'happenings.0.when',
      );

      expect(problem?.reason).toMatch(/body\.type/);
    });

    it('refuses a rule written as anything but an expression', () => {
      expect(
        complaining(
          // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
          WHOLE.replace('${{ body.type == "Issue" }}', 'body.type'),
          'happenings.0.when',
        ),
      ).toHaveLength(1);
    });

    // A word about nothing is a file somebody is still writing.
    it('refuses a rule that could never find a task', () => {
      const text = WHOLE.split('\n')
        .filter(
          (each) =>
            !each.includes('marks:') &&
            !each.includes('kind:') &&
            !each.includes('value:'),
        )
        .join('\n');

      expect(complaining(text, 'happenings.0.concerns')).toHaveLength(1);
    });

    it('refuses one raising no words at all', () => {
      expect(
        complaining('version: 1\nsource: linear\nhappenings: []', 'happenings'),
      ).not.toHaveLength(0);
    });

    it('refuses a mark kind that names no source', () => {
      expect(
        complaining(
          WHOLE.replace('kind: linear.issue', 'kind: issue'),
          'happenings.0.concerns.marks.0.kind',
        ),
      ).toHaveLength(1);
    });
  });
});
