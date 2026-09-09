import { SourceKey } from '@domain/value-objects/source-key.vo';

/**
 * A host Spotlight can write a starting file for. The `when` rules are what
 * each host's documentation describes: a starting point rather than a promise,
 * and the file is where that is fixed.
 */
export interface KnownTool {
  readonly source: SourceKey;
  readonly name: string;
  readonly summary: string;
  readonly secretCalled: string;
  readonly file: string;
}

const linear = `version: 1
integration: linear
name: Linear

webhook:
  verify:
    hmac:
      secret: secret.LINEAR_WEBHOOK_SECRET
      header: linear-signature
  delivery: \${{ headers["linear-delivery"] }}
  events:
    - when: \${{ body.type == "Issue" && body.action == "create" }}
      raise:
        happening: linear.issue.created
        label: Issue created
        told: A new issue was filed in Linear.
        opens:
          onto: delivery
          title: \${{ body.data.title }}
          description: \${{ body.data.description }}
        marks:
          - kind: linear.issue
            value: \${{ body.data.identifier }}

    - when: \${{ body.type == "Issue" && body.data.state.type == "completed" }}
      raise:
        happening: linear.issue.completed
        label: Issue completed
        told: The issue was moved to Done.
        marks:
          - kind: linear.issue
            value: \${{ body.data.identifier }}

    - when: \${{ body.type == "Comment" }}
      raise:
        happening: linear.issue.commented
        label: Issue commented on
        told: Somebody commented on the issue.
        spoken: true
        marks:
          - kind: linear.issue
            value: \${{ body.data.issue.identifier }}
`;

const sentry = `version: 1
integration: sentry
name: Sentry

webhook:
  verify:
    hmac:
      secret: secret.SENTRY_WEBHOOK_SECRET
      header: sentry-hook-signature
  events:
    - when: \${{ body.action == "created" || body.action == "unresolved" }}
      raise:
        happening: sentry.issue.regressed
        label: Issue regressed
        told: Sentry says this went wrong again.
        marks:
          - kind: sentry.issue
            value: \${{ body.data.issue.id }}
`;

const grafana = `version: 1
integration: grafana
name: Grafana

webhook:
  verify:
    hmac:
      secret: secret.GRAFANA_WEBHOOK_SECRET
      header: x-grafana-signature
  events:
    - when: \${{ body.status == "firing" }}
      raise:
        happening: grafana.alert.firing
        label: Alert firing
        told: An alert is firing.
        marks:
          - kind: grafana.alert
            value: \${{ body.commonLabels.alertname }}
`;

const pagerduty = `version: 1
integration: pagerduty
name: PagerDuty

webhook:
  verify:
    hmac:
      secret: secret.PAGERDUTY_WEBHOOK_SECRET
      header: x-pagerduty-signature
      prefix: 'v1='
  events:
    - when: \${{ body.event.event_type == "incident.triggered" }}
      raise:
        happening: pagerduty.incident.triggered
        label: Incident triggered
        told: An incident was raised.
        marks:
          - kind: pagerduty.incident
            value: \${{ body.event.data.id }}
`;

const slack = `version: 1
integration: slack
name: Slack

webhook:
  verify:
    hmac:
      secret: secret.SLACK_SIGNING_SECRET
      header: x-slack-signature
      signed: '\${{ "v0:" + headers["x-slack-request-timestamp"] + ":" + raw }}'
      prefix: 'v0='
      freshness:
        at: '\${{ headers["x-slack-request-timestamp"] }}'
        within: 300s
  respond:
    when: '\${{ body.type == "url_verification" }}'
    body: '\${{ body.challenge }}'
  mine: '\${{ body.event.bot_id != null }}'
  events:
    - when: '\${{ body.event.type == "app_mention" }}'
      lookup:
        request:
          method: GET
          url: https://slack.com/api/users.info
          query:
            user: '\${{ body.event.user }}'
          auth:
            token:
              secret: secret.SLACK_BOT_TOKEN
          expect:
            success: '\${{ response.ok }}'
        capture:
          email: '\${{ response.user.profile.email }}'
      raise:
        happening: slack.app_mention
        label: Mentioned in Slack
        told: Somebody mentioned Spotlight in Slack.
        opens:
          onto: delivery
          title: '\${{ body.event.text }}'
          assignBy:
            email: '\${{ email }}'
        marks:
          - kind: slack.thread
            value: '\${{ body.event.ts }}'
          - kind: slack.channel
            value: '\${{ body.event.channel }}'

actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        authorization: '\${{ "Bearer " + secret.SLACK_BOT_TOKEN }}'
      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": ask.body} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ response.ts }}'

on:
  task.asked:
    do: post-message
    to:
      channel: '\${{ task.marks["slack.channel"] }}'
      thread: '\${{ task.marks["slack.thread"] }}'
    routes:
      delivery: C0DELIVERY
    mark:
      - kind: slack.thread
        value: '\${{ capture.thread }}'
`;

const known = (input: {
  source: string;
  name: string;
  summary: string;
  secretCalled: string;
  file: string;
}): KnownTool => ({
  source: SourceKey.of(input.source),
  name: input.name,
  summary: input.summary,
  secretCalled: input.secretCalled,
  file: input.file,
});

export const KNOWN_TOOLS: readonly KnownTool[] = [
  known({
    source: 'slack',
    name: 'Slack',
    summary:
      'Turn a mention into a task, and answer its questions in the thread.',
    secretCalled:
      'the app’s Signing Secret, and a Bot User OAuth token to reply with',
    file: slack,
  }),
  known({
    source: 'linear',
    name: 'Linear',
    summary: 'Move a task on when its issue is done, and hear its comments.',
    secretCalled: 'the signing secret on the webhook you create',
    file: linear,
  }),
  known({
    source: 'sentry',
    name: 'Sentry',
    summary: 'Bring work back when something starts going wrong again.',
    secretCalled: 'the Client Secret of the internal integration',
    file: sentry,
  }),
  known({
    source: 'grafana',
    name: 'Grafana',
    summary: 'Bring work back when an alert fires.',
    secretCalled: 'the secret on the outgoing webhook',
    file: grafana,
  }),
  known({
    source: 'pagerduty',
    name: 'PagerDuty',
    summary: 'Bring work back when an incident is raised.',
    secretCalled: 'the signing secret shown when the webhook is created',
    file: pagerduty,
  }),
];

export const knownTool = (source: string): KnownTool | null =>
  KNOWN_TOOLS.find((each) => each.source.value === source) ?? null;
