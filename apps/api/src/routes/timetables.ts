import { Router } from 'express';
import { z } from 'zod';
import { TimetableService, createTimetableSchema, updateTimetableSchema } from '../services/timetable.service';

const router = Router();

// GET /api/timetables - Liste des emplois du temps avec filtres
router.get('/', async (req, res) => {
  try {
    const academicYearId = req.query.academicYearId as string | undefined;
    const classId = req.query.classId as string | undefined;

    const timetables = await TimetableService.getAll({
      academicYearId,
      classId,
    });
    res.json({ success: true, data: timetables });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/timetables/:id - Détails d'un emploi du temps
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const timetable = await TimetableService.getById(id);
    res.json({ success: true, data: timetable });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// POST /api/timetables - Créer un emploi du temps
router.post('/', async (req, res) => {
  try {
    const validatedData = createTimetableSchema.parse(req.body);
    const timetable = await TimetableService.create(validatedData);
    res.status(201).json({ success: true, data: timetable });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

// PATCH /api/timetables/:id - Modifier un emploi du temps
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateTimetableSchema.parse(req.body);
    const timetable = await TimetableService.update(id, validatedData);
    res.json({ success: true, data: timetable });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

// DELETE /api/timetables/:id - Supprimer un emploi du temps
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await TimetableService.delete(id);
    res.json({ success: true, message: 'Emploi du temps supprimé avec succès' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;

