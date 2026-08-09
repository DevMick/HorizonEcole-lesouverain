import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '@school/config';
import { prisma } from '@school/database';
import { UserRole } from '@school/types';

interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export class TokenService {
  /**
   * Generate access token (1 hour)
   */
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '1h', // Access token expires in 1 hour
    });
  }

  /**
   * Generate refresh token (7 days) and store in database
   */
  static async generateRefreshToken(userId: string): Promise<{ token: string; id: string }> {
    // Generate a cryptographically secure random token
    const tokenString = crypto.randomBytes(64).toString('hex');
    
    // Generate UUID for the refresh token ID
    const refreshTokenId = crypto.randomUUID();
    
    // Store in database with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = await prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId,
        token: tokenString,
        expiresAt,
      },
    });

    // Sign the token ID in JWT for verification
    const jwtToken = jwt.sign(
      { userId, tokenId: refreshToken.id } as RefreshTokenPayload,
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    return { token: jwtToken, id: refreshToken.id };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token and check if it exists in database
   */
  static async verifyRefreshToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as RefreshTokenPayload;
      
      // Check if token exists in database and is not expired
      const refreshToken = await prisma.refreshToken.findUnique({
        where: { id: decoded.tokenId },
      });

      if (!refreshToken || refreshToken.userId !== decoded.userId) {
        return null;
      }

      // Check if token is expired
      if (refreshToken.expiresAt < new Date()) {
        // Delete expired token
        await prisma.refreshToken.delete({ where: { id: refreshToken.id } });
        return null;
      }

      return refreshToken.userId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Revoke a specific refresh token
   */
  static async revokeRefreshToken(tokenId: string): Promise<boolean> {
    try {
      await prisma.refreshToken.delete({
        where: { id: tokenId },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Clean up expired tokens (can be run periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}

