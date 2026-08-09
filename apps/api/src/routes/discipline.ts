import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { DisciplineService, createIncidentSchema, updateIncidentSchema, createSanctionSchema, updateSanctionSchema } from '../services/discipline.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

// ========== INCIDENTS ==========

router.get('/incidents', authenticateToken, async (req, res) => {
  try {
    const result = await DisciplineService.getIncidents(req.query);
    res.json({ success: true, data: result.incidents, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch incidents' });
  }
});

router.get('/incidents/stats', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const stats = await DisciplineService.getDisciplineStats(req.query);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching discipline stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch discipline statistics' });
  }
});

router.get('/incidents/:id', authenticateToken, async (req, res) => {
  try {
    const incident = await DisciplineService.getIncidentById(req.params.id);
    res.json({ success: true, data: incident });
  } catch (error) {
    if (error instanceof Error && error.message === 'Disciplinary incident not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch incident' });
  }
});

router.post('/incidents', authenticateToken, requireRole(['ADMIN', 'ENSEIGNANT']), validateRequest(createIncidentSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const incident = await DisciplineService.createIncident(req.body, userId);
    
    auditLogger.info('Disciplinary incident created', {
      userId,
      incidentId: incident.id,
        studentId: incident.student_id,
      severity: incident.severity,
    });

    res.status(201).json({ success: true, data: incident, message: 'Incident créé avec succès' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create incident' });
  }
});

router.put('/incidents/:id', authenticateToken, requireRole(['ADMIN', 'ENSEIGNANT']), validateRequest(updateIncidentSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const incident = await DisciplineService.updateIncident(req.params.id, req.body);
    auditLogger.info('Incident updated', { userId, incidentId: req.params.id });
    res.json({ success: true, data: incident, message: 'Incident modifié avec succès' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Disciplinary incident not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update incident' });
  }
});

router.delete('/incidents/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await DisciplineService.deleteIncident(req.params.id);
    auditLogger.info('Incident deleted', { userId, incidentId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Disciplinary incident not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({ success: false, error: error.message });
      }
    }
    res.status(500).json({ success: false, error: 'Failed to delete incident' });
  }
});

// ========== SANCTIONS ==========

router.get('/sanctions', authenticateToken, async (req, res) => {
  try {
    const result = await DisciplineService.getSanctions(req.query);
    res.json({ success: true, data: result.sanctions, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching sanctions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sanctions' });
  }
});

router.get('/sanctions/:id', authenticateToken, async (req, res) => {
  try {
    const sanction = await DisciplineService.getSanctionById(req.params.id);
    res.json({ success: true, data: sanction });
  } catch (error) {
    if (error instanceof Error && error.message === 'Sanction not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch sanction' });
  }
});

router.post('/sanctions', authenticateToken, requireRole(['ADMIN']), validateRequest(createSanctionSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const sanction = await DisciplineService.createSanction(req.body, userId);
    
    // Note: sanction model does not exist, this will throw an error
    res.status(201).json({ success: true, data: null, message: 'Sanction model not implemented' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create sanction' });
  }
});

router.put('/sanctions/:id', authenticateToken, requireRole(['ADMIN']), validateRequest(updateSanctionSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const sanction = await DisciplineService.updateSanction(req.params.id, req.body);
    auditLogger.info('Sanction updated', { userId, sanctionId: req.params.id });
    res.json({ success: true, data: sanction, message: 'Sanction modifiée avec succès' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Sanction not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update sanction' });
  }
});

router.post('/sanctions/:id/execute', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { executionNotes } = req.body;
    const sanction = await DisciplineService.executeSanction(req.params.id, executionNotes);
    auditLogger.info('Sanction executed', { userId, sanctionId: req.params.id });
    res.json({ success: true, data: sanction, message: 'Sanction exécutée avec succès' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Sanction not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to execute sanction' });
  }
});

router.delete('/sanctions/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    await DisciplineService.deleteSanction(req.params.id);
    auditLogger.info('Sanction deleted', { userId, sanctionId: req.params.id });
    res.json({ success: true, message: 'Sanction deleted successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Sanction not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({ success: false, error: error.message });
      }
    }
    res.status(500).json({ success: false, error: 'Failed to delete sanction' });
  }
});

export default router;
