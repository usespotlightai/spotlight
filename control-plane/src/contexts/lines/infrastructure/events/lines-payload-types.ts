import { LineCreated } from '@lines/domain/events/line-created.event';
import { LineDeleted } from '@lines/domain/events/line-deleted.event';
import { LineUpdated } from '@lines/domain/events/line-updated.event';
import { AgentPrompt } from '@lines/domain/value-objects/agent-prompt.vo';
import { ConfigSource } from '@lines/domain/value-objects/config-source.vo';
import { DefaultAssignee } from '@lines/domain/value-objects/default-assignee.vo';
import { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import { LineRepositories } from '@lines/domain/value-objects/line-repositories.vo';
import { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import { Reaction } from '@lines/domain/value-objects/reaction.vo';
import { ReplayCheckPolicy } from '@lines/domain/value-objects/replay-check-policy.vo';
import { RepositorySetup } from '@lines/domain/value-objects/repository-setup.vo';
import { ReviewPolicy } from '@lines/domain/value-objects/review-policy.vo';
import { SearchInterval } from '@lines/domain/value-objects/search-interval.vo';
import {
  LineSearchPolicy,
  SearchAgent,
  StationSearchOverride,
} from '@lines/domain/value-objects/search-policy.vo';
import { SpendCeiling } from '@lines/domain/value-objects/spend-ceiling.vo';
import { StationAlert } from '@lines/domain/value-objects/station-alert.vo';
import { StationCheck } from '@lines/domain/value-objects/station-check.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationDescription } from '@lines/domain/value-objects/station-description.vo';
import { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import { StationRoutes } from '@lines/domain/value-objects/station-routes.vo';
import { TaskCounts } from '@lines/domain/value-objects/stranded-station';
import { WarmSandboxCount } from '@lines/domain/value-objects/warm-sandbox-count.vo';

export const LINES_PAYLOAD_TYPES = [
  WarmSandboxCount,
  LineCreated,
  LineDeleted,
  LineUpdated,
  AgentPrompt,
  ConfigSource,
  DefaultAssignee,
  LinePlan,
  LineRepositories,
  LineRepositoryConfig,
  Reaction,
  ReplayCheckPolicy,
  RepositorySetup,
  ReviewPolicy,
  SearchInterval,
  SearchAgent,
  StationSearchOverride,
  LineSearchPolicy,
  SpendCeiling,
  StationAlert,
  StationCheck,
  StationColor,
  StationDescription,
  StationJudge,
  StationRoutes,
  TaskCounts,
] as const;
