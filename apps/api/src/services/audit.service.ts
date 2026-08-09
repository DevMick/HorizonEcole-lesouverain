import { randomUUID } from 'crypto';
import { prisma } from '@school/database';

interface AuditLogInput {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

export class AuditService {
  /**
   * Create an audit log entry
   */
  static async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          user_id: input.userId || null,
          action: input.action,
          resource_type: input.resourceType,
          resource_id: input.resourceId || null,
          old_values: input.oldValues || null,
          new_values: input.newValues || null,
          ip_address: input.ipAddress || null,
          user_agent: input.userAgent || null,
          success: input.success ?? true,
          error_message: input.errorMessage || null,
        } as any,
      });
    } catch (error) {
      // Log to console if audit log creation fails, but don't throw
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Log successful login
   */
  static async logLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      userId,
      action: 'LOGIN',
      resourceType: 'User',
      resourceId: userId,
      ipAddress,
      userAgent,
      success: true,
    });

    // Update last login timestamp
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Log failed login attempt
   */
  static async logFailedLogin(
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      action: 'LOGIN_FAILED',
      resourceType: 'User',
      ipAddress,
      userAgent,
      success: false,
      errorMessage: `Failed login for ${email}: ${reason}`,
    });
  }

  /**
   * Log logout
   */
  static async logLogout(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      userId,
      action: 'LOGOUT',
      resourceType: 'User',
      resourceId: userId,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * Log user creation
   */
  static async logUserCreation(
    creatorId: string,
    newUserId: string,
    userData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId: creatorId,
      action: 'CREATE',
      resourceType: 'User',
      resourceId: newUserId,
      newValues: userData,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * Log user update
   */
  static async logUserUpdate(
    updaterId: string,
    targetUserId: string,
    oldValues: any,
    newValues: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId: updaterId,
      action: 'UPDATE',
      resourceType: 'User',
      resourceId: targetUserId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * Log user deletion
   */
  static async logUserDeletion(
    deleterId: string,
    targetUserId: string,
    userData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId: deleterId,
      action: 'DELETE',
      resourceType: 'User',
      resourceId: targetUserId,
      oldValues: userData,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * Log password change
   */
  static async logPasswordChange(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'PASSWORD_CHANGE',
      resourceType: 'User',
      resourceId: userId,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(userId: string, limit = 50) {
    return await prisma.audit_logs.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs for a resource
   */
  static async getResourceAuditLogs(resourceType: string, resourceId: string, limit = 50) {
    return await prisma.audit_logs.findMany({
      where: { resource_type: resourceType, resource_id: resourceId },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}

