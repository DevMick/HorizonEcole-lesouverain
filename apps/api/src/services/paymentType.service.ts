import { prisma } from '@school/database';
import type { Prisma } from '@prisma/client';

export class PaymentTypeService {
  // Get all payment types
  static async getAllPaymentTypes() {
    try {
      // Use payment_types (snake_case) as Prisma keeps the original model name
      return await prisma.payment_types.findMany({
        orderBy: { name: 'asc' },
      });
    } catch (error: any) {
      console.error('PaymentTypeService.getAllPaymentTypes error:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });
      
      // Check if it's a property access error (model doesn't exist)
      if (error.message?.includes('paymentType') || error.message?.includes('Cannot read property') || error.code === 'P2001') {
        const availableModels = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
        throw new Error(
          `PaymentType model not available in Prisma client.\n` +
          `Available models: ${availableModels.join(', ')}\n` +
          `Please run: pnpm --filter @school/database prisma generate\n` +
          `Then restart the API server.`
        );
      }
      
      throw error;
    }
  }

  // Get payment type by ID
  static async getPaymentTypeById(id: string) {
    try {
      return await prisma.payment_types.findUnique({
        where: { id },
      });
    } catch (error: any) {
      console.error('PaymentTypeService.getPaymentTypeById error:', {
        id,
        message: error.message,
        code: error.code,
      });
      throw error;
    }
  }

  // Create payment type
  static async createPaymentType(
    data: Prisma.payment_typesCreateInput
  ) {
    try {
      return await prisma.payment_types.create({
        data,
      });
    } catch (error: any) {
      console.error('PaymentTypeService.createPaymentType error:', {
        data,
        message: error.message,
        code: error.code,
      });
      
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        throw new Error('Un type de versement avec ce nom existe déjà');
      }
      
      throw error;
    }
  }

  // Update payment type
  static async updatePaymentType(
    id: string,
    data: Prisma.payment_typesUpdateInput
  ) {
    try {
      return await prisma.payment_types.update({
        where: { id },
        data,
      });
    } catch (error: any) {
      console.error('PaymentTypeService.updatePaymentType error:', {
        id,
        data,
        message: error.message,
        code: error.code,
      });
      
      // Handle record not found
      if (error.code === 'P2025') {
        throw new Error('Type de versement non trouvé');
      }
      
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        throw new Error('Un type de versement avec ce nom existe déjà');
      }
      
      throw error;
    }
  }

  // Delete payment type
  static async deletePaymentType(id: string) {
    try {
      return await prisma.payment_types.delete({
        where: { id },
      });
    } catch (error: any) {
      console.error('PaymentTypeService.deletePaymentType error:', {
        id,
        message: error.message,
        code: error.code,
      });
      
      // Handle record not found
      if (error.code === 'P2025') {
        throw new Error('Type de versement non trouvé');
      }
      
      throw error;
    }
  }

  // Check if payment type exists by name
  static async existsByName(name: string, excludeId?: string): Promise<boolean> {
    try {
      const count = await prisma.payment_types.count({
        where: {
          name,
          ...(excludeId && { id: { not: excludeId } }),
        },
      });
      return count > 0;
    } catch (error: any) {
      console.error('PaymentTypeService.existsByName error:', {
        name,
        excludeId,
        message: error.message,
        code: error.code,
      });
      throw error;
    }
  }
}

