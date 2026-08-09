import { Router, Request, Response } from 'express';
import { prisma } from '@school/database';
import { authenticate, authorize } from '../middleware/auth';
import { 
  CreateStudentRequest, 
  UpdateStudentRequest, 
  StudentFilters,
  ApiResponse,
  PaginatedResponse 
} from '@school/types';
import { ParentRelation } from '@prisma/client';

const router = Router();

// Get all students with filters
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      classId,
      status,
      gender,
      academicYearId,
      page = '1', 
      limit = '10' 
    } = req.query as StudentFilters;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { studentNumber: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (classId) {
      where.classId = classId;
    }

    if (status) {
      where.status = status;
    }

    if (gender) {
      where.gender = gender;
    }

    if (academicYearId) {
      where.class = {
        academicYearId
      };
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' }
        ],
        include: {
          class: {
            include: {
            }
          },
          studentParents: {
            include: {
              parents: true
            }
          }
        }
      }),
      prisma.student.count({ where })
    ]);

    const response: PaginatedResponse<typeof students[0]> = {
      success: true,
      data: students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
});

// Get student by ID
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            main_teachers: {
              include: {
                teacher: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true
                  }
                }
              }
            }
          }
        },
        studentParents: {
          include: {
            parents: true
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const response: ApiResponse<typeof student> = {
      success: true,
      data: student
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student'
    });
  }
});

// Create new student
router.post('/', authenticate, authorize('ADMIN', 'TEACHER'), async (req: Request, res: Response) => {
  try {
    const data: CreateStudentRequest = req.body;

    // Check if student number already exists
    const existing = await prisma.student.findUnique({
      where: { studentNumber: data.studentNumber }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Student number already exists'
      });
    }

    // Verify class exists if provided
    if (data.classId) {
      const classExists = await prisma.schoolClass.findUnique({
        where: { id: data.classId }
      });

      if (!classExists) {
        return res.status(404).json({
          success: false,
          error: 'Class not found'
        });
      }
    }

    // Create student with parents
    const student = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        userId: data.userId || null,
        studentNumber: data.studentNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date(data.dateOfBirth),
        placeOfBirth: data.placeOfBirth,
        gender: data.gender,
        nationality: data.nationality,
        phone: data.phone,
        email: data.email,
        address: data.address,
        bloodType: data.bloodType,
        allergies: data.allergies,
        medicalNotes: data.medicalNotes,
        classId: data.classId || null,
        enrollmentDate: new Date(data.enrollmentDate),
        studentParents: data.parents && data.parents.length > 0 ? {
          create: await Promise.all(data.parents.map(async (parentData) => {
            // If parent ID is provided, use existing parent
            if (parentData.id) {
              return {
                id: crypto.randomUUID(),
                parents: {
                  connect: { id: parentData.id }
                },
                relation: (parentData.relation || 'PERE') as ParentRelation
              };
            }
            // Otherwise create new parent
            return {
              id: crypto.randomUUID(),
              parents: {
                create: {
                  id: crypto.randomUUID(),
                  user_id: parentData.userId,
                  first_name: parentData.firstName,
                  last_name: parentData.lastName,
                  relation: parentData.relation as ParentRelation,
                  phone: parentData.phone,
                  email: parentData.email,
                  address: parentData.address,
                  profession: parentData.profession,
                  workplace: parentData.workplace,
                  is_primary_contact: parentData.isPrimaryContact ?? false,
                  is_financial_responsible: parentData.isFinancialResponsible ?? false
                }
              },
              relation: (parentData.relation || 'PERE') as ParentRelation
            };
          }))
        } : undefined
      },
      include: {
        class: true,
        studentParents: {
          include: {
            parents: true
          }
        }
      }
    });

    const response: ApiResponse<typeof student> = {
      success: true,
      data: student,
      message: 'Student created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create student'
    });
  }
});

// Update student
router.put('/:id', authenticate, authorize('ADMIN', 'TEACHER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdateStudentRequest = req.body;

    // Check if student exists
    const existing = await prisma.student.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if student number is being changed and if it already exists
    if (data.studentNumber && data.studentNumber !== existing.studentNumber) {
      const duplicate = await prisma.student.findUnique({
        where: { studentNumber: data.studentNumber }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'Student number already exists'
        });
      }
    }

    // Verify class exists if provided
    if (data.classId) {
      const classExists = await prisma.schoolClass.findUnique({
        where: { id: data.classId }
      });

      if (!classExists) {
        return res.status(404).json({
          success: false,
          error: 'Class not found'
        });
      }
    }

    const updateData: any = { ...data };
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
    }
    if (data.enrollmentDate) {
      updateData.enrollmentDate = new Date(data.enrollmentDate);
    }
    delete updateData.id;
    delete updateData.parents; // Parents are managed separately

    const student = await prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        class: true,
        studentParents: {
          include: {
            parents: true
          }
        }
      }
    });

    const response: ApiResponse<typeof student> = {
      success: true,
      data: student,
      message: 'Student updated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update student'
    });
  }
});

// Delete student
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if student exists
    const existing = await prisma.student.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    await prisma.student.delete({
      where: { id }
    });

    const response: ApiResponse = {
      success: true,
      message: 'Student deleted successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete student'
    });
  }
});

// Add parent to student
router.post('/:id/parents', authenticate, authorize('ADMIN', 'TEACHER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if parent exists
    const parent = await prisma.parents.findUnique({
      where: { id: parentId }
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Check if relationship already exists
    const existing = await prisma.student_parents.findFirst({
      where: {
        student_id: id,
        parent_id: parentId
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Parent is already linked to this student'
      });
    }

    const studentParent = await prisma.student_parents.create({
      data: {
        id: crypto.randomUUID(),
        student: { connect: { id } },
        parents: { connect: { id: parentId } },
        relation: 'PERE' as any
      },
      include: {
        parents: true
      }
    });

    const response: ApiResponse<typeof studentParent> = {
      success: true,
      data: studentParent,
      message: 'Parent linked to student successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error linking parent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link parent to student'
    });
  }
});

// Remove parent from student
router.delete('/:id/parents/:parentId', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id, parentId } = req.params;

    const studentParent = await prisma.student_parents.findFirst({
      where: {
        student_id: id,
        parent_id: parentId
      }
    });

    if (!studentParent) {
      return res.status(404).json({
        success: false,
        error: 'Parent-student relationship not found'
      });
    }

    await prisma.student_parents.delete({
      where: { id: studentParent.id }
    });

    const response: ApiResponse = {
      success: true,
      message: 'Parent unlinked from student successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Error unlinking parent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink parent from student'
    });
  }
});

// Get student statistics
router.get('/stats/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const [
      totalStudents,
      activeStudents,
      studentsByStatus,
      studentsByClass
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.student.groupBy({
        by: ['status'],
        _count: true
      }),
      prisma.student.groupBy({
        by: ['classId'],
        _count: true,
        where: {
          classId: { not: null }
        }
      })
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        totalStudents,
        activeStudents,
        inactiveStudents: totalStudents - activeStudents,
        studentsByStatus,
        classesWithStudents: studentsByClass.length
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student statistics'
    });
  }
});

export default router;

