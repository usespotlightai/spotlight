import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineImagesPort } from '@work/application/ports/line-images.port';
import {
  line,
  lineRepository,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

const MOST_NAMED = 400;

@Injectable()
export class DrizzleLineImages implements LineImagesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async namedIn(workspaceId: WorkspaceId): Promise<readonly string[]> {
    const rows = await this.db
      .selectDistinct({ image: lineRepository.image })
      .from(lineRepository)
      .innerJoin(line, eq(line.id, lineRepository.lineId))
      .where(
        and(
          eq(line.workspaceId, workspaceId.value),
          isNotNull(lineRepository.image),
        ),
      )
      .orderBy(asc(lineRepository.image))
      .limit(MOST_NAMED);

    return rows.flatMap((row) => (row.image ? [row.image] : []));
  }
}
