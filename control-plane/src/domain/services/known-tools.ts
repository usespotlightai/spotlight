import { SourceKey } from '@domain/value-objects/source-key.vo';

/**
 * A host Spotlight knows how to listen to before anybody has written a file
 * for it. Choosing one writes that file; what is written is ordinary
 * configuration afterwards, and a person may change any of it.
 *
 * The `when` rules here are what each host's own documentation describes.
 * They are a starting point rather than a promise: a host changes its
 * payloads on its own schedule, and the file is where that is fixed.
 */
export interface KnownTool {
  readonly source: SourceKey;
  readonly name: string;
  /** What a person choosing between them reads. */
  readonly summary: string;
  /** What its own settings page calls the field a secret goes in. */
  readonly secretCalled: string;
  readonly file: string;
}

const linear = `version: 1
source: linear
name: Linear

verify:
  scheme: hmac-sha256
  header: linear-signature
  secret: LINEAR_WEBHOOK_SECRET

delivery: \${{ headers["linear-delivery"] }}

happenings:
  - happening: linear.issue.completed
    label: Issue completed
    told: The issue was moved to Done.
    when: \${{ body.type == "Issue" && body.data.state.type == "completed" }}
    concerns:
      marks:
        - kind: linear.issue
          value: \${{ body.data.identifier }}

  - happening: linear.issue.commented
    label: Issue commented on
    told: Somebody commented on the issue.
    spoken: true
    when: \${{ body.type == "Comment" }}
    concerns:
      marks:
        - kind: linear.issue
          value: \${{ body.data.issue.identifier }}
`;

const sentry = `version: 1
source: sentry
name: Sentry

verify:
  scheme: hmac-sha256
  header: sentry-hook-signature
  secret: SENTRY_WEBHOOK_SECRET

happenings:
  - happening: sentry.issue.regressed
    label: Issue regressed
    told: Sentry says this went wrong again.
    when: \${{ body.action == "created" || body.action == "unresolved" }}
    concerns:
      marks:
        - kind: sentry.issue
          value: \${{ body.data.issue.id }}
`;

const grafana = `version: 1
source: grafana
name: Grafana

verify:
  scheme: hmac-sha256
  header: x-grafana-signature
  secret: GRAFANA_WEBHOOK_SECRET

happenings:
  - happening: grafana.alert.firing
    label: Alert firing
    told: An alert is firing.
    when: \${{ body.status == "firing" }}
    concerns:
      marks:
        - kind: grafana.alert
          value: \${{ body.commonLabels.alertname }}
`;

const pagerduty = `version: 1
source: pagerduty
name: PagerDuty

verify:
  scheme: hmac-sha256
  header: x-pagerduty-signature
  secret: PAGERDUTY_WEBHOOK_SECRET
  prefix: 'v1='

happenings:
  - happening: pagerduty.incident.triggered
    label: Incident triggered
    told: An incident was raised.
    when: \${{ body.event.event_type == "incident.triggered" }}
    concerns:
      marks:
        - kind: pagerduty.incident
          value: \${{ body.event.data.id }}
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
