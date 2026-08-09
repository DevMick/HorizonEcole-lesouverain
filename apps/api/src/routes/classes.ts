import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '@school/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const createClassSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Class name is required'),
    level: z.string().min(1, 'Level is required'),
    academicYear: z.string().min(1, 'Academic year is required'),
    teacherId: z.string().optional(),
    capacity: z.number().min(1).max(50).optional(),
  }),
});

const updateClassSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().optional(),
    level: z.string().optional(),
    academicYear: z.string().optional(),
    teacherId: z.string().optional(),
    capacity: z.number().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
  }),
});

// Get all classes
router.get('/', authenticate, async (req, res) => {
  try {
    const classes = await prisma.schoolClass.findMany({
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: classes,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get class by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const classData = await prisma.schoolClass.findUnique({
      where: { id: req.params.id },
      include: {
        students: {
          select: {
            id: true,
            studentNumber: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({
      success: true,
      data: classData,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// Create new class
router.post('/', authenticate, validate(createClassSchema), async (req, res) => {
  try {
    const classData = await prisma.schoolClass.create({
      data: req.body,
      include: {
      },
    });

    res.status(201).json({
      success: true,
      data: classData,
      message: 'Class created successfully',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update class
router.put('/:id', authenticate, validate(updateClassSchema), async (req, res) => {
  try {
    const classData = await prisma.schoolClass.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
      },
    });

    res.json({
      success: true,
      data: classData,
      message: 'Class updated successfully',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.status(500).json({ error: 'Failed to update class' });
  }
});

export default router;
