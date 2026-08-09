import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@school/types';
import { prisma } from '@school/database';
import { TokenService } from '../services/token.service';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Middleware to authenticate requests using JWT access token
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Please provide a valid access token in the Authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token using TokenService
    const decoded = TokenService.verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'Please login again to get a new access token',
      });
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive user',
        message: 'User account is not active',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Optional authentication - does not fail if no token provided
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = TokenService.verifyAccessToken(token);

    if (decoded) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (user && user.isActive) {
        req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
    };
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

/**
 * Legacy authorize middleware (deprecated - use requireRole from rbac.ts instead)
 * @deprecated Use requireRole from rbac.ts
 */
export const authorize = (...roles: (UserRole | string)[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Alias for authenticate - for backward compatibility
 */
export const authenticateToken = authenticate;

/**
 * Re-export requireRole from rbac module for convenience
 */
export { requireRole } from './rbac';