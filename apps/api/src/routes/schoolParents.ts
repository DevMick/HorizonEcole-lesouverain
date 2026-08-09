import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '@school/database';
import { authenticate, authorize } from '../middleware/auth';
import { 
  CreateParentRequest, 
  UpdateParentRequest, 
  ParentFilters,
  ApiResponse,
  PaginatedResponse 
} from '@school/types';

const router = Router();

// Get all parents with filters
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      relation,
      isPrimaryContact,
      isFinancialResponsible,
      page = '1', 
      limit = '10' 
    } = req.query as ParentFilters;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (relation) {
      where.relation = relation;
    }

    if (isPrimaryContact !== undefined) {
      where.is_primary_contact = typeof isPrimaryContact === 'string' ? isPrimaryContact === 'true' : isPrimaryContact;
    }

    if (isFinancialResponsible !== undefined) {
      where.is_financial_responsible = typeof isFinancialResponsible === 'string' ? isFinancialResponsible === 'true' : isFinancialResponsible;
    }

    const [parents, total] = await Promise.all([
      prisma.parents.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { last_name: 'asc' },
          { first_name: 'asc' }
        ],
        include: {
          _count: {
            select: { student_parents: true }
          }
        }
      }),
      prisma.parents.count({ where })
    ]);

    const response: PaginatedResponse<typeof parents[0]> = {
      success: true,
      data: parents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parents'
    });
  }
});

// Get parent by ID
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const parent = await prisma.parents.findUnique({
      where: { id },
      include: {
          student_parents: {
          include: {
            student: {
              include: {
                class: {
                  include: {
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    const response: ApiResponse<typeof parent> = {
      success: true,
      data: parent
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching parent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parent'
    });
  }
});

// Create new parent
router.post('/', authenticate, authorize('ADMIN', 'TEACHER'), async (req: Request, res: Response) => {
  try {
    const data: CreateParentRequest = req.body;

    const parent = await prisma.parents.create({
      data: {
        id: randomUUID(),
        user: data.userId ? { connect: { id: data.userId } } : undefined,
        first_name: data.firstName,
        last_name: data.lastName,
        relation: data.relation,
        phone: data.phone,
        email: data.email,
        address: data.address,
        profession: data.profession,
        workplace: data.workplace,
        is_primary_contact: data.isPrimaryContact ?? false,
        is_financial_responsible: data.isFinancialResponsible ?? false
      }
    });

    const response: ApiResponse<typeof parent> = {
      success: true,
      data: parent,
      message: 'Parent created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating parent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create parent'
    });
  }
});

// Update parent
router.put('/:id', authenticate, authorize('ADMIN', 'TEACHER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdateParentRequest = req.body;

    // Check if parent exists
    const existing = await prisma.parents.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    const updateData: any = { ...data };
    delete updateData.id;

    const parent = await prisma.parents.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { student_parents: true }
        }
      }
    });

    const response: ApiResponse<typeof parent> = {
      success: true,
      data: parent,
      message: 'Parent updated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating parent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update parent'
    });
  }
});

// Delete parent
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if parent exists
    const existing = await prisma.parents.findUnique({
      where: { id },
      include: {
        _count: {
          select: { student_parents: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Check if parent has students linked
    if (existing._count?.student_parents && existing._count.student_parents > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete parent with ${existing._count?.student_parents || 0} students linked. Remove relationships first.`
      });
    }

    await prisma.parents.delete({
      where: { id }
    });

    const response: ApiResponse = {
      success: true,
      message: 'Parent deleted successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Error deleting parent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete parent'
    });
  }
});

// Get parent statistics
router.get('/stats/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const [
      totalParents,
      primaryContacts,
      financialResponsible,
      parentsByRelation
    ] = await Promise.all([
      prisma.parents.count(),
      prisma.parents.count({ where: { is_primary_contact: true } }),
      prisma.parents.count({ where: { is_financial_responsible: true } }),
      prisma.parents.groupBy({
        by: ['relation'],
        _count: true
      })
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        totalParents,
        primaryContacts,
        financialResponsible,
        parentsByRelation
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching parent stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parent statistics'
    });
  }
});

export default router;

