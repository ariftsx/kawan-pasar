import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { badRequest } from './api-errors.js';

/** Validates one handler argument against a contract schema; reports field names only. */
@Injectable()
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const fields = [
      ...new Set(result.error.issues.map((i) => (i.path.length > 0 ? i.path.join('.') : '_'))),
    ];
    throw badRequest(fields);
  }
}
