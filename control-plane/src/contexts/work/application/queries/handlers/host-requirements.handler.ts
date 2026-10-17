import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { HostRequirementsDto } from '@work/application/dto/host-requirements.dto';
import { HarnessMapper } from '@work/application/mappers/harness.mapper';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { LineImagesPort } from '@work/application/ports/line-images.port';
import type { HostRequirementsQuery } from '@work/application/queries/host.queries';
import { MIN_RUNNER_RELEASE } from '@work/application/services/least-runner-release';

export class HostRequirementsHandler
  implements QueryHandlerPort<HostRequirementsQuery, HostRequirementsDto | null>
{
  constructor(
    private readonly launch: HarnessLaunchPort,
    private readonly admissions: RunnerAdmissionsPort,
    private readonly images: LineImagesPort,
  ) {}

  async execute(
    query: HostRequirementsQuery,
  ): Promise<HostRequirementsDto | null> {
    try {
      const admitted = await this.admissions.admit(query.credential);

      if (!admitted) {
        return null;
      }

      return {
        runnerMinimum: MIN_RUNNER_RELEASE,
        harnesses: this.launch
          .catalogue()
          .map((entry) => HarnessMapper.toDto(entry, [])),
        images: await this.images.namedIn(admitted.workspaceId),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
