import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '@school/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Subject name is required'),
    code: z.string().min(1, 'Subject code is required'),
    description: z.string().optional(),
    credits: z.number().min(1).max(10).optional(),
  }),
});

const updateSubjectSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().optional(),
    code: z.string().optional(),
    description: z.string().optional(),
    credits: z.number().min(1).max(10).optional(),
    isActive: z.boolean().optional(),
  }),
});

// Get all subjects
router.get('/', authenticate, async (req, res) => {
  try {
    const subjects = await prisma.subjects.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create new subject
router.post('/', authenticate, validate(createSubjectSchema), async (req, res) => {
  try {
    const subject = await prisma.subjects.create({
      data: req.body,
    });

    res.status(201).json({
      success: true,
      data: subject,
      message: 'Subject created successfully',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Update subject
router.put('/:id', authenticate, validate(updateSubjectSchema), async (req, res) => {
  try {
    const subject = await prisma.subjects.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({
      success: true,
      data: subject,
      message: 'Subject updated successfully',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

export default router;
