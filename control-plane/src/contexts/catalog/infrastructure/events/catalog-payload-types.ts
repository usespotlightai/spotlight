import { WorkspacePlanCreated } from '@catalog/domain/events/workspace-plan-created.event';
import { WorkspacePlanDeleted } from '@catalog/domain/events/workspace-plan-deleted.event';
import { WorkspacePlanUpdated } from '@catalog/domain/events/workspace-plan-updated.event';
import { CatalogCall } from '@catalog/domain/value-objects/catalog-call.vo';
import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { VersionConstraint } from '@catalog/domain/value-objects/version-constraint.vo';
import { WorkspacePlanChangeDetail } from '@catalog/domain/value-objects/workspace-plan-change-detail.vo';

export const CATALOG_PAYLOAD_TYPES = [
  CatalogCall,
  CatalogItemId,
  CatalogName,
  CatalogVersion,
  Plan,
  PlanTerm,
  VersionConstraint,
  WorkspacePlanChangeDetail,
  WorkspacePlanCreated,
  WorkspacePlanUpdated,
  WorkspacePlanDeleted,
] as const;
