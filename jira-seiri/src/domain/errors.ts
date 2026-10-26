export type SeiriErrorCode =
  | 'CONFIG'
  | 'INVALID_PROJECT'
  | 'SCHEMA'
  | 'DB'
  | 'JIRA'
  | 'VALIDATION'
  | 'DUPLICATE'
  | 'APPLY'
  | 'UNEXPECTED';

export class SeiriError extends Error {
  constructor(
    message: string,
    readonly code: SeiriErrorCode,
    readonly hint?: string
  ) {
    super(message);
    this.name = 'SeiriError';
  }
}
