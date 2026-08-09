import { Response, NextFunction } from 'express';
import { UserRole } from '@school/types';
import { AuthRequest } from './auth';

/**
 * Middleware to require specific roles
 * Usage: router.get('/admin-only', requireRole('ADMIN'), handler)
 */
export const requireRole = (...allowedRoles: (UserRole | string | (UserRole | string)[])[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Flatten and normalize roles (handle both array and individual arguments)
    const rolesToCheck: (UserRole | string)[] = allowedRoles.flat().map(role => 
      typeof role === 'string' ? role : role
    );
    
    const userRole = req.user.role as string;
    
    if (!rolesToCheck.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${rolesToCheck.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Middleware to check if user can access their own resource or is admin
 * Usage: router.get('/users/:id', canAccessOwnResourceOrAdmin('id'), handler)
 */
export const canAccessOwnResourceOrAdmin = (userIdParam: string = 'id') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const targetUserId = req.params[userIdParam];
    
    // Allow if accessing own resource or if user is admin
    if (req.user.id === targetUserId || req.user.role === 'ADMIN') {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      message: 'You can only access your own resources',
    });
  };
};

/**
 * Check if user is admin
 */
export const isAdmin = (req: AuthRequest): boolean => {
  return req.user?.role === 'ADMIN';
};

/**
 * Check if user is teacher
 */
export const isTeacher = (req: AuthRequest): boolean => {
  return req.user?.role === 'TEACHER';
};

/**
 * Check if user is accountant
 */
export const isAccountant = (req: AuthRequest): boolean => {
  return req.user?.role === 'ACCOUNTANT';
};

/**
 * Check if user is student
 */
export const isStudent = (req: AuthRequest): boolean => {
  const role = req.user?.role;
  // Check if role is STUDENT
  return String(role) === 'STUDENT';
};

/**
 * Check if user is parent
 */
export const isParent = (req: AuthRequest): boolean => {
  return req.user?.role === 'PARENT';
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (req: AuthRequest, ...roles: UserRole[]): boolean => {
  return req.user ? roles.includes(req.user.role) : false;
};

