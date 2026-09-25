import type {
  HeldConfigurationDto,
  HeldResourceDto,
} from '@configuration/application/dto/held-configuration.dto';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const WORKSPACE_ID = '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57';

const DELIVERY = {
  key: 'delivery',
  name: 'Delivery',
  role: 'delivery',
  repositories: [
    { name: 'acme/api', image: 'ghcr.io/acme/api:main', setup: 'npm ci' },
  ],
  runners: ['build-1', 'vpc-internal'],
  stations: [
    {
      key: 'backlog',
      name: 'Backlog',
      kind: 'backlog',
      color: '#a3a8b0',
      diffs: false,
      decisions: false,
      tools: [],
      skills: [],
      passesTo: ['implementation'],
      ends: false,
    },
    {
      key: 'implementation',
      name: 'Implementation',
      kind: 'work',
      color: '#6d78d5',
      harness: 'claude-code',
      profile: 'careful',
      prompt: 'Implement the task.\n\n',
      check: 'npm test',
      runners: ['gpu'],
      diffs: true,
      decisions: true,
      tools: ['linear.comment', 'github.comment', 'catalog.web-search@1.1.0'],
      skills: ['grafana', 'catalog.research@1.0.0'],
      passesTo: [],
      ends: true,
    },
    {
      key: 'completed',
      name: 'Completed',
      kind: 'completed',
      color: '#3fb950',
      diffs: false,
      decisions: false,
      tools: [],
      skills: [],
      passesTo: [],
      ends: false,
    },
  ],
  reactions: [
    {
      happening: 'github.checks.failed',
      from: 'implementation',
      to: 'implementation',
    },
  ],
};

const REVIEW = {
  key: 'review',
  name: 'Review',
  role: 'review',
  repositories: [{ name: 'acme/api' }],
  stations: [
    {
      key: 'backlog',
      name: 'Backlog',
      kind: 'backlog',
      color: '#a3a8b0',
      diffs: false,
      decisions: false,
      tools: [],
      skills: [],
      passesTo: ['code-review'],
      ends: false,
    },
    {
      key: 'code-review',
      name: 'Code review',
      kind: 'work',
      color: '#d29922',
      diffs: false,
      decisions: false,
      tools: [],
      skills: [],
      passesTo: [],
      ends: true,
    },
    {
      key: 'completed',
      name: 'Completed',
      kind: 'completed',
      color: '#3fb950',
      diffs: false,
      decisions: false,
      tools: [],
      skills: [],
      passesTo: [],
      ends: false,
    },
  ],
  reactions: [],
  reviews: {
    start: 'opened',
    mention: '@spotlight',
    skip: {
      spotlight: true,
      drafts: true,
      authors: ['dependabot[bot]', 'renovate[bot]'],
    },
  },
};

const LINEAR = {
  integration: 'linear',
  on: {},
  types: {},
  actions: {
    comment: {
      request: {
        method: 'POST',
        url: 'https://api.linear.app/graphql',
        headers: { 'Content-Type': 'application/json' },
        query: {},
        // biome-ignore lint/suspicious/noTemplateCurlyInString: an integration expression
        body: { query: '${{ inputs.body }}' },
        auth: { secrets: ['secret.LINEAR_API_KEY', 'secret.ELSEWHERE'] },
      },
    },
  },
  webhook: {
    parse: 'json',
    verify: {
      hmac: {
        algorithm: 'sha256',
        secret: 'secret.LINEAR_SIGNING',
        encoding: 'hex',
        prefix: '',
      },
    },
    events: [
      {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: an integration expression
        when: '${{ body.type == "Issue" }}',
        raise: {
          happening: 'linear.issue.completed',
          spoken: false,
          marks: [
            {
              kind: 'linear.issue',
              // biome-ignore lint/suspicious/noTemplateCurlyInString: an integration expression
              value: '${{ body.data.id }}',
              find: true,
            },
          ],
        },
      },
    ],
  },
  tools: {
    comment: {
      does: 'comment',
      description: 'Comment on the issue.\nUse it to say what you did.\n',
      inputs: { body: { type: 'string', required: true, piped: false } },
    },
  },
};

export const HELD: HeldConfigurationDto = {
  workspaceId: WORKSPACE_ID,
  workspaceSlug: 'acme',
  resources: [
    {
      kind: 'workspace',
      id: WORKSPACE_ID,
      address: 'acme',
      slug: 'acme',
      name: 'Acme',
    },
    {
      kind: 'secret',
      heldBy: 'workspace',
      id: 'secret_linear',
      address: 'LINEAR_API_KEY',
      name: 'LINEAR_API_KEY',
      source: { kind: 'built-in', secretId: null, field: null },
      bindings: [
        { host: 'api.linear.app', header: 'authorization', prefix: 'Bearer ' },
      ],
      keepsValue: true,
      valueVersion: 3,
    },
    {
      kind: 'secret',
      heldBy: 'workspace',
      id: 'secret_sentry',
      address: 'SENTRY_TOKEN',
      name: 'SENTRY_TOKEN',
      source: { kind: 'built-in', secretId: null, field: null },
      bindings: [
        { host: 'sentry.io', header: 'authorization', prefix: 'Bearer ' },
      ],
      keepsValue: true,
      valueVersion: null,
    },
    {
      kind: 'secret',
      heldBy: 'workspace',
      id: 'secret_signing',
      address: 'LINEAR_SIGNING',
      name: 'LINEAR_SIGNING',
      source: {
        kind: 'aws-secrets-manager',
        secretId: 'linear/signing',
        field: 'secret',
      },
      bindings: [],
      keepsValue: false,
      valueVersion: null,
    },
    {
      kind: 'runner-trust',
      heldBy: 'workspace',
      id: 'trust_cluster',
      address: 'production-cluster',
      key: 'production-cluster',
      issuer: 'https://oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE',
      subject: 'system:serviceaccount:spotlight:runner',
      audience: 'spotlight',
      labels: ['gpu'],
    },
    {
      kind: 'runner-pool',
      heldBy: 'workspace',
      id: 'pool_burst',
      address: 'burst',
      key: 'burst',
      labels: ['gpu'],
      maxRuns: 4,
      tokenVersion: 2,
      provision: null,
    },
    {
      kind: 'runner-pool',
      heldBy: 'workspace',
      id: 'pool_jobs',
      address: 'k8s-jobs',
      key: 'k8s-jobs',
      labels: [],
      maxRuns: null,
      tokenVersion: null,
      provision: {
        url: 'https://provisioner.acme.dev/runs',
        secretVersion: 1,
      },
    },
    {
      kind: 'workspace-runners',
      heldBy: 'workspace',
      id: 'declared_acme',
      address: 'acme',
      trusts: ['production-cluster'],
      pools: ['burst', 'k8s-jobs', 'retired'],
    },
    {
      kind: 'team',
      heldBy: 'workspace',
      id: 'team_core',
      address: 'core',
      key: 'core',
      name: 'Core',
    },
    {
      kind: 'line',
      heldBy: 'team',
      id: 'line_delivery',
      address: 'core/delivery',
      teamKey: 'core',
      key: 'delivery',
      definition: DELIVERY,
    },
    {
      kind: 'line',
      heldBy: 'team',
      id: 'line_review',
      address: 'core/review',
      teamKey: 'core',
      key: 'review',
      definition: REVIEW,
    },
    {
      kind: 'skill',
      heldBy: 'team',
      id: 'skill_grafana',
      address: 'core/grafana',
      teamKey: 'core',
      key: 'grafana',
      files: {
        'SKILL.md':
          '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch before you guess.\n',
        'queries/latency.promql': 'histogram_quantile(0.99, rate(x[5m]))',
      },
    },
    {
      kind: 'integration',
      heldBy: 'team',
      id: 'integration_linear',
      address: 'core/linear',
      teamKey: 'core',
      source: 'linear',
      definition: LINEAR,
      secretsWorn: [
        {
          path: FieldPath.of([
            'actions',
            'comment',
            'request',
            'auth',
            'secrets',
            0,
          ]),
          name: 'LINEAR_API_KEY',
        },
        {
          path: FieldPath.of([
            'actions',
            'comment',
            'request',
            'auth',
            'secrets',
            1,
          ]),
          name: 'ELSEWHERE',
        },
        {
          path: FieldPath.of(['webhook', 'verify', 'hmac', 'secret']),
          name: 'LINEAR_SIGNING',
        },
      ],
    },
    {
      kind: 'harness-profile',
      heldBy: 'team',
      id: 'profile_careful',
      address: 'core/careful',
      teamKey: 'core',
      key: 'careful',
      permissions: {
        allow: ['read', 'execute(npm test *)'],
        ask: [],
        deny: ['read(.env)'],
      },
      mcpServers: [
        {
          name: 'linear',
          command: 'npx',
          args: ['-y', 'linear-mcp'],
          env: { LINEAR_WORKSPACE: 'acme', LOG_LEVEL: 'debug' },
        },
      ],
      native: { 'claude-code': { includeCoAuthoredBy: false } },
    },
    {
      kind: 'team',
      heldBy: 'workspace',
      id: 'team_3d',
      address: '3d',
      key: '3d',
      name: 'Three D',
    },
  ],
};

export const heldAs = <K extends HeldResourceDto['kind']>(
  kind: K,
  address?: string,
): Extract<HeldResourceDto, { kind: K }> => {
  const held = HELD.resources.find(
    (each): each is Extract<HeldResourceDto, { kind: K }> =>
      each.kind === kind && (address === undefined || each.address === address),
  );

  if (!held) {
    throw new Error(`no ${kind} held`);
  }

  return held;
};
