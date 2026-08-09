import { Router } from 'express';
import { z } from 'zod';
import { ClassroomService, createClassroomSchema, updateClassroomSchema } from '../services/classroom.service';

const router = Router();

// GET /api/classrooms - Liste paginée des salles de classes
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const result = await ClassroomService.getAll(page, limit, search);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/classrooms/:id - Détails d'une salle de classe
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const classroom = await ClassroomService.getById(id);
    res.json({ success: true, data: classroom });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// POST /api/classrooms - Créer une salle de classe
router.post('/', async (req, res) => {
  try {
    const validatedData = createClassroomSchema.parse(req.body);
    const classroom = await ClassroomService.create(validatedData);
    res.status(201).json({ success: true, data: classroom });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

// PATCH /api/classrooms/:id - Modifier une salle de classe
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateClassroomSchema.parse(req.body);
    const classroom = await ClassroomService.update(id, validatedData);
    res.json({ success: true, data: classroom });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

// DELETE /api/classrooms/:id - Supprimer une salle de classe
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ClassroomService.delete(id);
    res.json({ success: true, message: 'Salle de classe supprimée avec succès' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;

