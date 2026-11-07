import type { ParsedProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { HarnessCompatibility } from '@configuration/domain/value-objects/harness-compatibility.vo';

export interface HarnessCompatibilityCheck {
  compatibilityOf(parsed: ParsedProfile): HarnessCompatibility;
}
