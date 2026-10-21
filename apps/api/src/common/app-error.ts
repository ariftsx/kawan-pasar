import { ERROR_STATUS, type ErrorCode } from '@kawan-pasar/contracts';

/** A failure with a stable contract code (docs 08 §8). Its message is safe to show to clients. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
    // eslint-disable-next-line security/detect-object-injection -- `code` is the closed ErrorCode union
    this.status = ERROR_STATUS[code];
  }
}
