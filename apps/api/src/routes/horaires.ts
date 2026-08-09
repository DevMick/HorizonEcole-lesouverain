import { Router } from 'express';
import { z } from 'zod';
import { HoraireService, createHoraireSchema } from '../services/horaire.service';

const router = Router();

// GET /api/horaires - Liste des créneaux horaires réutilisables
router.get('/', async (req, res) => {
  try {
    const horaires = await HoraireService.getAll();
    res.json({ success: true, data: horaires });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/horaires - Créer un créneau horaire réutilisable
router.post('/', async (req, res) => {
  try {
    const validatedData = createHoraireSchema.parse(req.body);
    const horaire = await HoraireService.create(validatedData);
    res.status(201).json({ success: true, data: horaire });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

// DELETE /api/horaires/:id - Supprimer un créneau horaire réutilisable
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await HoraireService.delete(id);
    res.json({ success: true, message: 'Créneau horaire supprimé avec succès' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
