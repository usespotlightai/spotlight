import type { SignupSurvey } from '@identity/domain/value-objects/signup-survey.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SIGNUP_SURVEYS = Symbol('SIGNUP_SURVEYS');

export interface SignupSurveysPort {
  record(
    workspaceId: WorkspaceId,
    respondent: UserId,
    survey: SignupSurvey,
  ): Promise<void>;
}
