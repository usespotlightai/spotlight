import { compileIntegration } from '@infrastructure/integrations/integration.compile';
import { describe, expect, it } from 'vitest';

const PATH = '.spotlight/integrations/linear.yml';

const VERIFY = `  verify:
    hmac:
      algorithm: sha256
      secret: secret.LINEAR_WEBHOOK_SECRET
      header: linear-signature
`;

const EVENTS = `  events:
    - when: \${{ body.type == "Issue" }}
      raise:
        happening: linear.issue.completed
        label: Issue completed
        told: The issue was moved to Done.
        marks:
          - kind: linear.issue
            value: \${{ body.data.identifier }}
`;

const WHOLE = `version: 1
integration: linear
webhook:
${VERIFY}${EVENTS}`;

/** The same file with the verify block left out, as somebody forgetting it. */
const WITHOUT_VERIFY = `version: 1
integration: linear
webhook:
${EVENTS}`;

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
    expect(read.ok && read.readable.webhook?.verify.kind).toBe('hmac');
  });

  it('collects the secrets the file reads', () => {
    const read = compileIntegration(PATH, WHOLE);

    expect(
      read.ok &&
        read.readable.integration.credentials.map((each) => each.value),
    ).toEqual(['LINEAR_WEBHOOK_SECRET']);
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
        .filter((each) => !each.includes('happening:'))
        .join('\n');

      expect(
        complaining(text, 'webhook.events.0.raise.happening'),
      ).not.toHaveLength(0);
    });

    it('reports everything wrong at once, not the first thing', () => {
      expect(
        problems('version: 2\nintegration: LINEAR').length,
      ).toBeGreaterThan(1);
    });

    // An unsigned endpoint takes anybody's word for what happened, and what
    // happens next is an agent running on it.
    it('refuses a webhook that would verify nothing', () => {
      expect(complaining(WITHOUT_VERIFY, 'webhook.verify')).not.toHaveLength(0);
    });

    it('refuses an algorithm it does not sign by', () => {
      expect(
        complaining(
          WHOLE.replace('algorithm: sha256', 'algorithm: md5'),
          'webhook.verify.hmac.algorithm',
        ),
      ).toHaveLength(1);
    });

    it('refuses a secret named as anything but a secret reference', () => {
      expect(
        complaining(
          WHOLE.replace('secret.LINEAR_WEBHOOK_SECRET', 'my-secret'),
          'webhook.verify.hmac.secret',
        ),
      ).toHaveLength(1);
    });

    it('refuses a source named unlike a source', () => {
      expect(
        complaining(
          WHOLE.replace('integration: linear', 'integration: Linear'),
          'integration',
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
        'webhook.events.0.raise.happening',
      );

      expect(problem?.reason).toMatch(/must begin with linear\./);
    });

    it('refuses an expression that will not parse', () => {
      const [problem] = complaining(
        WHOLE.replace('body.type == "Issue"', 'body.type =='),
        'webhook.events.0.when',
      );

      expect(problem?.reason).toMatch(/body\.type/);
    });

    it('refuses a rule written as anything but an expression', () => {
      expect(
        complaining(
          // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
          WHOLE.replace('${{ body.type == "Issue" }}', 'body.type'),
          'webhook.events.0.when',
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

      expect(complaining(text, 'webhook.events.0.raise')).not.toHaveLength(0);
    });

    it('refuses a file with no trigger at all', () => {
      expect(
        complaining('version: 1\nintegration: linear', 'the file'),
      ).not.toHaveLength(0);
    });

    it('refuses a mark kind that names no source', () => {
      expect(
        complaining(
          WHOLE.replace('kind: linear.issue', 'kind: issue'),
          'webhook.events.0.raise.marks.0.kind',
        ),
      ).toHaveLength(1);
    });

    it('refuses an on-binding to an action that is not defined', () => {
      const text = `${WHOLE}on:
  task.asked:
    do: missing
`;

      expect(complaining(text, 'on.task.asked.do')).toHaveLength(1);
    });
  });

  describe('a polling trigger', () => {
    const POLL = `version: 1
integration: linear
poll:
  every: 60s
  request:
    method: GET
    url: https://api.linear.app/issues
    headers:
      authorization: \${{ "Bearer " + secret.LINEAR_TOKEN }}
  cursor: \${{ body.lastId }}
  events:
    - forEach: \${{ body.issues }}
      when: \${{ item.done }}
      raise:
        happening: linear.issue.completed
        label: Issue completed
        told: The issue was moved to Done.
        marks:
          - kind: linear.issue
            value: \${{ item.id }}
`;

    it('reads the interval as seconds and keeps the request', () => {
      const read = compileIntegration(PATH, POLL);

      expect(read.ok && read.readable.poll?.every).toBe(60);
      expect(read.ok && read.readable.poll?.request.url).toBeDefined();
    });

    it('declares the happening the poll can raise', () => {
      const read = compileIntegration(PATH, POLL);

      expect(
        read.ok &&
          read.readable.integration.declares.map(
            (each) => each.happening.value,
          ),
      ).toEqual(['linear.issue.completed']);
    });

    it('keeps the per-item iteration the poll walks', () => {
      const read = compileIntegration(PATH, POLL);

      expect(read.ok && read.readable.poll?.events[0]?.forEach).toBeDefined();
    });

    it('collects the token the request reads', () => {
      const read = compileIntegration(PATH, POLL);

      expect(
        read.ok &&
          read.readable.integration.credentials.map((each) => each.value),
      ).toEqual(['LINEAR_TOKEN']);
    });
  });

  describe('a schedule trigger', () => {
    const withCron = (cron: string, action = 'digest') => `version: 1
integration: linear
schedule:
  cron: '${cron}'
  do: ${action}
actions:
  digest:
    request:
      method: POST
      url: https://api.linear.app/digest
`;

    it('keeps the cron and the action it runs', () => {
      const read = compileIntegration(PATH, withCron('0 9 * * *'));

      expect(read.ok && read.readable.schedule?.cron).toBe('0 9 * * *');
      expect(read.ok && read.readable.schedule?.action).toBe('digest');
    });

    it('refuses a cron that is not a cron', () => {
      expect(complaining(withCron('not a cron'), 'schedule.cron')).toHaveLength(
        1,
      );
    });

    it('refuses a schedule whose action is not defined', () => {
      expect(
        complaining(withCron('0 9 * * *', 'missing'), 'schedule.do'),
      ).toHaveLength(1);
    });
  });

  describe('an oauth2 connection', () => {
    const WHOLE_OAUTH = `version: 1
integration: slack
connection:
  oauth2:
    authorize: https://slack.com/oauth/authorize
    token: https://slack.com/api/oauth.v2.access
    scopes:
      - chat:write
    identity: \${{ response.team.name }}
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: \${{ true }}
      raise:
        happening: slack.app_mention
        marks:
          - kind: slack.thread
            value: \${{ body.event.ts }}
`;

    it('keeps the endpoints and scopes it links through', () => {
      const read = compileIntegration(PATH, WHOLE_OAUTH);

      expect(read.ok && read.readable.connection?.oauth2?.token).toBe(
        'https://slack.com/api/oauth.v2.access',
      );
      expect(read.ok && read.readable.connection?.oauth2?.scopes).toEqual([
        'chat:write',
      ]);
      expect(
        read.ok && read.readable.connection?.oauth2?.identity,
      ).not.toBeNull();
    });

    it('collects a manually-set secret as a credential', () => {
      const manual = `version: 1
integration: linear
connection:
  manual:
    secrets:
      - secret.LINEAR_TOKEN
poll:
  every: 60s
  request:
    method: GET
    url: https://api.linear.app/issues
  events:
    - when: \${{ true }}
      raise:
        happening: linear.issue.completed
        marks:
          - kind: linear.issue
            value: \${{ body.id }}
`;
      const read = compileIntegration(PATH, manual);

      expect(
        read.ok &&
          read.readable.integration.credentials.map((each) => each.value),
      ).toContain('LINEAR_TOKEN');
    });
  });

  describe('an event that looks up and assigns', () => {
    const WITH_LOOKUP = `version: 1
integration: slack
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: \${{ true }}
      lookup:
        request:
          method: GET
          url: https://slack.com/api/users.info
          query:
            user: \${{ body.event.user }}
          auth:
            token:
              secret: secret.SLACK_BOT_TOKEN
        capture:
          email: \${{ response.user.profile.email }}
      raise:
        happening: slack.app_mention
        opens:
          onto: delivery
          title: \${{ body.event.text }}
          assignBy:
            email: \${{ email }}
        marks:
          - kind: slack.thread
            value: \${{ body.event.ts }}
`;

    it('compiles the lookup request and its captures', () => {
      const read = compileIntegration(PATH, WITH_LOOKUP);
      const lookup = read.ok ? read.readable.webhook?.events[0]?.lookup : null;

      expect(lookup?.request.url).toBeDefined();
      expect(lookup?.capture.map((each) => each.name)).toEqual(['email']);
    });

    it('compiles the email the opened task is assigned by', () => {
      const read = compileIntegration(PATH, WITH_LOOKUP);

      expect(
        read.ok && read.readable.webhook?.events[0]?.raise.opens?.assignBy,
      ).not.toBeNull();
    });

    it('collects the lookup’s token as a credential', () => {
      const read = compileIntegration(PATH, WITH_LOOKUP);

      expect(
        read.ok &&
          read.readable.integration.credentials.map((each) => each.value),
      ).toContain('SLACK_BOT_TOKEN');
    });
  });

  describe('a mark that does not find a task', () => {
    const withAmbient = `version: 1
integration: slack
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: \${{ true }}
      raise:
        happening: slack.app_mention
        opens:
          onto: delivery
          title: \${{ body.event.text }}
        marks:
          - kind: slack.thread
            value: \${{ body.event.ts }}
          - kind: slack.channel
            find: false
            value: \${{ body.event.channel }}
`;

    it('keeps an ambient mark, but not among what finds the task', () => {
      const read = compileIntegration(PATH, withAmbient);
      const marks = read.ok
        ? read.readable.webhook?.events[0]?.raise.marks
        : [];

      expect(marks?.map((each) => `${each.kind.value}:${each.finds}`)).toEqual([
        'slack.thread:true',
        'slack.channel:false',
      ]);
      expect(
        read.ok &&
          read.readable.integration.declares[0]?.finds.map(
            (each) => each.value,
          ),
      ).toEqual(['slack.thread']);
    });

    it('refuses a happening nothing could find a task from', () => {
      const onlyAmbient = `version: 1
integration: slack
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: \${{ true }}
      raise:
        happening: slack.app_mention
        marks:
          - kind: slack.channel
            find: false
            value: \${{ body.event.channel }}
`;

      expect(problems(onlyAmbient)).not.toHaveLength(0);
    });
  });
});
