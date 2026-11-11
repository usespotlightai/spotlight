import type {
  GitCallDto,
  GitService,
} from '@work/application/dto/git-call.dto';

export class CarryGitCallCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly repo: string,
    readonly service: GitService,
    readonly call: GitCallDto,
  ) {}
}
