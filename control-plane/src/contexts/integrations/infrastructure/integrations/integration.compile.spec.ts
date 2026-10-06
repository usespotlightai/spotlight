import {
  compileIntegration,
  IntegrationCompiler,
} from '@integrations/infrastructure/integrations/integration.compile';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

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

const WHOLE = `integration: linear
webhook:
${VERIFY}${EVENTS}`;

const WITHOUT_VERIFY = `integration: linear
webhook:
${EVENTS}`;

const problems = (text: string) => {
  const read = compileIntegration(parseYaml(text), expressions);

  return read.ok ? [] : read.problems;
};

const complaining = (text: string, about: string) =>
  problems(text).filter((each) =>
    (dottedOf(each.field) ?? '').startsWith(about),
  );

describe('compiling an integration', () => {
  it('compiles one that is whole', () => {
    const read = compileIntegration(parseYaml(WHOLE), expressions);

    expect(read.ok).toBe(true);
    expect(read.ok && read.readable.integration.source.value).toBe('linear');
    expect(read.ok && read.readable.integration.declares).toHaveLength(1);
    expect(read.ok && read.readable.webhook?.verify.kind).toBe('hmac');
  });

  it('collects the secrets the file reads', () => {
    const read = compileIntegration(parseYaml(WHOLE), expressions);

    expect(
      read.ok &&
        read.readable.integration.credentials.map((each) => each.value),
    ).toEqual(['LINEAR_WEBHOOK_SECRET']);
  });

  it('calls it by its source where the file gives no name', () => {
    const read = compileIntegration(parseYaml(WHOLE), expressions);

    expect(read.ok && read.readable.integration.name).toBe('linear');
  });

  describe('says what is wrong, where it is', () => {
    it('names the integration a problem is in', () => {
      const [problem] = problems(WITHOUT_VERIFY);

      expect(problem?.path).toBe('integrations/linear');
    });

    it('names the integrations themselves where it cannot tell which', () => {
      const [problem] = problems('integration: LINEAR');

      expect(problem?.path).toBe('integrations');
    });

    it('refuses to address a host as catalog, which names Spotlight’s catalog', () => {
      expect(
        complaining(
          WHOLE.replace('integration: linear', 'integration: catalog'),
          'integration',
        ),
      ).not.toHaveLength(0);
    });

    it('refuses what is not an integration at all', () => {
      expect(compileIntegration('linear', expressions)).toMatchObject({
        ok: false,
        problems: [{ path: 'integrations', field: FieldPath.root() }],
      });
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
      expect(problems("integration: LINEAR\nname: ''").length).toBeGreaterThan(
        1,
      );
    });

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

    it('refuses a word named for another source', () => {
      const [problem] = complaining(
        WHOLE.replace('linear.issue.completed', 'github.issue.completed'),
        'webhook.events.0.raise.happening',
      );

      expect(problem?.reason).toMatch(/without the linear\. prefix/);
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

    it('refuses an integration with no trigger at all', () => {
      expect(complaining('integration: linear', '')).not.toHaveLength(0);
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

    it('refuses an on-binding to an event Spotlight never raises', () => {
      const text = `${WHOLE}actions:
  post:
    request:
      url: https://example.com
on:
  task.moved:
    do: post
`;

      const [problem] = problems(text).filter(
        (each) => dottedOf(each.field) === 'on.task.moved',
      );

      expect(problem?.reason).toMatch(/must be one of/);
    });
  });

  describe('a polling trigger', () => {
    const POLL = `integration: linear
poll:
  every: 60s
  request:
    method: GET
    url: https://api.linear.app/issues
    auth:
      secrets: [secret.LINEAR_TOKEN]
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
      const read = compileIntegration(parseYaml(POLL), expressions);

      expect(read.ok && read.readable.integration.poll?.every).toBe(60);
      expect(read.ok && read.readable.poll?.request.url).toBeDefined();
    });

    it('declares the happening the poll can raise', () => {
      const read = compileIntegration(parseYaml(POLL), expressions);

      expect(
        read.ok &&
          read.readable.integration.declares.map(
            (each) => each.happening.value,
          ),
      ).toEqual(['linear.issue.completed']);
    });

    it('keeps the per-item iteration the poll walks', () => {
      const read = compileIntegration(parseYaml(POLL), expressions);

      expect(read.ok && read.readable.poll?.events[0]?.forEach).toBeDefined();
    });

    it('collects the token the request reads', () => {
      const read = compileIntegration(parseYaml(POLL), expressions);

      expect(
        read.ok &&
          read.readable.integration.credentials.map((each) => each.value),
      ).toEqual(['LINEAR_TOKEN']);
    });
  });

  describe('a schedule trigger', () => {
    const withCron = (cron: string, action = 'digest') => `integration: linear
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
      const read = compileIntegration(
        parseYaml(withCron('0 9 * * *')),
        expressions,
      );

      expect(read.ok && read.readable.integration.schedule?.cron.value).toBe(
        '0 9 * * *',
      );
      expect(read.ok && read.readable.integration.schedule?.does).toBe(
        'digest',
      );
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
    const WHOLE_OAUTH = `integration: slack
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
      const read = compileIntegration(parseYaml(WHOLE_OAUTH), expressions);

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
      const manual = `integration: linear
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
      const read = compileIntegration(parseYaml(manual), expressions);

      expect(
        read.ok &&
          read.readable.integration.credentials.map((each) => each.value),
      ).toContain('LINEAR_TOKEN');
    });
  });

  describe('an event that looks up and assigns', () => {
    const WITH_LOOKUP = `integration: slack
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
            secrets: [secret.SLACK_BOT_TOKEN]
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
      const read = compileIntegration(parseYaml(WITH_LOOKUP), expressions);
      const lookup = read.ok ? read.readable.webhook?.events[0]?.lookup : null;

      expect(lookup?.request.url).toBeDefined();
      expect(lookup?.capture.map((each) => each.name)).toEqual(['email']);
    });

    it('compiles the email the opened task is assigned by', () => {
      const read = compileIntegration(parseYaml(WITH_LOOKUP), expressions);

      expect(
        read.ok && read.readable.webhook?.events[0]?.raise.opens?.assignBy,
      ).not.toBeNull();
    });

    it('collects the lookup’s token as a credential', () => {
      const read = compileIntegration(parseYaml(WITH_LOOKUP), expressions);

      expect(
        read.ok &&
          read.readable.integration.credentials.map((each) => each.value),
      ).toContain('SLACK_BOT_TOKEN');
    });
  });

  describe('a mark that does not find a task', () => {
    const withAmbient = `integration: slack
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
      const read = compileIntegration(parseYaml(withAmbient), expressions);
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
      const onlyAmbient = `integration: slack
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

  describe('an expression that does not check against what it may read', () => {
    const warnings = (text: string) => {
      const read = compileIntegration(parseYaml(text), expressions);

      return read.ok
        ? read.warnings
        : read.problems.filter((each) => each.isWarning);
    };

    const BINDING = `${WHOLE}actions:
  post:
    request:
      method: POST
      url: https://hooks.example.com/post
      body: '\${{ {"text": ask.body, "thread": target.thread} }}'
on:
  task.asked:
    do: post
    to:
      thread: \${{ task.marks["slack.thread"] }}
`;

    it('has nothing to say about one that reads only what is there', () => {
      expect(warnings(BINDING)).toEqual([]);
    });

    it('warns about a misspelled field, and still compiles', () => {
      const text = BINDING.replace('task.marks', 'task.makrs');
      const read = compileIntegration(parseYaml(text), expressions);

      expect(read.ok).toBe(true);
      expect(warnings(text)).toHaveLength(1);
      expect(warnings(text)[0]?.field.rendered).toBe(
        'on["task.asked"].to.thread',
      );
      expect(warnings(text)[0]?.reason).toMatch(
        /No such key: makrs; did you mean task\.marks\?/,
      );
    });

    it('suggests the name that is there nearest one that is not', () => {
      const [warning] = warnings(BINDING.replace('ask.body', 'asked.body'));

      expect(dottedOf(warning?.field)).toBe('actions.post.request.body');
      expect(warning?.reason).toMatch(
        /Unknown variable: asked; did you mean ask\?/,
      );
    });

    it('warns about a rule that does not say yes or no', () => {
      const [warning] = warnings(
        WHOLE.replace('body.type == "Issue"', '"Issue"'),
      );

      expect(dottedOf(warning?.field)).toBe('webhook.events.0.when');
      expect(warning?.reason).toBe(
        'does not check: must return a bool, not a string',
      );
    });

    it('lets a rule that walks a list read each item, and nothing else', () => {
      const list = WHOLE.replace(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
        '    - when: ${{ body.type == "Issue" }}',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
        '    - forEach: ${{ body.issues }}\n      when: ${{ item.done }}',
      );

      expect(warnings(list)).toEqual([]);
      expect(warnings(WHOLE.replace('body.type', 'item.type'))).toHaveLength(1);
    });

    it('warns, at the capture, where a lookup capture shadows a built-in name', () => {
      const shadowing = WHOLE.replace(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
        '    - when: ${{ body.type == "Issue" }}',
        `    - when: \${{ body.type == "Issue" }}
      lookup:
        request:
          url: https://api.linear.app/graphql
        capture:
          body: \${{ response.data }}
          issue: \${{ response.issue }}`,
      );

      expect(
        warnings(shadowing).map((each) => ({
          at: each.field.rendered,
          reason: each.reason,
        })),
      ).toEqual([
        {
          at: 'webhook.events[0].lookup.capture.body',
          reason: 'shadows the built-in body',
        },
      ]);
    });

    it('warns about a raised word reading a name no lookup kept', () => {
      expect(
        warnings(
          WHOLE.replace(
            // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
            'value: ${{ body.data.identifier }}',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
            'value: ${{ email }}',
          ),
        ),
      ).toHaveLength(1);
    });
  });
});

describe('a request written out', () => {
  const ACTION = `integration: demo
actions:
  post:
    request:
      method: POST
      url: https://hooks.example.com/\${{ target.channel }}/messages
      headers:
        x-line: line-\${{ task.line }}
      auth:
        secrets: [secret.DEMO_TOKEN, secret.DEMO_TOKEN]
      body:
        text: '\${{ ask.body }}'
        thread: '\${{ target.thread }}'
        unfurl: false
        tags: [queue, '\${{ task.line }}']
`;

  const request = (text: string) => {
    const read = compileIntegration(parseYaml(text), expressions);

    return read.ok ? read.readable.actions.get('post') : undefined;
  };

  it('reads each piece into a string, around the text it sits in', () => {
    expect(request(ACTION)?.url.parts).toHaveLength(3);
    expect(request(ACTION)?.headers[0]?.value.parts).toHaveLength(2);
  });

  it('collects each secret the request wears, once', () => {
    const read = compileIntegration(parseYaml(ACTION), expressions);

    expect(
      read.ok &&
        read.readable.integration.credentials.map((each) => each.value),
    ).toEqual(['DEMO_TOKEN']);
    expect(request(ACTION)?.auth).toEqual({
      kind: 'secrets',
      secrets: ['DEMO_TOKEN'],
    });
  });

  it('refuses a request that reads a secret’s value, rather than wearing it', () => {
    const read = compileIntegration(
      parseYaml(
        ACTION.replace(
          'x-line: line-',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own expression syntax
          'authorization: Bearer ${{ secret.DEMO_TOKEN }}\n        x-line: line-',
        ),
      ),
      expressions,
    );

    expect(read.ok).toBe(false);
    expect(
      !read.ok && read.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['actions.post.request.headers.authorization']);
    expect(!read.ok && read.problems[0]?.reason).toMatch(/auth\.secrets/);
  });

  it('refuses a request that authenticates by a token it would have to read', () => {
    const read = compileIntegration(
      parseYaml(
        ACTION.replace(
          'secrets: [secret.DEMO_TOKEN, secret.DEMO_TOKEN]',
          'token:\n          secret: secret.DEMO_TOKEN',
        ),
      ),
      expressions,
    );

    expect(read.ok).toBe(false);
  });

  it('keeps a body written as a map as the map it is', () => {
    const body = request(ACTION)?.body;

    expect(body?.kind).toBe('map');
    expect(
      body?.kind === 'map' && body.entries.map((each) => each.key),
    ).toEqual(['text', 'thread', 'unfurl', 'tags']);
  });

  it('checks each piece of the body where it sits', () => {
    const read = compileIntegration(
      parseYaml(ACTION.replace('ask.body', 'ask.boddy')),
      expressions,
    );

    expect(
      read.ok && read.warnings.map((each) => dottedOf(each.field)),
    ).toEqual(['actions.post.request.body.text']);
  });
});

describe('the tools an integration offers', () => {
  const OFFERING = `integration: linear
actions:
  comment:
    request:
      method: POST
      url: https://api.linear.app/graphql
      auth:
        secrets: [secret.LINEAR_API_KEY]
      body:
        query: 'mutation($id: String!, $body: String!) { commentCreate(input: { issueId: $id, body: $body }) { comment { url } } }'
        variables:
          id: '\${{ inputs.issue }}'
          body: '\${{ inputs.body }}'
      capture:
        url: '\${{ response.data.commentCreate.comment.url }}'
tools:
  comment:
    does: comment
    description: Comment on the Linear issue this task came from.
    inputs:
      issue:
        default: '\${{ task.marks["linear.issue"] }}'
      body:
        required: true
        piped: true
    output: '\${{ capture.url }}'
`;

  const read = (text: string) =>
    compileIntegration(parseYaml(text), expressions);

  it('offers each as a tool named for the integration, with what it takes', () => {
    const compiled = read(OFFERING);
    const offered = compiled.ok
      ? compiled.readable.integration.offers.find(
          (each) => each.tool === 'linear.comment',
        )
      : undefined;

    expect(compiled.ok && compiled.warnings).toEqual([]);
    expect(offered?.description).toBe(
      'Comment on the Linear issue this task came from.',
    );
    expect(
      offered?.inputs.map((each) => [
        each.name,
        each.required,
        each.defaulted,
        each.piped,
      ]),
    ).toEqual([
      ['issue', false, true, false],
      ['body', true, false, true],
    ]);
  });

  it('keeps the action it runs, and what it answers with', () => {
    const compiled = read(OFFERING);
    const tool = compiled.ok
      ? compiled.readable.tools.get('comment')
      : undefined;

    expect(
      compiled.ok &&
        compiled.readable.integration.offered('linear.comment')?.does,
    ).toBe('comment');
    expect(tool?.output).not.toBeNull();
    expect(tool?.inputs[0]?.default?.parts).toHaveLength(1);
  });

  it('checks what an action reads of its tools’ inputs', () => {
    const compiled = read(OFFERING.replace('inputs.body', 'inputs.bdy'));

    expect(
      compiled.ok && compiled.warnings.map((each) => dottedOf(each.field)),
    ).toEqual(['actions.comment.request.body.variables.body']);
  });

  it('refuses a tool whose action is not defined', () => {
    expect(
      complaining(
        OFFERING.replace('does: comment', 'does: missing'),
        'tools.comment.does',
      ),
    ).toHaveLength(1);
  });

  it('offers a tool no approval where the file asks for none', () => {
    const compiled = read(OFFERING);

    expect(
      compiled.ok &&
        compiled.readable.integration.offered('linear.comment')?.approval,
    ).toBeNull();
  });

  it('reads the approval a tool may only run with, and why', () => {
    const compiled = read(
      OFFERING.replace(
        '    does: comment\n',
        '    does: comment\n    approval:\n      because: It posts publicly, under the team’s name.\n',
      ),
    );

    expect(compiled.ok && compiled.warnings).toEqual([]);
    expect(
      compiled.ok &&
        compiled.readable.integration.offered('linear.comment')?.approval
          ?.because,
    ).toBe('It posts publicly, under the team’s name.');
  });

  it('refuses an approval that says nothing about why', () => {
    expect(
      problems(
        OFFERING.replace(
          '    does: comment\n',
          '    does: comment\n    approval:\n      because: "  "\n',
        ),
      ),
    ).not.toEqual([]);
  });

  it('refuses a tool that does not say what it is for', () => {
    expect(
      problems(
        OFFERING.replace(
          '    description: Comment on the Linear issue this task came from.\n',
          '',
        ),
      ).map((each) => dottedOf(each.field)),
    ).toContain('tools.comment.description');
  });
});

describe('type hints', () => {
  const HINTED = `integration: linear
types:
  Issue:
    identifier: string
    assignee: User
    labels: list<string>
  User:
    email: string
webhook:
  verify:
    hmac:
      secret: secret.LINEAR_WEBHOOK_SECRET
      header: linear-signature
  shape:
    type: string
    data: Issue
  events:
    - when: \${{ body.type == "Issue" && "bug" in body.data.labels }}
      raise:
        happening: linear.issue.completed
        marks:
          - kind: linear.issue
            value: \${{ body.data.identifier }}
actions:
  assignee:
    request:
      method: GET
      url: https://api.linear.app/assignee
      response:
        data:
          user: User
      capture:
        email: '\${{ response.data.user.email }}'
`;

  const warnings = (text: string) => {
    const read = compileIntegration(parseYaml(text), expressions);

    return read.ok
      ? read.warnings
      : read.problems.filter((each) => each.isWarning);
  };

  it('has nothing to say where what is read is what the hints say, in whatever order they are written', () => {
    expect(warnings(HINTED)).toEqual([]);
  });

  it('finds a misspelling of what a delivery’s shape says, where it is written', () => {
    const [warning] = warnings(
      HINTED.replace('body.data.identifier', 'body.data.identifer'),
    );

    expect(dottedOf(warning?.field)).toBe(
      'webhook.events.0.raise.marks.0.value',
    );
    expect(warning?.reason).toMatch(/No such key: identifer/);
  });

  it('finds a misspelling of what a response is said to be', () => {
    expect(
      warnings(
        HINTED.replace('response.data.user.email', 'response.data.user.emial'),
      ).map((each) => dottedOf(each.field)),
    ).toEqual(['actions.assignee.request.capture.email']);
  });

  it('says a type it does not know, and checks nothing against the hints', () => {
    const text = HINTED.replace('email: string', 'email: strng').replace(
      'body.data.identifier',
      'body.data.identifer',
    );

    expect(warnings(text).map((each) => dottedOf(each.field))).toEqual([
      'types.User.email',
    ]);
  });

  it('says where types name each other round', () => {
    expect(
      warnings(
        HINTED.replace('email: string', 'email: string\n    boss: Issue'),
      ).map((each) => dottedOf(each.field)),
    ).toContain('types.Issue');
  });

  it('still compiles a file whose hints are wrong', () => {
    expect(
      compileIntegration(
        parseYaml(HINTED.replace('email: string', 'email: strng')),
        expressions,
      ).ok,
    ).toBe(true);
  });
});

describe('IntegrationCompiler', () => {
  it('hands back the integration with the definition it was compiled from', () => {
    const compiled = new IntegrationCompiler(expressions).compile(
      parseYaml(WHOLE),
    );

    expect(compiled.ok && compiled.integration.source.value).toBe('linear');
    expect(compiled.ok && compiled.document.says('integration', 'linear')).toBe(
      true,
    );
  });

  it('says what is wrong with one that will not compile', () => {
    expect(
      new IntegrationCompiler(expressions).compile({ integration: 'linear' }),
    ).toMatchObject({ ok: false, problems: [{ path: 'integrations/linear' }] });
  });
});
