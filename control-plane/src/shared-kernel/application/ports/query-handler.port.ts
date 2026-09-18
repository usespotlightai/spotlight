export interface QueryHandlerPort<TQuery, TResult> {
  execute(query: TQuery): Promise<TResult>;
}
