export interface HarnessModelDto {
  readonly id: string;
  readonly name: string;
}

export interface HarnessDto {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly models: readonly HarnessModelDto[];
  readonly defaultModel: string;
  readonly efforts: readonly string[];
  readonly discovery: readonly string[];
}
