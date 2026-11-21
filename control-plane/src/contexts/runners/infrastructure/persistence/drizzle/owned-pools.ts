import { runnerPool } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { eq } from 'drizzle-orm';

// Spotlight adds the platform pool to each workspace. Terraform, the workspace's settings and its dependents see only the pools that the workspace owns.
export const ownedPools = eq(runnerPool.platform, false);
