import type { Request, Response, NextFunction } from 'express'
import { z, ZodSchema } from 'zod'
import { sendError } from '../utils/response'

type ValidateTarget = 'body' | 'query' | 'params'

export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target])
    if (!result.success) {
      const errors = result.error.flatten()
      sendError(res, JSON.stringify(errors.fieldErrors), 422)
      return
    }
    req[target] = result.data
    next()
  }
}
