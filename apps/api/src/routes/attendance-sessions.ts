import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { AttendanceSessionService, AttendancePolicyError } from '../services/attendance-session.service';
import { auditLogger } from '../middleware/auditTracking';
import { prisma } from '@school/database';

const router = Router();

// Résout l'enseignant lié au compte. Pour un TEACHER, on force son propre id ;
// pour un ADMIN, on utilise éventuellement le filtre teacherId fourni.
async function resolveTeacher(req: any): Promise<{ teacherId?: string; isTeacher: boolean }> {
  if (req.user?.role === 'TEACHER') {
    const teacher = await prisma.teachers.findUnique({
      where: { user_id: req.user.id },
      select: { id: true },
    });
    return { teacherId: teacher?.id, isTeacher: true };
  }
  return { teacherId: (req.query.teacherId as string) || undefined, isTeacher: false };
}

// Agenda d'appel du jour : les créneaux de l'enseignant pour une date, avec le
// statut de chacun (à faire / fait / verrouillé / à venir / manqué).
router.get('/my-agenda', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { academicYearId, date } = req.query as Record<string, string>;
    if (!academicYearId || !date) {
      return res.status(400).json({ success: false, error: 'academicYearId et date sont requis' });
    }

    const { teacherId, isTeacher } = await resolveTeacher(req);
    const finalTeacherId = isTeacher ? teacherId : (req.query.teacherId as string) || teacherId;
    if (!finalTeacherId) {
      return res.status(isTeacher ? 404 : 400).json({
        success: false,
        error: isTeacher ? 'Enseignant non trouvé pour cet utilisateur' : 'teacherId requis',
      });
    }

    const result = await AttendanceSessionService.getAgenda({
      teacherId: finalTeacherId,
      academicYearId,
      date,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching attendance agenda:', error);
    res.status(500).json({ success: false, error: "Failed to fetch attendance agenda" });
  }
});

// Présences déjà saisies d'une séance (ré-affichage à la correction).
router.get('/:id/records', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const records = await AttendanceSessionService.getSessionRecords(req.params.id);
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching session records:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session records' });
  }
});

// Historique des séances
router.get('/', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { teacherId } = await resolveTeacher(req);
    const { academicYearId, classId, subjectId, sessionNumber, page, limit } = req.query as Record<string, string>;

    const result = await AttendanceSessionService.getHistory({
      academicYearId,
      classId,
      subjectId,
      teacherId,
      sessionNumber,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    res.json({ success: true, data: result.sessions, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching attendance sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance sessions' });
  }
});

// Vue d'ensemble administration : cumul par matière / classe / élève.
// Déclarée avant `/:id` pour ne pas être capturée par le paramètre.
router.get('/overview', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { academicYearId, classId, subjectId, teacherId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }

    const data = await AttendanceSessionService.getOverview({
      academicYearId,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error building attendance overview:', error);
    res.status(500).json({ success: false, error: 'Failed to build attendance overview' });
  }
});

// Détail d'une séance
router.get('/:id', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const session = await AttendanceSessionService.getSessionDetail(req.params.id);
    res.json({ success: true, data: session });
  } catch (error) {
    if (error instanceof Error && error.message === 'Session not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error('Error fetching session detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session detail' });
  }
});

// Enregistrer / mettre à jour une séance et ses présences (idempotent)
router.post('/', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { teacherId, isTeacher } = await resolveTeacher(req);
    const finalTeacherId = isTeacher ? teacherId : req.body.teacherId || teacherId;
    if (!finalTeacherId) {
      return res.status(isTeacher ? 404 : 400).json({
        success: false,
        error: isTeacher ? 'Enseignant non trouvé pour cet utilisateur' : 'teacherId requis',
      });
    }

    const result = await AttendanceSessionService.recordSession(
      { ...req.body, teacherId: finalTeacherId },
      (req as any).user.id,
      isTeacher ? 'TEACHER' : 'ADMIN',
    );

    auditLogger.info('Attendance session recorded', {
      userId: (req as any).user.id,
      sessionId: result.sessionId,
      sessionNumber: result.sessionNumber,
      classId: req.body.classId,
      subjectId: req.body.subjectId,
      date: req.body.date,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Séance ${result.sessionNumber} enregistrée (${result.summary.successful} élèves)`,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    // Refus métier (hors emploi du temps, hors fenêtre, séance verrouillée) :
    // le message est destiné à l'enseignant, on le renvoie tel quel.
    if (error instanceof AttendancePolicyError) {
      const status = error.code === 'CONFLICT' ? 409 : error.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ success: false, error: error.message, code: error.code });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error recording attendance session:', error);
    res.status(500).json({ success: false, error: 'Failed to record attendance session' });
  }
});

export default router;
