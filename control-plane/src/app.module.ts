import { AcceptDeliveryCommand } from '@application/commands/accept-delivery.command';
import { AcceptInviteCommand } from '@application/commands/accept-invite.command';
import { AddTaskCommand } from '@application/commands/add-task.command';
import { CreateLabelCommand } from '@application/commands/create-label.command';
import { DeleteLabelCommand } from '@application/commands/delete-label.command';
import { LabelTaskCommand } from '@application/commands/label-task.command';
import { RecolourLabelCommand } from '@application/commands/recolour-label.command';
import { RenameLabelCommand } from '@application/commands/rename-label.command';
import { UnlabelTaskCommand } from '@application/commands/unlabel-task.command';
import { AnalyseTraceCommand } from '@application/commands/analyse-trace.command';
import { AnswerInboxItemCommand } from '@application/commands/answer-inbox-item.command';
import { AnswerRemarkCommand } from '@application/commands/answer-remark.command';
import { AssignTaskCommand } from '@application/commands/assign-task.command';
import { BeginOAuth2ConnectionCommand } from '@application/commands/begin-oauth2-connection.command';
import { ChangeMemberRoleCommand } from '@application/commands/change-member-role.command';
import {
  AcceptProposalCommand,
  DismissProposalCommand,
  SayInChatCommand,
  StartChatCommand,
  StopChatCommand,
} from '@application/commands/chat.commands';
import { ChooseIntegrationsCommand } from '@application/commands/choose-integrations.command';
import { ConnectGitHubCommand } from '@application/commands/connect-github.command';
import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { DeleteTaskCommand } from '@application/commands/delete-task.command';
import { DeliverSaidCommand } from '@application/commands/deliver-said.command';
import { FinishOAuth2ConnectionCommand } from '@application/commands/finish-oauth2-connection.command';
import { GrantAttachmentUploadCommand } from '@application/commands/grant-attachment-upload.command';
import { AcceptDeliveryHandler } from '@application/commands/handlers/accept-delivery.handler';
import { AcceptInviteHandler } from '@application/commands/handlers/accept-invite.handler';
import { AcceptProposalHandler } from '@application/commands/handlers/accept-proposal.handler';
import { AddTaskHandler } from '@application/commands/handlers/add-task.handler';
import { CreateLabelHandler } from '@application/commands/handlers/create-label.handler';
import { DeleteLabelHandler } from '@application/commands/handlers/delete-label.handler';
import { LabelTaskHandler } from '@application/commands/handlers/label-task.handler';
import { RecolourLabelHandler } from '@application/commands/handlers/recolour-label.handler';
import { RenameLabelHandler } from '@application/commands/handlers/rename-label.handler';
import { UnlabelTaskHandler } from '@application/commands/handlers/unlabel-task.handler';
import { AnalyseTraceHandler } from '@application/commands/handlers/analyse-trace.handler';
import { AnswerInboxItemHandler } from '@application/commands/handlers/answer-inbox-item.handler';
import { AnswerRemarkHandler } from '@application/commands/handlers/answer-remark.handler';
import { AppendRunEventsHandler } from '@application/commands/handlers/append-run-events.handler';
import { AssignTaskHandler } from '@application/commands/handlers/assign-task.handler';
import { ChangeMemberRoleHandler } from '@application/commands/handlers/change-member-role.handler';
import { ChooseIntegrationsHandler } from '@application/commands/handlers/choose-integrations.handler';
import { ClaimRunHandler } from '@application/commands/handlers/claim-run.handler';
import { CompleteRunHandler } from '@application/commands/handlers/complete-run.handler';
import { ConnectGitHubHandler } from '@application/commands/handlers/connect-github.handler';
import { CreateWorkspaceHandler } from '@application/commands/handlers/create-workspace.handler';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { DeleteTaskHandler } from '@application/commands/handlers/delete-task.handler';
import { DeliverSaidHandler } from '@application/commands/handlers/deliver-said.handler';
import { DismissProposalHandler } from '@application/commands/handlers/dismiss-proposal.handler';
import { EnqueueRunHandler } from '@application/commands/handlers/enqueue-run.handler';
import { EnrolRunnerHandler } from '@application/commands/handlers/enrol-runner.handler';
import { GrantAttachmentUploadHandler } from '@application/commands/handlers/grant-attachment-upload.handler';
import { InviteToTeamHandler } from '@application/commands/handlers/invite-to-team.handler';
import { MoveConfigurationHandler } from '@application/commands/handlers/move-configuration.handler';
import { MoveTaskHandler } from '@application/commands/handlers/move-task.handler';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@application/commands/handlers/oauth2-connection.handler';
import { PinConfigurationHandler } from '@application/commands/handlers/pin-configuration.handler';
import { ReactToHappeningHandler } from '@application/commands/handlers/react-to-happening.handler';
import { ReadConfigurationHandler } from '@application/commands/handlers/read-configuration.handler';
import { ReadInboxItemHandler } from '@application/commands/handlers/read-inbox-item.handler';
import { RegisterRunnerHandler } from '@application/commands/handlers/register-runner.handler';
import { RenameTeamHandler } from '@application/commands/handlers/rename-team.handler';
import { RenewLeaseHandler } from '@application/commands/handlers/renew-lease.handler';
import { RevealVaultKeyHandler } from '@application/commands/handlers/reveal-vault-key.handler';
import { RevokeInviteHandler } from '@application/commands/handlers/revoke-invite.handler';
import { RevokeRunnerHandler } from '@application/commands/handlers/revoke-runner.handler';
import { SayInChatHandler } from '@application/commands/handlers/say-in-chat.handler';
import { SayToRunHandler } from '@application/commands/handlers/say-to-run.handler';
import { SetLineRepositoriesHandler } from '@application/commands/handlers/set-line-repositories.handler';
import { SetUpLinesHandler } from '@application/commands/handlers/set-up-lines.handler';
import { StartChatHandler } from '@application/commands/handlers/start-chat.handler';
import { StopChatHandler } from '@application/commands/handlers/stop-chat.handler';
import { StopRunHandler } from '@application/commands/handlers/stop-run.handler';
import { UseToolHandler } from '@application/commands/handlers/use-tool.handler';
import { InviteToTeamCommand } from '@application/commands/invite-to-team.command';
import { MoveConfigurationCommand } from '@application/commands/move-configuration.command';
import { MoveTaskCommand } from '@application/commands/move-task.command';
import { PinConfigurationCommand } from '@application/commands/pin-configuration.command';
import { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import { ReadConfigurationCommand } from '@application/commands/read-configuration.command';
import { ReadInboxItemCommand } from '@application/commands/read-inbox-item.command';
import { RenameTeamCommand } from '@application/commands/rename-team.command';
import { RevealVaultKeyCommand } from '@application/commands/reveal-vault-key.command';
import { RevokeInviteCommand } from '@application/commands/revoke-invite.command';
import {
  AppendRunEventsCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  EnrolRunnerCommand,
  RegisterRunnerCommand,
  RenewLeaseCommand,
  RevokeRunnerCommand,
} from '@application/commands/runner.commands';
import { SayToRunCommand } from '@application/commands/say-to-run.command';
import { SetLineRepositoriesCommand } from '@application/commands/set-line-repositories.command';
import { SetUpLinesCommand } from '@application/commands/set-up-lines.command';
import { StopRunCommand } from '@application/commands/stop-run.command';
import { UseToolCommand } from '@application/commands/use-tool.command';
import { ChatOutcomes } from '@application/events/handlers/chat-outcomes.handler';
import { CreateTaskFromProposal } from '@application/events/handlers/create-task-from-proposal.handler';
import { DigestRun } from '@application/events/handlers/digest-run.handler';
import { HandOver } from '@application/events/handlers/hand-over.handler';
import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import { ReleaseHeldRuns } from '@application/events/handlers/release-held-runs.handler';
import { SettleOnConnection } from '@application/events/handlers/settle-on-connection.handler';
import { RoutingDispatcher } from '@application/events/routing.dispatcher';
import {
  ATTACHMENT_READER,
  type AttachmentReaderPort,
} from '@application/ports/attachment-reader.port';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@application/ports/attachment-store.port';
import {
  BUILT_IN_SKILLS,
  type BuiltInSkillsPort,
} from '@application/ports/built-in-skills.port';
import { CHAT_READER } from '@application/ports/chat-reader.port';
import { CLOCK, type ClockPort } from '@application/ports/clock.port';
import {
  CONFIGURED_SOURCES,
  type ConfiguredSourcesPort,
} from '@application/ports/configured-sources.port';
import { DELIVERY_ADDRESSES } from '@application/ports/delivery-addresses.port';
import {
  DELIVERY_INBOX,
  type DeliveryInboxPort,
} from '@application/ports/delivery-inbox.port';
import {
  DELIVERY_WORK,
  type DeliveryWorkPort,
} from '@application/ports/delivery-work.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@application/ports/domain-event-dispatcher.port';
import {
  FACTORY_PROVISIONING,
  type FactoryProvisioningPort,
} from '@application/ports/factory-provisioning.port';
import { GIT_GATEWAY } from '@application/ports/git-gateway.port';
import { GITHUB_APP } from '@application/ports/github-app.port';
import { GITHUB_IDENTITY } from '@application/ports/github-identity.port';
import {
  HARNESS_LAUNCH,
  type HarnessLaunchPort,
} from '@application/ports/harness-launch.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@application/ports/id-generator.port';
import { INBOX_READER } from '@application/ports/inbox-reader.port';
import { INSTALLER_ASSETS } from '@application/ports/installer-assets.port';
import {
  INTEGRATION_CURSORS,
  type IntegrationCursorsPort,
} from '@application/ports/integration-cursors.port';
import {
  INTEGRATION_READER,
  type IntegrationReaderPort,
} from '@application/ports/integration-reader.port';
import { INTEGRATION_TOOLS } from '@application/ports/integration-tools.port';
import { INVITE_MAIL } from '@application/ports/invite-mail.port';
import { INVITE_READER } from '@application/ports/invite-reader.port';
import { KEPT_WORKSPACE_READER } from '@application/ports/kept-workspace-reader.port';
import {
  LINE_CONFIG_READER,
  type LineConfigReaderPort,
} from '@application/ports/line-config-reader.port';
import { LINE_READER } from '@application/ports/line-reader.port';
import { LOGGER, type LoggerPort } from '@application/ports/logger.port';
import {
  MEMBER_READER,
  type MemberReaderPort,
} from '@application/ports/member-reader.port';
import { OAUTH2_LINKING } from '@application/ports/oauth2-linking.port';
import {
  OUTBOUND_TASK_NOTIFIER,
  type OutboundTaskNotifierPort,
} from '@application/ports/outbound-task-notifier.port';
import { PERSON_READER } from '@application/ports/person-reader.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@application/ports/pull-request.port';
import { REMARKS } from '@application/ports/remarks.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import {
  REPOSITORY_CATALOG,
  type RepositoryCatalogPort,
} from '@application/ports/repository-catalog.port';
import {
  REPOSITORY_CONTENTS,
  type RepositoryContentsPort,
} from '@application/ports/repository-contents.port';
import {
  REPOSITORY_GIT,
  type RepositoryGitPort,
} from '@application/ports/repository-git.port';
import { RUN_DIGESTS } from '@application/ports/run-digest-reader.port';
import {
  RUN_DIGEST_WRITER,
  type RunDigestWriterPort,
} from '@application/ports/run-digest-writer.port';
import { RUN_EVENT_READER } from '@application/ports/run-event-reader.port';
import { RUN_JOURNAL_READER } from '@application/ports/run-journal-reader.port';
import { RUN_READER } from '@application/ports/run-reader.port';
import { RUN_STREAM } from '@application/ports/run-stream.port';
import { RUNNER_AUTH } from '@application/ports/runner-auth.port';
import {
  RUNNER_READER,
  type RunnerReaderPort,
} from '@application/ports/runner-reader.port';
import {
  RUNNER_REVOCATION,
  type RunnerRevocationPort,
} from '@application/ports/runner-revocation.port';
import { RUNNER_TRACE_READER } from '@application/ports/runner-trace-reader.port';
import {
  SKILL_READER,
  type SkillReaderPort,
} from '@application/ports/skill-reader.port';
import { STARTER_INTEGRATIONS } from '@application/ports/starter-integrations.port';
import { TASK_READER } from '@application/ports/task-reader.port';
import {
  TEAM_SECRETS,
  type TeamSecretsPort,
} from '@application/ports/team-secrets.port';
import { TEAM_TRACE_READER } from '@application/ports/team-trace-reader.port';
import { TOKEN_MINT } from '@application/ports/token-mint.port';
import {
  TRACE_PARENT,
  type TraceParentPort,
} from '@application/ports/trace-parent.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@application/ports/transaction.port';
import {
  VAULT_SEALING,
  type VaultSealingPort,
} from '@application/ports/vault-sealing.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@application/ports/workspace-reader.port';
import {
  ListChatsQuery,
  ReadChatJournalQuery,
  ReadChatQuery,
} from '@application/queries/chat.queries';
import { FindStationQuery } from '@application/queries/find-station.query';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { FindStationHandler } from '@application/queries/handlers/find-station.handler';
import { GetWorkspaceHandler } from '@application/queries/handlers/get-workspace.handler';
import { ListChatsHandler } from '@application/queries/handlers/list-chats.handler';
import { ListHappeningsHandler } from '@application/queries/handlers/list-happenings.handler';
import { ListHarnessesHandler } from '@application/queries/handlers/list-harnesses.handler';
import { ListInboxHandler } from '@application/queries/handlers/list-inbox.handler';
import { ListInvitesHandler } from '@application/queries/handlers/list-invites.handler';
import { ListKeptWorkspacesHandler } from '@application/queries/handlers/list-kept-workspaces.handler';
import { ListLinesHandler } from '@application/queries/handlers/list-lines.handler';
import { ListMembersHandler } from '@application/queries/handlers/list-members.handler';
import { ListRepositoriesHandler } from '@application/queries/handlers/list-repositories.handler';
import { ListRunnersHandler } from '@application/queries/handlers/list-runners.handler';
import { ListTaskRunsHandler } from '@application/queries/handlers/list-task-runs.handler';
import { ListLabelsHandler } from '@application/queries/handlers/list-labels.handler';
import { ListTasksHandler } from '@application/queries/handlers/list-tasks.handler';
import { ListTeamRunsHandler } from '@application/queries/handlers/list-team-runs.handler';
import { ListTeamTracesHandler } from '@application/queries/handlers/list-team-traces.handler';
import { ListWorkspacesHandler } from '@application/queries/handlers/list-workspaces.handler';
import { OnboardingHandler } from '@application/queries/handlers/onboarding.handler';
import { PendingMessagesHandler } from '@application/queries/handlers/pending-messages.handler';
import { ReadAttachmentHandler } from '@application/queries/handlers/read-attachment.handler';
import { ReadChatHandler } from '@application/queries/handlers/read-chat.handler';
import { ReadChatJournalHandler } from '@application/queries/handlers/read-chat-journal.handler';
import { ConfigurationHandler } from '@application/queries/handlers/read-configuration.handler';
import { ReadInviteHandler } from '@application/queries/handlers/read-invite.handler';
import { ReadRunAttachmentHandler } from '@application/queries/handlers/read-run-attachment.handler';
import { ReadRunConversationHandler } from '@application/queries/handlers/read-run-conversation.handler';
import { ReadRunEventsHandler } from '@application/queries/handlers/read-run-events.handler';
import { ReadRunnerTraceHandler } from '@application/queries/handlers/read-runner-trace.handler';
import { ReadTaskJournalHandler } from '@application/queries/handlers/read-task-journal.handler';
import { ReadTaskTraceHandler } from '@application/queries/handlers/read-task-trace.handler';
import { RunStopRequestedHandler } from '@application/queries/handlers/run-stop-requested.handler';
import { TeamSkillsHandler } from '@application/queries/handlers/team-skills.handler';
import { WatchRunHandler } from '@application/queries/handlers/watch-run.handler';
import { ListHappeningsQuery } from '@application/queries/list-happenings.query';
import { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { ListInboxQuery } from '@application/queries/list-inbox.query';
import { ListInvitesQuery } from '@application/queries/list-invites.query';
import { ListKeptWorkspacesQuery } from '@application/queries/list-kept-workspaces.query';
import { ListLinesQuery } from '@application/queries/list-lines.query';
import { ListMembersQuery } from '@application/queries/list-members.query';
import { ListRepositoriesQuery } from '@application/queries/list-repositories.query';
import { ListRunnersQuery } from '@application/queries/list-runners.query';
import { ListTaskRunsQuery } from '@application/queries/list-task-runs.query';
import { ListLabelsQuery } from '@application/queries/list-labels.query';
import { ListTasksQuery } from '@application/queries/list-tasks.query';
import { ListTeamRunsQuery } from '@application/queries/list-team-runs.query';
import { ListTeamTracesQuery } from '@application/queries/list-team-traces.query';
import { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import { OnboardingQuery } from '@application/queries/onboarding.query';
import { PendingMessagesQuery } from '@application/queries/pending-messages.query';
import { ReadAttachmentQuery } from '@application/queries/read-attachment.query';
import { ConfigurationQuery } from '@application/queries/read-configuration.query';
import { ReadInviteQuery } from '@application/queries/read-invite.query';
import { ReadRunAttachmentQuery } from '@application/queries/read-run-attachment.query';
import { ReadRunConversationQuery } from '@application/queries/read-run-conversation.query';
import { ReadRunEventsQuery } from '@application/queries/read-run-events.query';
import { ReadRunnerTraceQuery } from '@application/queries/read-runner-trace.query';
import { ReadTaskJournalQuery } from '@application/queries/read-task-journal.query';
import { ReadTaskTraceQuery } from '@application/queries/read-task-trace.query';
import { RunStopRequestedQuery } from '@application/queries/run-stop-requested.query';
import { TeamSkillsQuery } from '@application/queries/team-skills.query';
import { WatchRunQuery } from '@application/queries/watch-run.query';
import { AnnounceTaskEvents } from '@application/services/announce-task-events';
import { ApplyLines } from '@application/services/apply-lines.service';
import { AttendToNotices } from '@application/services/attend-to-notices.service';
import {
  BUILT_IN_TOOL_USES,
  BuiltInTools,
  type BuiltInToolUse,
} from '@application/services/built-in-tools.service';
import { CarryGitCall } from '@application/services/carry-git-call.service';
import { ChatAtHand } from '@application/services/chat-at-hand.service';
import {
  CHAT_DISPATCH,
  type ChatDispatching,
} from '@application/services/chat-dispatch';
import { ConfigurationTarget } from '@application/services/configuration-target.service';
import { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { ConversationAtHand } from '@application/services/conversation-at-hand.service';
import { DispatchChat } from '@application/services/dispatch-chat.service';
import { DispatchTask } from '@application/services/dispatch-task.service';
import { FilesAtHand } from '@application/services/files-at-hand.service';
import { HeldConfiguration } from '@application/services/held-configuration.service';
import { OpenPullRequest } from '@application/services/open-pull-request.service';
import { PendingConfiguration } from '@application/services/pending-configuration.service';
import { ProposeConfigurationChange } from '@application/services/propose-configuration-change.service';
import { ProposeTaskToolUse } from '@application/services/propose-task.tool-use';
import { PullRequestToolUse } from '@application/services/pull-request.tool-use';
import { RaiseTask } from '@application/services/raise-task';
import { ReactToHappenings } from '@application/services/react-to-happenings.service';
import { ReadConfiguration } from '@application/services/read-configuration.service';
import { RepositoryProvisioning } from '@application/services/repository-provisioning.service';
import { RunAtHand } from '@application/services/run-at-hand.service';
import {
  RUN_OUTCOMES,
  type RunOutcomes,
} from '@application/services/run-outcomes';
import { RunOutcomesFanOut } from '@application/services/run-outcomes.fan-out';
import { RunWorks } from '@application/services/run-works.service';
import { SeedConfiguration } from '@application/services/seed-configuration.service';
import { SettleSetup } from '@application/services/settle-setup.service';
import { SourceForDelivery } from '@application/services/source-for-delivery.service';
import { STANDING_WORK } from '@application/services/standing-work';
import { TakeUpStandingWork } from '@application/services/take-up-standing-work.service';
import {
  TASK_DISPATCH,
  type TaskDispatching,
} from '@application/services/task-dispatch';
import { TeamIntegrations } from '@application/services/team-integrations.service';
import { TeamSetup } from '@application/services/team-setup.service';
import { TeamSkills } from '@application/services/team-skills.service';
import { TeamVault } from '@application/services/team-vault.service';
import { WebhookSources } from '@application/services/webhook-sources.service';
import { WorkOffDeliveries } from '@application/services/work-off-deliveries.service';
import { WriteConfiguration } from '@application/services/write-configuration.service';
import {
  HOST_CONNECTIONS,
  type HostConnectionRepository,
} from '@domain/repositories/host-connection.repository';
import {
  VAULT_KEYS,
  type VaultKeyRepository,
} from '@domain/repositories/vault-key.repository';
import { AuthenticationModule } from '@infrastructure/auth/auth.module';
import { RunnerTokenAuth } from '@infrastructure/auth/runner-token.auth';
import { TokenMint } from '@infrastructure/auth/token-mint.service';
import { ENV } from '@infrastructure/config/config.constants';
import { ConfigModule } from '@infrastructure/config/config.module';
import { publicUrlOf, webhookUrlOf } from '@infrastructure/config/env';
import type { Env } from '@infrastructure/config/env.schema';
import { bindCommandHandler } from '@infrastructure/cqrs/bind-command-handler';
import { bindQueryHandler } from '@infrastructure/cqrs/bind-query-handler';
import { DeliveryWorker } from '@infrastructure/delivery/delivery-worker';
import { GitHubSource } from '@infrastructure/github/github.source';
import { GitHubAppAccess } from '@infrastructure/github/github-app.access';
import { GitHubAppIdentity } from '@infrastructure/github/github-app.identity';
import { GitHubGitTransport } from '@infrastructure/github/github-git.transport';
import { GitHubIdentity } from '@infrastructure/github/github-identity';
import { GitHubPullRequests } from '@infrastructure/github/github-pull-requests';
import { GitHubRemarks } from '@infrastructure/github/github-remarks';
import { GitHubRepositoryCatalog } from '@infrastructure/github/github-repository.catalog';
import { GitHubRepositoryContents } from '@infrastructure/github/github-repository.contents';
import { GitHubWebhookSignature } from '@infrastructure/github/github-webhook.signature';
import {
  BuiltInHarnesses,
  DEFAULT_HARNESS,
} from '@infrastructure/harnesses/built-in-harnesses';
import { CryptoIdGenerator } from '@infrastructure/identity/crypto-id.generator';
import { InstallerAssets } from '@infrastructure/installer/installer-assets';
import { ConfiguredSources } from '@infrastructure/integrations/configured.sources';
import { ConnectionRefreshWorker } from '@infrastructure/integrations/connection-refresh.worker';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import { JwksCache } from '@infrastructure/integrations/jwks';
import { KnownIntegrations } from '@infrastructure/integrations/known-integrations';
import { LineConfigReader } from '@infrastructure/integrations/line-config.reader';
import { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import { OAuth2Clients } from '@infrastructure/integrations/oauth2-clients';
import { OAuth2Exchange } from '@infrastructure/integrations/oauth2-exchange';
import { OAuth2Linking } from '@infrastructure/integrations/oauth2-linking';
import { OAuth2State } from '@infrastructure/integrations/oauth2-state';
import { PollWorker } from '@infrastructure/integrations/poll.worker';
import { RefreshConnections } from '@infrastructure/integrations/refresh-connections';
import { RunSchedules } from '@infrastructure/integrations/run-schedules';
import { ScheduleWorker } from '@infrastructure/integrations/schedule.worker';
import { WorkOffPolls } from '@infrastructure/integrations/work-off-polls';
import { GracefulShutdown } from '@infrastructure/lifecycle/graceful-shutdown';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { InviteByMail } from '@infrastructure/mail/invite.mail';
import type { MailTransport } from '@infrastructure/mail/mail.transport';
import { SmtpMail } from '@infrastructure/mail/smtp.transport';
import { WrittenDownMail } from '@infrastructure/mail/written-down.mail';
import { Egress } from '@infrastructure/outbound/egress';
import { HttpOutbound } from '@infrastructure/outbound/http-outbound';
import { IntegrationToolUses } from '@infrastructure/outbound/integration-tool-uses';
import { OutboundTaskNotifier } from '@infrastructure/outbound/outbound-task.notifier';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { DrizzleAttachmentReader } from '@infrastructure/persistence/drizzle/readers/attachment.reader';
import { DrizzleChatReader } from '@infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleInboxReader } from '@infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleInviteReader } from '@infrastructure/persistence/drizzle/readers/invite.reader';
import { DrizzleKeptWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/kept-workspace.reader';
import { DrizzleLineReader } from '@infrastructure/persistence/drizzle/readers/line.reader';
import { DrizzleMemberReader } from '@infrastructure/persistence/drizzle/readers/member.reader';
import { DrizzlePersonReader } from '@infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleRunReader } from '@infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleRunEventReader } from '@infrastructure/persistence/drizzle/readers/run-event.reader';
import { DrizzleRunJournalReader } from '@infrastructure/persistence/drizzle/readers/run-journal.reader';
import { DrizzleRunnerReader } from '@infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleRunnerTraceReader } from '@infrastructure/persistence/drizzle/readers/runner-trace.reader';
import { DrizzleTaskReader } from '@infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleTeamTraceReader } from '@infrastructure/persistence/drizzle/readers/team-trace.reader';
import { DrizzleWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleChatRepository } from '@infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleDeliveryInbox } from '@infrastructure/persistence/drizzle/repositories/delivery-inbox.repository';
import { DrizzleFactoryRepository } from '@infrastructure/persistence/drizzle/repositories/factory.repository';
import { DrizzleHostConnections } from '@infrastructure/persistence/drizzle/repositories/host-connections.repository';
import { DrizzleIntegrationCursors } from '@infrastructure/persistence/drizzle/repositories/integration-cursors.repository';
import { DrizzleInviteRepository } from '@infrastructure/persistence/drizzle/repositories/invite.repository';
import { DrizzleLineRepository } from '@infrastructure/persistence/drizzle/repositories/line.repository';
import { DrizzleRunRepository } from '@infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleRunDigests } from '@infrastructure/persistence/drizzle/repositories/run-digest.repository';
import { DrizzleRunnerRepository } from '@infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleLabelRepository } from '@infrastructure/persistence/drizzle/repositories/label.repository';
import { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleTeamRepository } from '@infrastructure/persistence/drizzle/repositories/team.repository';
import { DrizzleTeamConfiguration } from '@infrastructure/persistence/drizzle/repositories/team-configuration.repository';
import { DrizzleVaultKeys } from '@infrastructure/persistence/drizzle/repositories/vault-key.repository';
import { DrizzleWorkspaceRepository } from '@infrastructure/persistence/drizzle/repositories/workspace.repository';
import { AgeVaultSealing } from '@infrastructure/secrets/age-vault-sealing';
import { SecretCipher } from '@infrastructure/secrets/secret.cipher';
import { VaultTeamSecrets } from '@infrastructure/secrets/vault-team-secrets';
import { BuiltInSkillFiles } from '@infrastructure/skills/built-in-skill-files';
import { TeamSkillFiles } from '@infrastructure/skills/team-skill-files';
import { S3AttachmentStore } from '@infrastructure/storage/s3-attachment.store';
import { InMemoryRunStream } from '@infrastructure/streaming/in-memory-run-stream';
import { SystemClock } from '@infrastructure/time/system-clock';
import { HashedTraceParent } from '@infrastructure/tracing/hashed-trace-parent';
import { markedSources } from '@infrastructure/webhooks/registered-sources';
import { Module } from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  DiscoveryModule,
  DiscoveryService,
  HttpAdapterHost,
} from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { AttachmentController } from '@presentation/http/controllers/attachment.controller';
import { ChatController } from '@presentation/http/controllers/chat.controller';
import { ConfigurationController } from '@presentation/http/controllers/configuration.controller';
import { GitController } from '@presentation/http/controllers/git.controller';
import { GitHubConnectionController } from '@presentation/http/controllers/github-connection.controller';
import { HappeningController } from '@presentation/http/controllers/happening.controller';
import { HarnessController } from '@presentation/http/controllers/harness.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { InboxController } from '@presentation/http/controllers/inbox.controller';
import { InstallController } from '@presentation/http/controllers/install.controller';
import {
  InviteController,
  TeamInviteController,
} from '@presentation/http/controllers/invite.controller';
import { LineController } from '@presentation/http/controllers/line.controller';
import { OAuth2ConnectionController } from '@presentation/http/controllers/oauth2-connection.controller';
import { RepositoryController } from '@presentation/http/controllers/repository.controller';
import { RunController } from '@presentation/http/controllers/run.controller';
import { RunStreamController } from '@presentation/http/controllers/run-stream.controller';
import { RunnerController } from '@presentation/http/controllers/runner.controller';
import { RunnerFleetController } from '@presentation/http/controllers/runner-fleet.controller';
import { SkillController } from '@presentation/http/controllers/skill.controller';
import { LabelController } from '@presentation/http/controllers/label.controller';
import { TaskController } from '@presentation/http/controllers/task.controller';
import { TeamController } from '@presentation/http/controllers/team.controller';
import { WebhookController } from '@presentation/http/controllers/webhook.controller';
import { WorkspaceController } from '@presentation/http/controllers/workspace.controller';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import { UseCaseFaultFilter } from '@presentation/http/filters/use-case-fault.filter';
import { AuthenticatedGuard } from '@presentation/http/guards/authenticated.guard';
import { RunnerGuard } from '@presentation/http/guards/runner.guard';
import { WebhookDeliveryAddresses } from '@presentation/http/webhook-delivery-addresses';

@Module({
  imports: [
    ConfigModule,
    DiscoveryModule,
    LoggingModule,
    CqrsModule,
    ScheduleModule.forRoot(),
    DrizzleModule,
    AuthenticationModule,
  ],
  controllers: [
    LineController,
    HealthController,
    RunController,
    RunStreamController,
    RunnerController,
    HarnessController,
    InboxController,
    AttachmentController,
    InstallController,
    RunnerFleetController,
    GitController,
    RepositoryController,
    GitHubConnectionController,
    OAuth2ConnectionController,
    ConfigurationController,
    TeamController,
    TeamInviteController,
    InviteController,
    HappeningController,
    WebhookController,
    TaskController,
    LabelController,
    ChatController,
    WorkspaceController,
    SkillController,
  ],
  providers: [
    { provide: INSTALLER_ASSETS, useClass: InstallerAssets },
    DrizzleContext,
    { provide: TRANSACTION, useExisting: DrizzleContext },
    DrizzleWorkspaceRepository,
    DrizzleTeamRepository,
    DrizzleRunRepository,
    DrizzleRunnerRepository,
    DrizzleFactoryRepository,
    DrizzleLineRepository,
    DrizzleTaskRepository,
    DrizzleLabelRepository,
    DrizzleInviteRepository,
    DrizzleChatRepository,
    { provide: CHAT_READER, useClass: DrizzleChatReader },
    { provide: WORKSPACE_READER, useClass: DrizzleWorkspaceReader },
    { provide: LINE_READER, useClass: DrizzleLineReader },
    { provide: PERSON_READER, useClass: DrizzlePersonReader },
    { provide: TASK_READER, useClass: DrizzleTaskReader },
    { provide: MEMBER_READER, useClass: DrizzleMemberReader },
    { provide: INVITE_READER, useClass: DrizzleInviteReader },
    { provide: INBOX_READER, useClass: DrizzleInboxReader },
    { provide: RUN_READER, useClass: DrizzleRunReader },
    { provide: RUNNER_TRACE_READER, useClass: DrizzleRunnerTraceReader },
    { provide: RUNNER_READER, useClass: DrizzleRunnerReader },
    { provide: HARNESS_LAUNCH, useExisting: BuiltInHarnesses },
    { provide: KEPT_WORKSPACE_READER, useClass: DrizzleKeptWorkspaceReader },
    { provide: RUN_JOURNAL_READER, useClass: DrizzleRunJournalReader },
    { provide: TEAM_TRACE_READER, useClass: DrizzleTeamTraceReader },
    { provide: ATTACHMENT_READER, useClass: DrizzleAttachmentReader },
    {
      provide: ATTACHMENT_STORE,
      inject: [ENV],
      useFactory: (env: Env) => new S3AttachmentStore(env),
    },
    {
      provide: FilesAtHand,
      inject: [ATTACHMENT_READER, ATTACHMENT_STORE],
      useFactory: (
        attachments: AttachmentReaderPort,
        files: AttachmentStorePort,
      ) => new FilesAtHand(attachments, files),
    },
    DrizzleRunDigests,
    { provide: RUN_DIGESTS, useExisting: DrizzleRunDigests },
    { provide: RUN_DIGEST_WRITER, useExisting: DrizzleRunDigests },
    { provide: RUN_EVENT_READER, useClass: DrizzleRunEventReader },
    { provide: RUN_STREAM, useClass: InMemoryRunStream },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: STARTER_INTEGRATIONS, useClass: KnownIntegrations },
    TokenMint,
    { provide: TOKEN_MINT, useClass: TokenMint },
    { provide: RUNNER_AUTH, useClass: RunnerTokenAuth },
    {
      provide: RUNNER_REVOCATION,
      inject: [DrizzleRunRepository],
      useFactory: (runs: DrizzleRunRepository) => new ReleaseHeldRuns(runs),
    },

    {
      provide: INVITE_MAIL,
      inject: [ENV, LOGGER],
      useFactory: (env: Env, logger: LoggerPort) => {
        const transport: MailTransport =
          SmtpMail.configured(env) ?? new WrittenDownMail(logger);

        return new InviteByMail(transport, env);
      },
    },

    {
      provide: REPOSITORY_ACCESS,
      inject: [ENV],
      useFactory: (env: Env) => new GitHubAppAccess(env),
    },

    {
      provide: GITHUB_APP,
      inject: [ENV],
      useFactory: (env: Env) => new GitHubAppIdentity(env),
    },

    {
      provide: DELIVERY_INBOX,
      useClass: DrizzleDeliveryInbox,
    },

    {
      provide: WorkOffDeliveries,
      inject: [DELIVERY_INBOX, ReactToHappeningHandler, TRANSACTION],
      useFactory: (
        inbox: DeliveryInboxPort,
        reacting: ReactToHappeningHandler,
        transaction: TransactionPort,
      ) => new WorkOffDeliveries(inbox, reacting, transaction),
    },

    { provide: DELIVERY_WORK, useExisting: WorkOffDeliveries },

    {
      provide: GracefulShutdown,
      inject: [HttpAdapterHost, LOGGER],
      useFactory: (adapters: HttpAdapterHost, logger: LoggerPort) =>
        new GracefulShutdown(adapters, logger),
    },

    {
      provide: DeliveryWorker,
      inject: [DELIVERY_WORK, LOGGER],
      useFactory: (work: DeliveryWorkPort, logger: LoggerPort) =>
        new DeliveryWorker(work, logger),
    },

    {
      provide: HttpOutbound,
      inject: [ENV],
      useFactory: (env: Env) =>
        new HttpOutbound(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
    },
    { provide: INTEGRATION_CURSORS, useClass: DrizzleIntegrationCursors },
    {
      provide: WorkOffPolls,
      inject: [
        DrizzleTeamConfiguration,
        IntegrationReader,
        DrizzleFactoryRepository,
        TEAM_SECRETS,
        INTEGRATION_CURSORS,
        OAuth2Access,
        ReactToHappenings,
        CLOCK,
        HttpOutbound,
        LOGGER,
      ],
      useFactory: (
        configurations: DrizzleTeamConfiguration,
        reader: IntegrationReader,
        factories: DrizzleFactoryRepository,
        secrets: TeamSecretsPort,
        cursors: IntegrationCursorsPort,
        oauth2: OAuth2Access,
        reactions: ReactToHappenings,
        clock: ClockPort,
        outbound: HttpOutbound,
        logger: LoggerPort,
      ) =>
        new WorkOffPolls(
          configurations,
          reader,
          factories,
          secrets,
          cursors,
          outbound,
          oauth2,
          reactions,
          clock,
          logger,
        ),
    },
    {
      provide: PollWorker,
      inject: [WorkOffPolls, LOGGER],
      useFactory: (polls: WorkOffPolls, logger: LoggerPort) =>
        new PollWorker(polls, logger),
    },
    {
      provide: RunSchedules,
      inject: [
        DrizzleTeamConfiguration,
        IntegrationReader,
        TEAM_SECRETS,
        INTEGRATION_CURSORS,
        OAuth2Access,
        CLOCK,
        HttpOutbound,
        LOGGER,
      ],
      useFactory: (
        configurations: DrizzleTeamConfiguration,
        reader: IntegrationReader,
        secrets: TeamSecretsPort,
        cursors: IntegrationCursorsPort,
        oauth2: OAuth2Access,
        clock: ClockPort,
        outbound: HttpOutbound,
        logger: LoggerPort,
      ) =>
        new RunSchedules(
          configurations,
          reader,
          secrets,
          cursors,
          outbound,
          oauth2,
          clock,
          logger,
        ),
    },
    {
      provide: ScheduleWorker,
      inject: [RunSchedules, LOGGER],
      useFactory: (schedules: RunSchedules, logger: LoggerPort) =>
        new ScheduleWorker(schedules, logger),
    },

    {
      provide: GitHubSource,
      inject: [ENV, DrizzleWorkspaceRepository],
      useFactory: (env: Env, workspaces: DrizzleWorkspaceRepository) =>
        new GitHubSource(new GitHubWebhookSignature(env), workspaces),
    },

    {
      provide: WebhookSources,
      inject: [DiscoveryService],
      // Lazy: discovery only sees providers once the container is built.
      useFactory: (discovery: DiscoveryService) =>
        new WebhookSources(() => markedSources(discovery)),
    },

    {
      provide: GITHUB_IDENTITY,
      inject: [DRIZZLE, ENV],
      useFactory: (db: DrizzleDatabase, env: Env) =>
        new GitHubIdentity(db, env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
    },

    {
      provide: PULL_REQUESTS,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubPullRequests(access),
    },

    {
      provide: REPOSITORY_CONTENTS,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubRepositoryContents(access),
    },

    {
      provide: DELIVERY_ADDRESSES,
      inject: [ENV],
      useFactory: (env: Env) => new WebhookDeliveryAddresses(webhookUrlOf(env)),
    },

    {
      provide: SecretCipher,
      inject: [ENV],
      useFactory: (env: Env) => new SecretCipher(env.SPOTLIGHT_SECRETS_KEY),
    },

    { provide: VAULT_SEALING, useFactory: () => new AgeVaultSealing() },
    {
      provide: TeamVault,
      inject: [VAULT_KEYS, VAULT_SEALING],
      useFactory: (keys: VaultKeyRepository, sealing: VaultSealingPort) =>
        new TeamVault(keys, sealing),
    },
    {
      provide: TEAM_SECRETS,
      inject: [DrizzleTeamConfiguration, VAULT_KEYS, VAULT_SEALING],
      useFactory: (
        configurations: DrizzleTeamConfiguration,
        keys: VaultKeyRepository,
        sealing: VaultSealingPort,
      ) => new VaultTeamSecrets(configurations, keys, sealing),
    },
    {
      provide: TeamIntegrations,
      inject: [
        DrizzleFactoryRepository,
        DrizzleTeamConfiguration,
        INTEGRATION_READER,
      ],
      useFactory: (
        factories: DrizzleFactoryRepository,
        configurations: DrizzleTeamConfiguration,
        reader: IntegrationReaderPort,
      ) => new TeamIntegrations(factories, configurations, reader),
    },

    {
      provide: PendingConfiguration,
      inject: [REPOSITORY_CONTENTS, PULL_REQUESTS],
      useFactory: (
        contents: RepositoryContentsPort,
        pullRequests: PullRequestPort,
      ) => new PendingConfiguration(contents, pullRequests),
    },
    {
      provide: VAULT_KEYS,
      inject: [DrizzleContext, SecretCipher],
      useFactory: (context: DrizzleContext, cipher: SecretCipher) =>
        new DrizzleVaultKeys(context, cipher),
    },

    {
      provide: HOST_CONNECTIONS,
      inject: [DrizzleContext, SecretCipher],
      useFactory: (context: DrizzleContext, cipher: SecretCipher) =>
        new DrizzleHostConnections(context, cipher),
    },
    {
      provide: OAuth2Clients,
      inject: [ENV],
      useFactory: (env: Env) => OAuth2Clients.from(env.OAUTH_CLIENTS),
    },
    {
      provide: OAuth2Exchange,
      inject: [ENV, CLOCK],
      useFactory: (env: Env, clock: ClockPort) =>
        new OAuth2Exchange(
          new Egress(env.OUTBOUND_ALLOWED_HOSTS.split(',')),
          clock,
        ),
    },
    {
      provide: OAuth2Access,
      inject: [HOST_CONNECTIONS],
      useFactory: (connections: HostConnectionRepository) =>
        new OAuth2Access(connections),
    },
    {
      provide: RefreshConnections,
      inject: [
        HOST_CONNECTIONS,
        DrizzleTeamConfiguration,
        IntegrationReader,
        OAuth2Clients,
        OAuth2Exchange,
        CLOCK,
        LOGGER,
      ],
      useFactory: (
        connections: HostConnectionRepository,
        configurations: DrizzleTeamConfiguration,
        reader: IntegrationReader,
        clients: OAuth2Clients,
        exchange: OAuth2Exchange,
        clock: ClockPort,
        logger: LoggerPort,
      ) =>
        new RefreshConnections(
          connections,
          configurations,
          reader,
          clients,
          exchange,
          clock,
          logger,
        ),
    },
    {
      provide: ConnectionRefreshWorker,
      inject: [RefreshConnections, LOGGER],
      useFactory: (connections: RefreshConnections, logger: LoggerPort) =>
        new ConnectionRefreshWorker(connections, logger),
    },
    {
      provide: OAuth2State,
      inject: [ENV],
      useFactory: (env: Env) => new OAuth2State(env.BETTER_AUTH_SECRET),
    },
    {
      provide: OAUTH2_LINKING,
      inject: [
        DrizzleTeamConfiguration,
        IntegrationReader,
        OAuth2Clients,
        OAuth2Exchange,
        DrizzleFactoryRepository,
        WORKSPACE_READER,
        OAuth2State,
        ENV,
      ],
      useFactory: (
        configurations: DrizzleTeamConfiguration,
        reader: IntegrationReader,
        clients: OAuth2Clients,
        exchange: OAuth2Exchange,
        factories: DrizzleFactoryRepository,
        workspaces: WorkspaceReaderPort,
        state: OAuth2State,
        env: Env,
      ) =>
        new OAuth2Linking(
          configurations,
          reader,
          clients,
          exchange,
          factories,
          workspaces,
          state,
          publicUrlOf(env),
        ),
    },

    DrizzleTeamConfiguration,

    IntegrationReader,
    { provide: INTEGRATION_READER, useExisting: IntegrationReader },

    LineConfigReader,
    { provide: LINE_CONFIG_READER, useExisting: LineConfigReader },

    {
      provide: HeldConfiguration,
      inject: [REPOSITORY_CONTENTS],
      useFactory: (contents: RepositoryContentsPort) =>
        new HeldConfiguration(contents),
    },
    {
      provide: SeedConfiguration,
      inject: [
        LINE_CONFIG_READER,
        ConfigurationTarget,
        HeldConfiguration,
        WriteConfiguration,
      ],
      useFactory: (
        reader: LineConfigReaderPort,
        target: ConfigurationTarget,
        held: HeldConfiguration,
        writing: WriteConfiguration,
      ) => new SeedConfiguration(reader, target, held, writing),
    },
    {
      provide: RepositoryProvisioning,
      inject: [REPOSITORY_CATALOG],
      useFactory: (catalog: RepositoryCatalogPort) =>
        new RepositoryProvisioning(catalog),
    },

    {
      provide: ConfigurationTarget,
      inject: [DrizzleTeamConfiguration],
      useFactory: (configurations: DrizzleTeamConfiguration) =>
        new ConfigurationTarget(configurations),
    },
    {
      provide: WriteConfiguration,
      inject: [PULL_REQUESTS],
      useFactory: (pullRequests: PullRequestPort) =>
        new WriteConfiguration(pullRequests),
    },
    {
      provide: ProposeConfigurationChange,
      inject: [
        DrizzleWorkspaceRepository,
        WORKSPACE_READER,
        DrizzleTeamRepository,
        DrizzleLineRepository,
        LINE_CONFIG_READER,
        ConfigurationTarget,
        WriteConfiguration,
        PendingConfiguration,
        ID_GENERATOR,
      ],
      useFactory: (
        workspaces: DrizzleWorkspaceRepository,
        members: WorkspaceReaderPort,
        teams: DrizzleTeamRepository,
        lines: DrizzleLineRepository,
        reader: LineConfigReaderPort,
        target: ConfigurationTarget,
        writing: WriteConfiguration,
        pending: PendingConfiguration,
        ids: IdGeneratorPort,
      ) =>
        new ProposeConfigurationChange(
          workspaces,
          members,
          teams,
          lines,
          reader,
          target,
          writing,
          pending,
          ids,
        ),
    },

    {
      provide: ApplyLines,
      inject: [
        DrizzleLineRepository,
        DrizzleFactoryRepository,
        DrizzleTaskRepository,
        LINE_CONFIG_READER,
        ID_GENERATOR,
        TRANSACTION,
      ],
      useFactory: (
        lines: DrizzleLineRepository,
        factories: DrizzleFactoryRepository,
        tasks: DrizzleTaskRepository,
        reader: LineConfigReaderPort,
        ids: IdGeneratorPort,
        transaction: TransactionPort,
      ) => new ApplyLines(lines, factories, tasks, reader, ids, transaction),
    },

    { provide: JwksCache, useFactory: () => new JwksCache() },
    {
      provide: CONFIGURED_SOURCES,
      inject: [
        DrizzleTeamConfiguration,
        TEAM_SECRETS,
        IntegrationReader,
        JwksCache,
        HttpOutbound,
      ],
      useFactory: (
        configurations: DrizzleTeamConfiguration,
        secrets: TeamSecretsPort,
        reader: IntegrationReader,
        jwks: JwksCache,
        outbound: HttpOutbound,
      ) =>
        new ConfiguredSources(configurations, secrets, reader, jwks, outbound),
    },

    {
      provide: AttendToNotices,
      inject: [
        DrizzleTeamRepository,
        DrizzleWorkspaceRepository,
        ReadConfiguration,
        LOGGER,
      ],
      useFactory: (
        teams: DrizzleTeamRepository,
        workspaces: DrizzleWorkspaceRepository,
        reading: ReadConfiguration,
        logger: LoggerPort,
      ) => new AttendToNotices(teams, workspaces, reading, logger),
    },

    {
      provide: ReactToHappenings,
      inject: [
        DrizzleTaskRepository,
        DrizzleLineRepository,
        TASK_DISPATCH,
        TRANSACTION,
        CLOCK,
        ID_GENERATOR,
        MEMBER_READER,
        AnnounceTaskEvents,
        ATTACHMENT_STORE,
        LOGGER,
      ],
      useFactory: (
        tasks: DrizzleTaskRepository,
        lines: DrizzleLineRepository,
        dispatch: TaskDispatching,
        transaction: TransactionPort,
        clock: ClockPort,
        ids: IdGeneratorPort,
        members: MemberReaderPort,
        announce: AnnounceTaskEvents,
        files: AttachmentStorePort,
        logger: LoggerPort,
      ) =>
        new ReactToHappenings(
          tasks,
          lines,
          dispatch,
          transaction,
          clock,
          ids,
          members,
          announce,
          files,
          logger,
        ),
    },

    {
      provide: ConnectionAuthorization,
      inject: [WORKSPACE_READER, DrizzleWorkspaceRepository],
      useFactory: (
        teams: WorkspaceReaderPort,
        workspaces: DrizzleWorkspaceRepository,
      ) => new ConnectionAuthorization(teams, workspaces),
    },

    {
      provide: SettleSetup,
      inject: [DrizzleTaskRepository, TeamSetup, CLOCK, LOGGER],
      useFactory: (
        tasks: DrizzleTaskRepository,
        setup: TeamSetup,
        clock: ClockPort,
        logger: LoggerPort,
      ) => new SettleSetup(tasks, setup, clock, logger),
    },

    {
      provide: TeamSetup,
      inject: [
        DrizzleWorkspaceRepository,
        DrizzleTeamConfiguration,
        INTEGRATION_READER,
        RUNNER_READER,
        DrizzleTeamRepository,
      ],
      useFactory: (
        connections: DrizzleWorkspaceRepository,
        configurations: DrizzleTeamConfiguration,
        integrations: IntegrationReaderPort,
        runners: RunnerReaderPort,
        teams: DrizzleTeamRepository,
      ) =>
        new TeamSetup(
          connections,
          configurations,
          integrations,
          runners,
          teams,
        ),
    },

    {
      provide: ReadConfiguration,
      inject: [
        REPOSITORY_CATALOG,
        ConfigurationTarget,
        HeldConfiguration,
        INTEGRATION_READER,
        SKILL_READER,
        TeamVault,
        ApplyLines,
        DrizzleTeamRepository,
        DrizzleTeamConfiguration,
        DOMAIN_EVENT_DISPATCHER,
        CLOCK,
        SettleSetup,
      ],
      useFactory: (
        catalog: RepositoryCatalogPort,
        target: ConfigurationTarget,
        held: HeldConfiguration,
        integrations: IntegrationReaderPort,
        skills: SkillReaderPort,
        vault: TeamVault,
        lines: ApplyLines,
        teams: DrizzleTeamRepository,
        configurations: DrizzleTeamConfiguration,
        events: DomainEventDispatcher,
        clock: ClockPort,
        settling: SettleSetup,
      ) =>
        new ReadConfiguration(
          catalog,
          target,
          held,
          integrations,
          skills,
          vault,
          lines,
          teams,
          configurations,
          events,
          clock,
          settling,
        ),
    },

    {
      provide: SourceForDelivery,
      inject: [WebhookSources, CONFIGURED_SOURCES],
      useFactory: (
        registered: WebhookSources,
        configured: ConfiguredSourcesPort,
      ) => new SourceForDelivery(registered, configured),
    },

    {
      provide: REMARKS,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) => new GitHubRemarks(access),
    },

    {
      provide: REPOSITORY_CATALOG,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubRepositoryCatalog(access),
    },

    {
      provide: REPOSITORY_GIT,
      inject: [REPOSITORY_ACCESS],
      useFactory: (access: RepositoryAccessPort) =>
        new GitHubGitTransport(access),
    },

    {
      provide: RunAtHand,
      inject: [DrizzleRunRepository, DrizzleTaskRepository],
      useFactory: (runs: DrizzleRunRepository, tasks: DrizzleTaskRepository) =>
        new RunAtHand(runs, tasks),
    },

    {
      provide: ConversationAtHand,
      inject: [DrizzleTaskRepository, DrizzleLineRepository],
      useFactory: (
        tasks: DrizzleTaskRepository,
        lines: DrizzleLineRepository,
      ) => new ConversationAtHand(tasks, lines),
    },

    {
      provide: RunWorks,
      inject: [
        DrizzleRunRepository,
        DrizzleTaskRepository,
        DrizzleChatRepository,
        DrizzleLineRepository,
      ],
      useFactory: (
        runs: DrizzleRunRepository,
        tasks: DrizzleTaskRepository,
        chats: DrizzleChatRepository,
        lines: DrizzleLineRepository,
      ) => new RunWorks(runs, tasks, chats, lines),
    },

    {
      provide: GIT_GATEWAY,
      inject: [RunWorks, DrizzleWorkspaceRepository, REPOSITORY_GIT],
      useFactory: (
        works: RunWorks,
        workspaces: DrizzleWorkspaceRepository,
        git: RepositoryGitPort,
      ) => new CarryGitCall(works, workspaces, git),
    },

    {
      provide: ChatAtHand,
      inject: [DrizzleChatRepository],
      useFactory: (chats: DrizzleChatRepository) => new ChatAtHand(chats),
    },

    {
      provide: CHAT_DISPATCH,
      inject: [
        DrizzleRunRepository,
        ID_GENERATOR,
        HARNESS_LAUNCH,
        TRACE_PARENT,
        DrizzleTeamRepository,
        DrizzleLineRepository,
        CLOCK,
      ],
      useFactory: (
        runs: DrizzleRunRepository,
        ids: IdGeneratorPort,
        launch: HarnessLaunchPort,
        tracing: TraceParentPort,
        teams: DrizzleTeamRepository,
        lines: DrizzleLineRepository,
        clock: ClockPort,
      ) => new DispatchChat(runs, ids, launch, tracing, teams, lines, clock),
    },

    {
      provide: CreateTaskFromProposal,
      inject: [
        DrizzleChatRepository,
        DrizzleLineRepository,
        DrizzleTaskRepository,
        RaiseTask,
        ID_GENERATOR,
        CLOCK,
      ],
      useFactory: (
        chats: DrizzleChatRepository,
        lines: DrizzleLineRepository,
        tasks: DrizzleTaskRepository,
        raise: RaiseTask,
        ids: IdGeneratorPort,
        clock: ClockPort,
      ) => new CreateTaskFromProposal(chats, lines, tasks, raise, ids, clock),
    },

    BuiltInHarnesses,

    { provide: TRACE_PARENT, useClass: HashedTraceParent },

    { provide: BUILT_IN_SKILLS, useFactory: () => new BuiltInSkillFiles() },

    { provide: SKILL_READER, useFactory: () => new TeamSkillFiles() },

    {
      provide: TeamSkills,
      inject: [
        DrizzleFactoryRepository,
        DrizzleTeamConfiguration,
        SKILL_READER,
        TEAM_SECRETS,
      ],
      useFactory: (
        factories: DrizzleFactoryRepository,
        configurations: DrizzleTeamConfiguration,
        reader: SkillReaderPort,
        secrets: TeamSecretsPort,
      ) => new TeamSkills(factories, configurations, reader, secrets),
    },

    {
      provide: TASK_DISPATCH,
      inject: [
        DrizzleRunRepository,
        ID_GENERATOR,
        BuiltInHarnesses,
        HARNESS_LAUNCH,
        TRACE_PARENT,
        BUILT_IN_SKILLS,
        TeamSkills,
        TeamIntegrations,
      ],
      useFactory: (
        runs: DrizzleRunRepository,
        ids: CryptoIdGenerator,
        harnesses: BuiltInHarnesses,
        launch: HarnessLaunchPort,
        tracing: TraceParentPort,
        skills: BuiltInSkillsPort,
        teamSkills: TeamSkills,
        integrations: TeamIntegrations,
      ) =>
        new DispatchTask(
          runs,
          ids,
          harnesses,
          launch,
          tracing,
          skills,
          teamSkills,
          integrations,
        ),
    },

    {
      provide: RaiseTask,
      inject: [DrizzleTaskRepository, TASK_DISPATCH, TRANSACTION],
      useFactory: (
        tasks: DrizzleTaskRepository,
        dispatch: DispatchTask,
        transaction: TransactionPort,
      ) => new RaiseTask(tasks, dispatch, transaction),
    },

    {
      provide: STANDING_WORK,
      inject: [DrizzleTaskRepository, TASK_DISPATCH],
      useFactory: (tasks: DrizzleTaskRepository, dispatch: DispatchTask) =>
        new TakeUpStandingWork(tasks, dispatch),
    },

    {
      provide: OUTBOUND_TASK_NOTIFIER,
      inject: [
        DrizzleLineRepository,
        DrizzleFactoryRepository,
        DrizzleTeamConfiguration,
        IntegrationReader,
        TEAM_SECRETS,
        OAuth2Access,
        WORKSPACE_READER,
        HttpOutbound,
        ENV,
        LOGGER,
      ],
      useFactory: (
        lines: DrizzleLineRepository,
        factories: DrizzleFactoryRepository,
        configurations: DrizzleTeamConfiguration,
        reader: IntegrationReader,
        secrets: TeamSecretsPort,
        oauth2: OAuth2Access,
        workspaces: WorkspaceReaderPort,
        outbound: HttpOutbound,
        env: Env,
        logger: LoggerPort,
      ) =>
        new OutboundTaskNotifier(
          lines,
          factories,
          configurations,
          reader,
          secrets,
          outbound,
          oauth2,
          workspaces,
          publicUrlOf(env),
          logger,
        ),
    },

    {
      provide: AnnounceTaskEvents,
      inject: [OUTBOUND_TASK_NOTIFIER, DrizzleTaskRepository],
      useFactory: (
        notifier: OutboundTaskNotifierPort,
        tasks: DrizzleTaskRepository,
      ) => new AnnounceTaskEvents(notifier, tasks),
    },

    {
      provide: RUN_OUTCOMES,
      inject: [
        DrizzleTaskRepository,
        DrizzleLineRepository,
        TASK_DISPATCH,
        CLOCK,
        RUN_DIGEST_WRITER,
        AnnounceTaskEvents,
        DrizzleChatRepository,
        CHAT_DISPATCH,
      ],
      useFactory: (
        tasks: DrizzleTaskRepository,
        lines: DrizzleLineRepository,
        dispatch: TaskDispatching,
        clock: ClockPort,
        digests: RunDigestWriterPort,
        announce: AnnounceTaskEvents,
        chats: DrizzleChatRepository,
        chatDispatch: ChatDispatching,
      ) =>
        new RunOutcomesFanOut(
          new HandOver(tasks, lines, dispatch, clock, announce),
          new ChatOutcomes(chats, chatDispatch),
          new DigestRun(digests),
        ),
    },

    {
      provide: FACTORY_PROVISIONING,
      useFactory: (
        factories: DrizzleFactoryRepository,
        lines: DrizzleLineRepository,
        ids: CryptoIdGenerator,
        tasks: DrizzleTaskRepository,
        clock: ClockPort,
        workspaces: DrizzleWorkspaceRepository,
        transaction: TransactionPort,
      ) =>
        new ProvisionFactory(
          factories,
          lines,
          ids,
          tasks,
          clock,
          workspaces,
          DEFAULT_HARNESS,
          transaction,
        ),
      inject: [
        DrizzleFactoryRepository,
        DrizzleLineRepository,
        ID_GENERATOR,
        DrizzleTaskRepository,
        CLOCK,
        DrizzleWorkspaceRepository,
        TRANSACTION,
      ],
    },

    {
      provide: SettleOnConnection,
      inject: [SettleSetup],
      useFactory: (settling: SettleSetup) => new SettleOnConnection(settling),
    },

    {
      provide: DOMAIN_EVENT_DISPATCHER,
      inject: [
        RUN_OUTCOMES,
        FACTORY_PROVISIONING,
        RUNNER_REVOCATION,
        SettleOnConnection,
        CreateTaskFromProposal,
        TRANSACTION,
        LOGGER,
      ],
      useFactory: (
        outcomes: RunOutcomes,
        provisioning: FactoryProvisioningPort,
        revocation: RunnerRevocationPort,
        settling: SettleOnConnection,
        acceptances: CreateTaskFromProposal,
        transaction: TransactionPort,
        logger: LoggerPort,
      ) =>
        new RoutingDispatcher(
          outcomes,
          provisioning,
          revocation,
          settling,
          acceptances,
          transaction,
          logger,
        ),
    },

    ...bindQueryHandler(ListWorkspacesQuery, ListWorkspacesHandler, [
      WORKSPACE_READER,
    ]),
    ...bindQueryHandler(GetWorkspaceQuery, GetWorkspaceHandler, [
      WORKSPACE_READER,
    ]),
    ...bindQueryHandler(ListLinesQuery, ListLinesHandler, [LINE_READER]),
    ...bindQueryHandler(ListTasksQuery, ListTasksHandler, [TASK_READER]),
    ...bindQueryHandler(ListMembersQuery, ListMembersHandler, [MEMBER_READER]),
    ...bindQueryHandler(ListInvitesQuery, ListInvitesHandler, [INVITE_READER]),
    ...bindQueryHandler(ReadInviteQuery, ReadInviteHandler, [
      INVITE_READER,
      TOKEN_MINT,
    ]),
    ...bindQueryHandler(ListTaskRunsQuery, ListTaskRunsHandler, [RUN_READER]),
    ...bindQueryHandler(ListTeamRunsQuery, ListTeamRunsHandler, [RUN_READER]),
    ...bindQueryHandler(FindStationQuery, FindStationHandler, [LINE_READER]),
    ...bindQueryHandler(ReadRunConversationQuery, ReadRunConversationHandler, [
      RUN_READER,
    ]),
    ...bindQueryHandler(ReadAttachmentQuery, ReadAttachmentHandler, [
      WORKSPACE_READER,
      ATTACHMENT_READER,
      ATTACHMENT_STORE,
    ]),
    ...bindQueryHandler(ReadRunAttachmentQuery, ReadRunAttachmentHandler, [
      RunWorks,
      ATTACHMENT_STORE,
    ]),
    ...bindQueryHandler(PendingMessagesQuery, PendingMessagesHandler, [
      RunWorks,
    ]),
    ...bindQueryHandler(ListChatsQuery, ListChatsHandler, [
      WORKSPACE_READER,
      CHAT_READER,
    ]),
    ...bindQueryHandler(ReadChatQuery, ReadChatHandler, [CHAT_READER]),
    ...bindQueryHandler(ReadChatJournalQuery, ReadChatJournalHandler, [
      RUN_JOURNAL_READER,
    ]),
    ...bindQueryHandler(RunStopRequestedQuery, RunStopRequestedHandler, [
      DrizzleRunRepository,
    ]),
    ...bindQueryHandler(ListHarnessesQuery, ListHarnessesHandler, [
      HARNESS_LAUNCH,
      RUNNER_READER,
    ]),
    ...bindQueryHandler(ListHappeningsQuery, ListHappeningsHandler, [
      WORKSPACE_READER,
      WebhookSources,
    ]),
    ...bindQueryHandler(ListRepositoriesQuery, ListRepositoriesHandler, [
      WORKSPACE_READER,
      DrizzleWorkspaceRepository,
      REPOSITORY_CATALOG,
    ]),
    ...bindQueryHandler(ListInboxQuery, ListInboxHandler, [INBOX_READER]),
    ...bindQueryHandler(ListRunnersQuery, ListRunnersHandler, [
      RUNNER_READER,
      CLOCK,
    ]),
    ...bindQueryHandler(ListTeamTracesQuery, ListTeamTracesHandler, [
      TEAM_TRACE_READER,
      RUN_DIGESTS,
    ]),

    ...bindQueryHandler(ReadTaskTraceQuery, ReadTaskTraceHandler, [
      RUN_READER,
      RUN_JOURNAL_READER,
    ]),

    ...bindQueryHandler(ReadRunnerTraceQuery, ReadRunnerTraceHandler, [
      RUNNER_TRACE_READER,
    ]),

    ...bindQueryHandler(ReadTaskJournalQuery, ReadTaskJournalHandler, [
      RUN_JOURNAL_READER,
    ]),

    ...bindQueryHandler(ListKeptWorkspacesQuery, ListKeptWorkspacesHandler, [
      KEPT_WORKSPACE_READER,
    ]),
    ...bindQueryHandler(WatchRunQuery, WatchRunHandler, [RUN_EVENT_READER]),
    ...bindQueryHandler(ReadRunEventsQuery, ReadRunEventsHandler, [
      RUN_EVENT_READER,
    ]),
    ...bindCommandHandler(CreateWorkspaceCommand, CreateWorkspaceHandler, [
      DrizzleWorkspaceRepository,
      DrizzleTeamRepository,
      ID_GENERATOR,
      TRANSACTION,
      DOMAIN_EVENT_DISPATCHER,
    ]),

    ...bindCommandHandler(AddTaskCommand, AddTaskHandler, [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      ID_GENERATOR,
      CLOCK,
      RaiseTask,
      PERSON_READER,
      FilesAtHand,
    ]),

    ...bindCommandHandler(
      GrantAttachmentUploadCommand,
      GrantAttachmentUploadHandler,
      [WORKSPACE_READER, ATTACHMENT_STORE, ID_GENERATOR],
    ),

    ...bindCommandHandler(AnalyseTraceCommand, AnalyseTraceHandler, [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      DrizzleTeamRepository,
      ID_GENERATOR,
      CLOCK,
      RaiseTask,
      PERSON_READER,
    ]),

    ...bindCommandHandler(DeleteTaskCommand, DeleteTaskHandler, [
      DrizzleTaskRepository,
    ]),

    ...bindCommandHandler(AnswerInboxItemCommand, AnswerInboxItemHandler, [
      ConversationAtHand,
      DrizzleTaskRepository,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
      FilesAtHand,
    ]),

    ...bindCommandHandler(
      BeginOAuth2ConnectionCommand,
      BeginOAuth2ConnectionHandler,
      [ConnectionAuthorization, OAUTH2_LINKING],
    ),
    ...bindCommandHandler(
      FinishOAuth2ConnectionCommand,
      FinishOAuth2ConnectionHandler,
      [
        OAUTH2_LINKING,
        HOST_CONNECTIONS,
        ConnectionAuthorization,
        TRANSACTION,
        DOMAIN_EVENT_DISPATCHER,
      ],
    ),
    ...bindCommandHandler(PinConfigurationCommand, PinConfigurationHandler, [
      ConnectionAuthorization,
      DrizzleTeamRepository,
      ConfigurationTarget,
      RepositoryProvisioning,
      SettleSetup,
    ]),
    ...bindCommandHandler(MoveConfigurationCommand, MoveConfigurationHandler, [
      ConnectionAuthorization,
      DrizzleTeamRepository,
      DrizzleTeamConfiguration,
      ConfigurationTarget,
      RepositoryProvisioning,
      HeldConfiguration,
      WriteConfiguration,
      SettleSetup,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(SetUpLinesCommand, SetUpLinesHandler, [
      ConnectionAuthorization,
      DrizzleTeamRepository,
      DrizzleLineRepository,
      SeedConfiguration,
      SettleSetup,
    ]),
    ...bindCommandHandler(RenameTeamCommand, RenameTeamHandler, [
      ConnectionAuthorization,
      DrizzleTeamRepository,
    ]),
    ...bindCommandHandler(InviteToTeamCommand, InviteToTeamHandler, [
      ConnectionAuthorization,
      DrizzleTeamRepository,
      DrizzleInviteRepository,
      MEMBER_READER,
      PERSON_READER,
      TOKEN_MINT,
      INVITE_MAIL,
      ID_GENERATOR,
      CLOCK,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(RevokeInviteCommand, RevokeInviteHandler, [
      ConnectionAuthorization,
      DrizzleInviteRepository,
      CLOCK,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(ChangeMemberRoleCommand, ChangeMemberRoleHandler, [
      DrizzleWorkspaceRepository,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(AcceptInviteCommand, AcceptInviteHandler, [
      DrizzleInviteRepository,
      DrizzleTeamRepository,
      DrizzleWorkspaceRepository,
      TOKEN_MINT,
      DOMAIN_EVENT_DISPATCHER,
      CLOCK,
    ]),
    ...bindCommandHandler(
      ChooseIntegrationsCommand,
      ChooseIntegrationsHandler,
      [
        ProposeConfigurationChange,
        STARTER_INTEGRATIONS,
        INTEGRATION_READER,
        PendingConfiguration,
        TeamVault,
      ],
    ),
    ...bindQueryHandler(OnboardingQuery, OnboardingHandler, [
      WORKSPACE_READER,
      TeamSetup,
      GITHUB_APP,
      DrizzleLineRepository,
      STARTER_INTEGRATIONS,
      INTEGRATION_READER,
      DELIVERY_ADDRESSES,
    ]),
    ...bindCommandHandler(ReadConfigurationCommand, ReadConfigurationHandler, [
      DrizzleWorkspaceRepository,
      WORKSPACE_READER,
      DrizzleTeamRepository,
      ReadConfiguration,
    ]),
    ...bindQueryHandler(ConfigurationQuery, ConfigurationHandler, [
      WORKSPACE_READER,
      DrizzleTeamRepository,
      DrizzleTeamConfiguration,
      INTEGRATION_READER,
      HOST_CONNECTIONS,
    ]),
    ...bindCommandHandler(RevealVaultKeyCommand, RevealVaultKeyHandler, [
      ConnectionAuthorization,
      TeamVault,
    ]),
    ...bindQueryHandler(TeamSkillsQuery, TeamSkillsHandler, [
      WORKSPACE_READER,
      DrizzleTeamConfiguration,
      SKILL_READER,
    ]),

    ...bindCommandHandler(AcceptDeliveryCommand, AcceptDeliveryHandler, [
      SourceForDelivery,
      DELIVERY_INBOX,
    ]),
    ...bindCommandHandler(ReactToHappeningCommand, ReactToHappeningHandler, [
      SourceForDelivery,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
      AttendToNotices,
      ID_GENERATOR,
      MEMBER_READER,
      AnnounceTaskEvents,
      ATTACHMENT_STORE,
      LOGGER,
    ]),

    ...bindCommandHandler(ReadInboxItemCommand, ReadInboxItemHandler, [
      ConversationAtHand,
      DrizzleTaskRepository,
      CLOCK,
    ]),

    ...bindCommandHandler(ConnectGitHubCommand, ConnectGitHubHandler, [
      DrizzleWorkspaceRepository,
      GITHUB_IDENTITY,
      TRANSACTION,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    {
      provide: OpenPullRequest,
      inject: [
        DrizzleTaskRepository,
        DrizzleWorkspaceRepository,
        PULL_REQUESTS,
        AnnounceTaskEvents,
      ],
      useFactory: (
        tasks: DrizzleTaskRepository,
        workspaces: DrizzleWorkspaceRepository,
        pullRequests: PullRequestPort,
        announce: AnnounceTaskEvents,
      ) => new OpenPullRequest(tasks, workspaces, pullRequests, announce),
    },
    {
      provide: BUILT_IN_TOOL_USES,
      inject: [
        OpenPullRequest,
        DrizzleChatRepository,
        DOMAIN_EVENT_DISPATCHER,
        CLOCK,
      ],
      useFactory: (
        opening: OpenPullRequest,
        chats: DrizzleChatRepository,
        events: DomainEventDispatcher,
        clock: ClockPort,
      ): readonly BuiltInToolUse[] => [
        new PullRequestToolUse(opening),
        new ProposeTaskToolUse(chats, events, clock),
      ],
    },
    {
      provide: BuiltInTools,
      inject: [BUILT_IN_TOOL_USES],
      useFactory: (uses: readonly BuiltInToolUse[]) => new BuiltInTools(uses),
    },
    {
      provide: INTEGRATION_TOOLS,
      inject: [
        DrizzleFactoryRepository,
        DrizzleTeamConfiguration,
        IntegrationReader,
        TEAM_SECRETS,
        OAuth2Access,
        HttpOutbound,
      ],
      useFactory: (
        factories: DrizzleFactoryRepository,
        configurations: DrizzleTeamConfiguration,
        reader: IntegrationReader,
        secrets: TeamSecretsPort,
        oauth2: OAuth2Access,
        outbound: HttpOutbound,
      ) =>
        new IntegrationToolUses(
          factories,
          configurations,
          reader,
          secrets,
          outbound,
          oauth2,
        ),
    },
    ...bindCommandHandler(UseToolCommand, UseToolHandler, [
      RunWorks,
      BuiltInTools,
      INTEGRATION_TOOLS,
    ]),
    ...bindCommandHandler(StartChatCommand, StartChatHandler, [
      WORKSPACE_READER,
      DrizzleChatRepository,
      FilesAtHand,
      CHAT_DISPATCH,
      HARNESS_LAUNCH,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(SayInChatCommand, SayInChatHandler, [
      ChatAtHand,
      DrizzleChatRepository,
      FilesAtHand,
      CHAT_DISPATCH,
      CLOCK,
      TRANSACTION,
    ]),
    ...bindCommandHandler(StopChatCommand, StopChatHandler, [
      ChatAtHand,
      DrizzleRunRepository,
      CLOCK,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(AcceptProposalCommand, AcceptProposalHandler, [
      ChatAtHand,
      DrizzleChatRepository,
      CLOCK,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(DismissProposalCommand, DismissProposalHandler, [
      ChatAtHand,
      DrizzleChatRepository,
      CLOCK,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(AnswerRemarkCommand, AnswerRemarkHandler, [
      RunAtHand,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      DrizzleWorkspaceRepository,
      REMARKS,
      CLOCK,
    ]),
    ...bindCommandHandler(SayToRunCommand, SayToRunHandler, [
      DrizzleRunRepository,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      CLOCK,
      FilesAtHand,
    ]),
    ...bindCommandHandler(StopRunCommand, StopRunHandler, [
      DrizzleRunRepository,
      DrizzleTaskRepository,
      CLOCK,
      DOMAIN_EVENT_DISPATCHER,
    ]),

    ...bindCommandHandler(DeliverSaidCommand, DeliverSaidHandler, [
      RunWorks,
      CLOCK,
    ]),

    ...bindCommandHandler(MoveTaskCommand, MoveTaskHandler, [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      TRANSACTION,
      TASK_DISPATCH,
      CLOCK,
      PERSON_READER,
    ]),
    ...bindCommandHandler(AssignTaskCommand, AssignTaskHandler, [
      DrizzleTaskRepository,
      DrizzleTeamRepository,
      TRANSACTION,
      PERSON_READER,
    ]),

    ...bindCommandHandler(CreateLabelCommand, CreateLabelHandler, [
      DrizzleLabelRepository,
      DrizzleTeamRepository,
      ID_GENERATOR,
    ]),

    ...bindCommandHandler(RenameLabelCommand, RenameLabelHandler, [
      DrizzleLabelRepository,
      DrizzleTeamRepository,
    ]),

    ...bindCommandHandler(RecolourLabelCommand, RecolourLabelHandler, [
      DrizzleLabelRepository,
      DrizzleTeamRepository,
    ]),

    ...bindCommandHandler(DeleteLabelCommand, DeleteLabelHandler, [
      DrizzleLabelRepository,
      DrizzleTeamRepository,
    ]),

    ...bindCommandHandler(LabelTaskCommand, LabelTaskHandler, [
      DrizzleLabelRepository,
      DrizzleTaskRepository,
      DrizzleTeamRepository,
    ]),

    ...bindCommandHandler(UnlabelTaskCommand, UnlabelTaskHandler, [
      DrizzleLabelRepository,
      DrizzleTaskRepository,
      DrizzleTeamRepository,
    ]),

    ...bindQueryHandler(ListLabelsQuery, ListLabelsHandler, [
      DrizzleLabelRepository,
      DrizzleTeamRepository,
    ]),

    ...bindCommandHandler(CustomiseStationCommand, CustomiseStationHandler, [
      ProposeConfigurationChange,
    ]),

    ...bindCommandHandler(
      SetLineRepositoriesCommand,
      SetLineRepositoriesHandler,
      [ProposeConfigurationChange],
    ),

    ...bindCommandHandler(EnrolRunnerCommand, EnrolRunnerHandler, [
      DrizzleRunnerRepository,
      ID_GENERATOR,
      TOKEN_MINT,
    ]),
    ...bindCommandHandler(RegisterRunnerCommand, RegisterRunnerHandler, [
      DrizzleRunnerRepository,
      CLOCK,
      TRANSACTION,
      RUNNER_READER,
      SettleSetup,
    ]),
    ...bindCommandHandler(RevokeRunnerCommand, RevokeRunnerHandler, [
      DrizzleRunnerRepository,
      CLOCK,
      TRANSACTION,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(ClaimRunCommand, ClaimRunHandler, [
      DrizzleRunRepository,
      DrizzleRunnerRepository,
      CLOCK,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(RenewLeaseCommand, RenewLeaseHandler, [
      DrizzleRunRepository,
      DrizzleRunnerRepository,
      CLOCK,
      TRANSACTION,
    ]),
    ...bindCommandHandler(AppendRunEventsCommand, AppendRunEventsHandler, [
      DrizzleRunRepository,
      RUN_STREAM,
    ]),
    ...bindCommandHandler(CompleteRunCommand, CompleteRunHandler, [
      DrizzleRunRepository,
      TRANSACTION,
      DOMAIN_EVENT_DISPATCHER,
    ]),
    ...bindCommandHandler(EnqueueRunCommand, EnqueueRunHandler, [
      DrizzleRunRepository,
      ID_GENERATOR,
      HARNESS_LAUNCH,
    ]),

    // RunnerGuard must run before AuthenticatedGuard.
    { provide: APP_GUARD, useClass: RunnerGuard },
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    { provide: APP_FILTER, useClass: ServerFaultFilter },
    { provide: APP_FILTER, useClass: UseCaseFaultFilter },
  ],
})
export class AppModule {}
