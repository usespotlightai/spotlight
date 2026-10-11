import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import { TeamIntegrations } from '@integrations/infrastructure/acl/team-integrations.adapter';
import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsHolding } from '@integrations/integrations.documents.fake-spec';
import { InMemoryLearnedOutputs } from '@integrations/integrations.learned.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const SLACK = `
integration: slack
name: Slack
onboarding:
  try: Mention @spotlight in any channel.
  heard: Message received
  link:
    label: Open Slack
    url: https://app.slack.com
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: '\${{ true }}'
      raise:
        happening: slack.app_mention
        marks:
          - kind: slack.thread
            value: '\${{ body.event.ts }}'
        opens:
          onto: delivery
          title: '\${{ body.event.text }}'
`;

const LINEAR = `
integration: linear
name: Linear
poll:
  every: 60s
  request:
    method: GET
    url: https://api.linear.app/issues
  events:
    - when: '\${{ true }}'
      raise:
        happening: linear.issue_assigned
        marks:
          - kind: linear.issue
            value: '\${{ item.id }}'
        opens:
          onto: delivery
          at: triage
          title: '\${{ item.title }}'
`;

const SENTRY = `
integration: sentry
webhook:
  verify:
    token:
      secret: secret.SENTRY_SECRET
  events:
    - when: '\${{ true }}'
      raise:
        happening: sentry.issue
        marks:
          - kind: sentry.issue
            value: '\${{ body.id }}'
`;

const opening = (...configs: readonly string[]) =>
  new TeamIntegrations(
    {
      ofTeam: async () => configs.map((each) => defined(each)),
    } as unknown as DefinedIntegrationsPort,
    new IntegrationReader(new CelExpressionEngine(), operationsHolding()),
    new InMemoryLearnedOutputs(),
  ).opening(TeamId.of('team_1'));

describe('the integrations that open tasks for a team', () => {
  it('are those with an event that opens a task, by webhook or by poll', async () => {
    const sources = await opening(SLACK, LINEAR, SENTRY);

    expect(sources.map((each) => each.source)).toEqual(['slack', 'linear']);
  });

  it('say how to try them, as the integration words it', async () => {
    const [slack] = await opening(SLACK);

    expect(slack).toEqual({
      source: 'slack',
      name: 'Slack',
      tryIt: 'Mention @spotlight in any channel.',
      heard: 'Message received',
      link: { label: 'Open Slack', url: 'https://app.slack.com' },
    });
  });

  it('leave the wording to Spotlight where the integration gives none', async () => {
    const [linear] = await opening(LINEAR);

    expect(linear).toMatchObject({ tryIt: null, heard: null, link: null });
  });

  it('refuses a link that is not https, so the setup task shows none of another scheme', () => {
    for (const url of ['javascript:alert(1)', 'http://app.slack.com']) {
      const compiled = compileIntegration(
        parse(SLACK.replace('https://app.slack.com', url)),
        new CelExpressionEngine(),
      );

      expect(compiled.ok).toBe(false);
    }
  });
});
