import type { KnownViolations } from './known-violations';

export const KNOWN_RUNS_SEAM_CROSSINGS: KnownViolations = {
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/archive-references.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/inbox.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/leased-run.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/replay-facts.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/run.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/runner-activity.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/runner-trace.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  "reads both sides' schemas: infrastructure/persistence/drizzle/readers/station-run.reader":
    { count: 1, finding: 'S12, section 6 readers (phases 2 and 4)' },
  'run side imports work side: application/commands/handlers/complete-run.handler -> application/services/files-loader.service':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'run side imports work side: application/commands/handlers/complete-run.handler -> domain/value-objects/attachment.vo':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'run side imports work side: application/commands/handlers/complete-run.handler -> domain/value-objects/handover.vo':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'run side imports work side: application/commands/handlers/complete-run.handler -> domain/value-objects/harness-session.vo':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'run side imports work side: application/commands/handlers/grant-run-attachment-upload.handler -> application/dto/attachment.dto':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/commands/handlers/grant-run-attachment-upload.handler -> application/ports/attachment-store.port':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/commands/handlers/grant-run-attachment-upload.handler -> domain/value-objects/attachment.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/mappers/run-spend.mapper -> application/dto/run-notes.dto':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/ports/harness-launch.port -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/ports/harness-tool-names.port -> domain/value-objects/called-tool.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/ports/run-tools-reader.port -> domain/value-objects/tool-use.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/ports/run-turns.port -> domain/value-objects/handover.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/ports/run-turns.port -> domain/value-objects/harness-session.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/queries/handlers/host-requirements.handler -> application/ports/control-plane-release.port':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/queries/handlers/run-stop-requested.handler -> application/ports/leased-run-reader.port':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: application/services/egress-secret-fetches.service -> domain/repositories/chat.repository':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/aggregates/run.aggregate -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: domain/aggregates/run.aggregate -> domain/value-objects/handover.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/events/run-cancelled.event -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: domain/events/run-completed.event -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: domain/events/run-completed.event -> domain/value-objects/handover.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/events/run-completed.event -> domain/value-objects/harness-session.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/events/run-exhausted.event -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: domain/events/run-usage-recorded.event -> domain/value-objects/tool-use.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/services/permission-plan -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/services/tool-attribution -> domain/services/built-in-skills':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/services/tool-attribution -> domain/value-objects/tool-use.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/value-objects/archive-holder.vo -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: domain/value-objects/handover-report.vo -> domain/value-objects/handover.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/value-objects/handover-report.vo -> domain/value-objects/harness-session.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/value-objects/resume-key.vo -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: domain/value-objects/resume.vo -> domain/value-objects/harness-session.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/value-objects/run-spec.vo -> domain/value-objects/harness-session.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: domain/value-objects/run-subject.vo -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: domain/value-objects/run-subject.vo -> domain/value-objects/task-revision.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: infrastructure/acp/harness-tools -> domain/value-objects/called-tool.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/harnesses/built-in-harnesses -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/harnesses/profiles/claude-code.profile -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/harnesses/profiles/codex.profile -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/harnesses/profiles/cursor.profile -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/harnesses/profiles/opencode.profile -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/harnesses/profiles/profile-translator -> domain/value-objects/ready-profile':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/persistence/drizzle/ledgers/run-usages.ledger -> domain/value-objects/tool-use.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/persistence/drizzle/readers/archive-references.reader -> infrastructure/persistence/drizzle/schemas/chat.schema':
    { count: 1, finding: 'WORK-B-10, ARCHIVE_HOLDERS (phase 4)' },
  'run side imports work side: infrastructure/persistence/drizzle/readers/archive-references.reader -> infrastructure/persistence/drizzle/schemas/task.schema':
    { count: 1, finding: 'WORK-B-10, ARCHIVE_HOLDERS (phase 4)' },
  'run side imports work side: infrastructure/persistence/drizzle/readers/run-journals -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: infrastructure/persistence/drizzle/readers/run-journals -> infrastructure/otel/reported':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/persistence/drizzle/readers/runner-activity.reader -> infrastructure/persistence/drizzle/schemas/chat.schema':
    { count: 1, finding: 'WORK-C-01, RUN_REQUESTER_LABELS (phase 4)' },
  'run side imports work side: infrastructure/persistence/drizzle/readers/runner-activity.reader -> infrastructure/persistence/drizzle/schemas/task.schema':
    { count: 1, finding: 'WORK-C-01, RUN_REQUESTER_LABELS (phase 4)' },
  'run side imports work side: infrastructure/persistence/drizzle/readers/runner-activity.reader -> infrastructure/persistence/drizzle/schemas/work-station.schema':
    { count: 1, finding: 'WORK-C-01, RUN_REQUESTER_LABELS (phase 4)' },
  'run side imports work side: infrastructure/persistence/drizzle/repositories/run.repository -> domain/value-objects/attachment.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/persistence/drizzle/repositories/run.repository -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: infrastructure/persistence/drizzle/repositories/run.repository -> domain/value-objects/handover.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/persistence/drizzle/repositories/run.repository -> domain/value-objects/harness-session.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: infrastructure/persistence/drizzle/repositories/run.repository -> domain/value-objects/task-revision.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: infrastructure/persistence/drizzle/repositories/workspace-archive.repository -> domain/value-objects/chat-id.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'run side imports work side: infrastructure/storage/s3-workspace-archive.store -> application/errors/storage-not-configured.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: presentation/http/controllers/host-work.controller -> presentation/http/dto/runner.response.dto':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: presentation/http/dto/host.response.dto -> presentation/http/dto/runner.response.dto':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'run side imports work side: presentation/http/mappers/claimed-work.http.mapper -> presentation/http/dto/runner.response.dto':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/commands/handlers/connect-editor.handler -> domain/value-objects/resume-key.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'work side imports run side internals: application/commands/handlers/start-chat.handler -> domain/exceptions/unknown-harness.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/commands/handlers/stop-run.handler -> domain/exceptions/unknown-run.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/commands/handlers/use-tool.handler -> domain/exceptions/run-attempt-over.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/dto/inbox.dto -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/dto/onboarding.dto -> domain/services/team-provisioning':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/dto/run-journal.dto -> domain/value-objects/step-kind':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/dto/run-notes.dto -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/dto/task-run.dto -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/dto/task-trace.dto -> domain/value-objects/run-connection.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/dto/task.dto -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/chat-outcomes.handler -> domain/events/run-completed.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/chat-outcomes.handler -> domain/events/run-exhausted.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/dispatch-run-endings.handler -> domain/events/run-cancelled.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/dispatch-run-endings.handler -> domain/events/run-completed.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/dispatch-run-endings.handler -> domain/events/run-exhausted.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/hand-over.handler -> domain/events/run-completed.event':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'work side imports run side internals: application/events/handlers/hand-over.handler -> domain/events/run-exhausted.event':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'work side imports run side internals: application/events/handlers/notify-channel.handler -> domain/events/run-completed.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/notify-channel.handler -> domain/events/run-exhausted.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/record-run-usage.handler -> domain/events/replay-run-usage-recorded.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/record-run-usage.handler -> domain/events/run-completed.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/record-run-usage.handler -> domain/events/run-exhausted.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/record-run-usage.handler -> domain/events/run-usage-recorded.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/record-run-usage.handler -> domain/events/search-run-usage-recorded.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/record-run-usage.handler -> domain/services/agent-spend':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/events/handlers/record-run-usage.handler -> domain/value-objects/tokens.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/integration-events/work.event-mappers -> domain/events/replay-run-usage-recorded.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/integration-events/work.event-mappers -> domain/events/run-cancelled.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/integration-events/work.event-mappers -> domain/events/run-completed.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/integration-events/work.event-mappers -> domain/events/run-exhausted.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/integration-events/work.event-mappers -> domain/events/run-usage-recorded.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/integration-events/work.event-mappers -> domain/events/search-run-usage-recorded.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/mappers/task-run.mapper -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/ports/chat-reader.port -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/ports/inbox-reader.port -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/ports/run-reader.port -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/ports/search-run-facts.port -> domain/value-objects/run-state':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/ports/station-run-reader.port -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/ports/task-reader.port -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/ports/trace-parent.port -> domain/value-objects/search-id.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/queries/handlers/onboarding.handler -> domain/services/team-provisioning':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/queries/handlers/pending-messages.handler -> domain/exceptions/unknown-run.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/queries/handlers/read-run-notes.handler -> application/mappers/run-spend.mapper':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/queries/handlers/read-runner-history.handler -> domain/value-objects/harness-name.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/queries/handlers/read-runner-trace.handler -> domain/exceptions/not-allowed-in-replay.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/read-models/trace-of -> domain/value-objects/harness-name.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/read-models/trace-of -> domain/value-objects/money.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/read-models/trace-of -> domain/value-objects/run-connection.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/read-models/trace-of -> domain/value-objects/step-status':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/candidate-lines.service -> domain/value-objects/resume-key.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'work side imports run side internals: application/services/candidate-lines.service -> domain/value-objects/resume.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/channel-chats.service -> domain/exceptions/mixed-runner-images.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/dispatch-chat.service -> domain/value-objects/run-spec.vo':
    { count: 1, finding: 'WORK-B-03, Dispatch (phase 2)' },
  'work side imports run side internals: application/services/dispatch-chat.service -> domain/value-objects/run-subject.vo':
    { count: 1, finding: 'WORK-B-03, Dispatch (phase 2)' },
  'work side imports run side internals: application/services/dispatch-replay.service -> domain/aggregates/run.aggregate':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-replay.service -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-replay.service -> domain/repositories/workspace-archive.repository':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-replay.service -> domain/services/harness-catalog':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-replay.service -> domain/value-objects/run-outcome.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-replay.service -> domain/value-objects/run-spec.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/aggregates/run.aggregate':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/exceptions/run-already-exists.error':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/value-objects/resume-key.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/value-objects/run-spec.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/value-objects/run-subject.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/value-objects/search-id.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-search.service -> domain/value-objects/search-iteration.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/dispatch-task.service -> domain/services/harness-catalog':
    { count: 1, finding: 'WORK-B-03, Dispatch (phase 2)' },
  'work side imports run side internals: application/services/dispatch-task.service -> domain/value-objects/run-spec.vo':
    { count: 1, finding: 'WORK-B-03, Dispatch (phase 2)' },
  'work side imports run side internals: application/services/dispatch-task.service -> domain/value-objects/run-subject.vo':
    { count: 1, finding: 'WORK-B-03, Dispatch (phase 2)' },
  'work side imports run side internals: application/services/ordered-run -> domain/value-objects/run-priority.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/ordered-run -> domain/value-objects/run-spec.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/ordered-run -> domain/value-objects/run-subject.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'work side imports run side internals: application/services/pause-marks.service -> domain/events/run-paused.event':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'work side imports run side internals: application/services/pause-marks.service -> domain/value-objects/run-attempt.vo':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'work side imports run side internals: application/services/replay-answers.service -> domain/aggregates/run.aggregate':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/replay-run-work -> domain/exceptions/not-allowed-in-replay.error':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/replay-run-work -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/replay-runs.service -> domain/aggregates/run.aggregate':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/replay-runs.service -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/run-evidences.service -> domain/services/change-hunks':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/run-evidences.service -> domain/services/workspace-path':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/run-loader.service -> domain/aggregates/run.aggregate':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: application/services/run-loader.service -> domain/exceptions/unknown-run.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/run-loader.service -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: application/services/run-outcomes -> domain/events/run-completed.event':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'work side imports run side internals: application/services/run-outcomes -> domain/events/run-exhausted.event':
    { count: 1, finding: 'WORK-A-04, requester-held turn (phase 3)' },
  'work side imports run side internals: application/services/run-works.service -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: application/services/search-run-work -> domain/exceptions/not-allowed-in-search.error':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/search-runs.service -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/search-runs.service -> domain/value-objects/run-state':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: application/services/station-ordering -> domain/services/harness-catalog':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/station-ordering -> domain/value-objects/run-spec.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/station-runs.service -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/touched-files -> domain/services/workspace-path':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: application/services/work-lookup.service -> domain/aggregates/run.aggregate':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: application/services/work-lookup.service -> domain/repositories/run.repository':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: application/services/work-lookup.service -> domain/services/workspace-path':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/aggregates/chat.aggregate -> domain/exceptions/mixed-runner-images.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/aggregates/chat.aggregate -> domain/value-objects/resume-key.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'work side imports run side internals: domain/aggregates/chat.aggregate -> domain/value-objects/resume.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/aggregates/chat.aggregate -> domain/value-objects/spotlight-api-grant.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/aggregates/task.aggregate -> domain/value-objects/resume-key.vo':
    { count: 1, finding: 'X-07, stored requester model (phase 6)' },
  'work side imports run side internals: domain/aggregates/task.aggregate -> domain/value-objects/resume.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/chat-priority -> domain/value-objects/run-priority.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/handover-for -> domain/value-objects/run-outcome.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/replay-plan -> domain/aggregates/run.aggregate':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/replay-plan -> domain/value-objects/resume-key.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/replay-plan -> domain/value-objects/resume.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/replay-plan -> domain/value-objects/run-spec.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/replay-plan -> domain/value-objects/run-subject.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/replay-plan -> domain/value-objects/started-checkout.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/replay-plan -> domain/value-objects/workspace-archive-id.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/replay-priority -> domain/value-objects/run-priority.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/run-order -> domain/services/harness-catalog':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/run-order -> domain/value-objects/harness.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/run-order -> domain/value-objects/resume.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/run-order -> domain/value-objects/run-priority.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/run-reasoning -> domain/value-objects/step-kind':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/search-priority -> domain/value-objects/run-priority.vo':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: domain/services/task-checkouts -> domain/value-objects/run-spec.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/turn-decision -> domain/value-objects/run-outcome.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/services/turn-decision -> domain/value-objects/run-spec.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/value-objects/harness-session.vo -> domain/exceptions/invalid-harness-session.error':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: domain/value-objects/ready-profile -> domain/services/injected-by-egress':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/otel/reported -> infrastructure/journal/journalled':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/chat.reader -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/current-progress -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/current-progress -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/inbox.reader -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/inbox.reader -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/leased-run.reader -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/leased-run.reader -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/replay-facts.reader -> domain/value-objects/run-state':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/replay-facts.reader -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/replay-facts.reader -> infrastructure/persistence/drizzle/schemas/workspace-archive.schema':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/run-journal.reader -> infrastructure/persistence/drizzle/readers/run-journals':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/run.reader -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/run.reader -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/runner-trace.reader -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/runner-trace.reader -> infrastructure/persistence/drizzle/readers/run-journals':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/runner-trace.reader -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/search-run-facts.reader -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'REP-02, replay/search dispatch to Replays (phase 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/station-run.reader -> domain/value-objects/run-state':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/station-run.reader -> infrastructure/persistence/drizzle/readers/run-journals':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: infrastructure/persistence/drizzle/readers/station-run.reader -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/schemas/chat.schema -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/persistence/drizzle/schemas/task.schema -> infrastructure/persistence/drizzle/schemas/run.schema':
    {
      count: 1,
      finding: 'X-07, Runs facades (phase 1, remaining callers phases 3 to 5)',
    },
  'work side imports run side internals: infrastructure/tracing/hashed-trace-parent -> domain/value-objects/search-id.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> application/services/runner-leases.service':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> application/services/sandbox-leases.service':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> domain/events/run-cancelled.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> domain/events/run-completed.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> domain/events/run-exhausted.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> domain/events/run-lease-expired.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> domain/events/run-paused.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> domain/events/run-reservation-dropped.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/events/work.subscribers -> domain/events/run-suspended.event':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/run.controller -> application/commands/runner.commands':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/runner.controller -> application/commands/runner.commands':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/runner.controller -> application/queries/list-harnesses.query':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/runner.controller -> application/queries/run-stop-requested.query':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/runner.controller -> presentation/http/dto/harness-probe.response.dto':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/runner.controller -> presentation/http/mappers/claimed-work.http.mapper':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/task.controller -> application/queries/read-run-network.query':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/controllers/task.controller -> presentation/http/dto/run-network.response.dto':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/dto/onboarding.response.dto -> domain/services/team-provisioning':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/dto/runner.request.dto -> domain/value-objects/starting-point.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
  'work side imports run side internals: presentation/http/dto/task-trace.response.dto -> domain/value-objects/run-connection.vo':
    { count: 1, finding: 'X-07, move to the runs context (phase 7)' },
};
