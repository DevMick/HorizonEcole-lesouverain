import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AuditService } from '../services/audit.service';

/**
 * Simple audit logger that uses AuditService
 */
export const auditLogger = {
  info: (message: string, metadata?: any) => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${message}`, metadata || '');
    }
    // In production, you could use a proper logging service here
  },
};

/**
 * Extract client IP address from request
 */
function getClientIp(req: AuthRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: AuthRequest): string | undefined {
  return req.headers['user-agent'];
}

/**
 * Middleware to track all authenticated requests
 * Add this after authenticate middleware
 */
export const trackRequest = (action: string, resourceType: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to capture response
    res.json = function (body: any) {
      // Only log after request completes
      setImmediate(async () => {
        try {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          
          await AuditService.log({
            userId: req.user?.id,
            action,
            resourceType,
            resourceId: req.params.id || req.body?.id,
            ipAddress: getClientIp(req),
            userAgent: getUserAgent(req),
            success,
            errorMessage: success ? undefined : body?.error || body?.message,
          });
        } catch (error) {
          console.error('Failed to track request:', error);
        }
      });

      // Call original json method
      return originalJson(body);
    };

    next();
  };
};

/**
 * Middleware to track resource creation
 */
export const trackCreate = (resourceType: string) => {
  return trackRequest('CREATE', resourceType);
};

/**
 * Middleware to track resource updates
 */
export const trackUpdate = (resourceType: string) => {
  return trackRequest('UPDATE', resourceType);
};

/**
 * Middleware to track resource deletion
 */
export const trackDelete = (resourceType: string) => {
  return trackRequest('DELETE', resourceType);
};

/**
 * Middleware to track resource reads
 */
export const trackRead = (resourceType: string) => {
  return trackRequest('READ', resourceType);
};

/**
 * Add request metadata to request object
 */
export const addRequestMetadata = (req: AuthRequest, res: Response, next: NextFunction) => {
  (req as any).metadata = {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  };
  next();
};

