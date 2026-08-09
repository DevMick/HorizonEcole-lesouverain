import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      if (!result.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: result.error.errors,
        });
      }
      
      // Update req.query with transformed values
      if (result.data.query) {
        req.query = { ...req.query, ...result.data.query };
      }
      
      // Update req.body with transformed values
      if (result.data.body) {
        req.body = { ...req.body, ...result.data.body };
      }
      
      // Update req.params with transformed values
      if (result.data.params) {
        req.params = { ...req.params, ...result.data.params };
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      next(error);
    }
  };
};

/**
 * Alias for validate - for backward compatibility
 */
export const validateRequest = validate;