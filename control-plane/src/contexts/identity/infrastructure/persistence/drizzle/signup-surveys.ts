import type { SignupSurveysPort } from '@identity/application/ports/signup-surveys.port';
import type { SignupSurvey } from '@identity/domain/value-objects/signup-survey.vo';
import { signupSurvey } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

@Injectable()
export class DrizzleSignupSurveys implements SignupSurveysPort {
  constructor(private readonly context: DrizzleContext) {}

  async record(
    workspaceId: WorkspaceId,
    respondent: UserId,
    survey: SignupSurvey,
  ): Promise<void> {
    await this.context.db.insert(signupSurvey).values({
      workspaceId: workspaceId.value,
      respondentId: respondent.value,
      jobFunction: survey.jobFunction.value,
      referralSource: survey.referralSource,
    });
  }
}
