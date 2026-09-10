import type {
  StarterTool,
  StarterToolsPort,
} from '@application/ports/starter-tools.port';

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
        spoken: true
        say: '\${{ body.event.text.substring(body.event.text.indexOf(">") + 2).trim() }}'
        opens:
          onto: delivery
          # The mention text without the leading "@Spotlight", so the title
          # reads as what was said rather than who was tagged.
          title: '\${{ body.event.text.substring(body.event.text.indexOf(">") + 2).trim() }}'
          assignBy:
            email: '\${{ email }}'
        marks:
          # The thread's root: thread_ts for a reply, the message's own ts for
          # the opening mention. So every word in one thread finds the one task.
          - kind: slack.thread
            value: '\${{ has(body.event.thread_ts) ? body.event.thread_ts : body.event.ts }}'
          # Ambient: shared by every mention in the channel, so it is worn for
          # routing a reply but never used to find which task a word is about.
          - kind: slack.channel
            find: false
            value: '\${{ body.event.channel }}'

    - when: '\${{ body.event.type == "message" && has(body.event.thread_ts) && !has(body.event.subtype) }}'
      raise:
        happening: slack.message.replied
        label: Replied in Slack
        told: Replied in a Slack thread.
        spoken: true
        say: '\${{ body.event.text }}'
        marks:
          - kind: slack.thread
            value: '\${{ body.event.thread_ts }}'
          - kind: slack.channel
            find: false
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
        # Keep the thread's root, so the next reply still finds the task.
        thread: '\${{ has(response.message.thread_ts) ? response.message.thread_ts : response.ts }}'

  # A fixed line back into the thread. dyn() makes the literal a dynamic value,
  # which is what a map alongside the read-out channel and thread expects.
  acknowledge:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        authorization: '\${{ "Bearer " + secret.SLACK_BOT_TOKEN }}'
      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": dyn("Got it. I''ve opened a task for this and I''ll follow up here.")} }}'
      expect:
        success: '\${{ response.ok }}'

  share-pull-request:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        authorization: '\${{ "Bearer " + secret.SLACK_BOT_TOKEN }}'
      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": dyn("I''ve opened a pull request for this: " + task.marks["git.pull-request"])} }}'
      expect:
        success: '\${{ response.ok }}'

on:
  # Acknowledged in its thread the moment a mention opens a task, so the person
  # knows it was heard before the work has anything to say.
  task.opened:
    do: acknowledge
    to:
      channel: '\${{ task.marks["slack.channel"] }}'
      thread: '\${{ task.marks["slack.thread"] }}'
    routes:
      delivery: C0DELIVERY
  # The pull request, dropped in the thread as soon as the work opens one.
  task.pull-request-opened:
    do: share-pull-request
    to:
      channel: '\${{ task.marks["slack.channel"] }}'
      thread: '\${{ task.marks["slack.thread"] }}'
    routes:
      delivery: C0DELIVERY
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

const CATALOG: readonly (StarterTool & { readonly file: string })[] = [
  {
    source: 'slack',
    name: 'Slack',
    summary:
      'Turn a mention into a task, and answer its questions in the thread.',
    secretCalled:
      'the app’s Signing Secret, and a Bot User OAuth token to reply with',
    file: slack,
  },
  {
    source: 'linear',
    name: 'Linear',
    summary: 'Move a task on when its issue is done, and hear its comments.',
    secretCalled: 'the signing secret on the webhook you create',
    file: linear,
  },
  {
    source: 'sentry',
    name: 'Sentry',
    summary: 'Bring work back when something starts going wrong again.',
    secretCalled: 'the Client Secret of the internal integration',
    file: sentry,
  },
  {
    source: 'grafana',
    name: 'Grafana',
    summary: 'Bring work back when an alert fires.',
    secretCalled: 'the secret on the outgoing webhook',
    file: grafana,
  },
  {
    source: 'pagerduty',
    name: 'PagerDuty',
    summary: 'Bring work back when an incident is raised.',
    secretCalled: 'the signing secret shown when the webhook is created',
    file: pagerduty,
  },
];

/**
 * The hosts Spotlight can write a starting file for. The `when` rules are what
 * each host's documentation describes: a starting point rather than a promise,
 * and the file is where that is fixed.
 */
export class KnownTools implements StarterToolsPort {
  all(): readonly StarterTool[] {
    return CATALOG.map(({ file: _file, ...tool }) => tool);
  }

  fileFor(source: string): string | null {
    return CATALOG.find((each) => each.source === source)?.file ?? null;
  }
}
