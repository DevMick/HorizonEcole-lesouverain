import { Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.method} ${req.path} does not exist`,
  });
};
