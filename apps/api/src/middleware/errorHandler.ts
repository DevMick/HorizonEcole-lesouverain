import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'A record with this information already exists',
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Record not found',
        message: 'The requested record does not exist',
      });
    }
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: error.message,
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'The provided token has expired',
    });
  }

  // Default error
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
};
