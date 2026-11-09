import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

@Injectable()
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? issue.path.map(String).join('.') : 'body';
        const existing = fieldErrors[key] ?? [];
        existing.push(issue.message);
        fieldErrors[key] = existing;
      }
      const firstMessage = parsed.error.issues[0]?.message ?? 'Data permintaan tidak valid.';
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: firstMessage,
        errors: fieldErrors,
      });
    }
    return parsed.data;
  }
}
