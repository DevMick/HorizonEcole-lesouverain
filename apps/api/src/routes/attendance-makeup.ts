import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { AttendanceMakeupService } from '../services/attendance-makeup.service';
import { AttendanceMoveRequestService } from '../services/attendance-move-request.service';
import { AttendancePolicyError } from '../services/attendance-session.service';
import { auditLogger } from '../middleware/auditTracking';
import { prisma } from '@school/database';

const router = Router();

/**
 * Rattrapage des séances non tenues (§9.6).
 * Un TEACHER n'agit que sur ses propres créneaux (le service le revérifie) ;
 * un ADMIN peut cibler un enseignant via `teacherId`.
 */
async function resolveTeacher(req: any): Promise<{ teacherId?: string; isTeacher: boolean }> {
  if (req.user?.role === 'TEACHER') {
    const teacher = await prisma.teachers.findUnique({
      where: { user_id: req.user.id },
      select: { id: true },
    });
    return { teacherId: teacher?.id, isTeacher: true };
  }
  const q = (req.query.teacherId as string) || req.body?.teacherId;
  return { teacherId: q || undefined, isTeacher: false };
}

async function requireTeacherId(req: any, res: any): Promise<string | null> {
  const { teacherId, isTeacher } = await resolveTeacher(req);
  if (!teacherId) {
    res.status(isTeacher ? 404 : 400).json({
      success: false,
      error: isTeacher ? 'Enseignant non trouvé pour cet utilisateur' : 'teacherId requis',
    });
    return null;
  }
  return teacherId;
}

// Traduit un refus métier en code HTTP. Le message vise l'enseignant.
function handle(error: any, res: any, fallback: string) {
  if (error?.name === 'ZodError') {
    return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
  }
  if (error instanceof AttendancePolicyError) {
    const status = error.code === 'CONFLICT' ? 409 : error.code === 'FORBIDDEN' ? 403 : 400;
    return res.status(status).json({ success: false, error: error.message, code: error.code });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

// Séances manquées à traiter (année / trimestre / classe / matière)
router.get('/candidates', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { academicYearId, semesterId, classId, subjectId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    const data = await AttendanceMakeupService.getCandidates({
      teacherId,
      academicYearId,
      semesterId: semesterId || undefined,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    handle(error, res, 'Failed to fetch makeup candidates');
  }
});

// Cours à venir, déplaçables (année / trimestre / classe / matière)
router.get('/upcoming', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { academicYearId, semesterId, classId, subjectId, weeks } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    const data = await AttendanceMakeupService.getUpcoming({
      teacherId,
      academicYearId,
      semesterId: semesterId || undefined,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      weeks: weeks ? parseInt(weeks, 10) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    handle(error, res, 'Failed to fetch upcoming occurrences');
  }
});

// Séances non tenues, tous enseignants confondus — page admin dédiée.
router.get('/uncalled', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { academicYearId, semesterId, classId, subjectId, teacherId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }
    const data = await AttendanceMakeupService.getUncalledSessions({
      academicYearId,
      semesterId: semesterId || undefined,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    handle(error, res, 'Failed to fetch uncalled sessions');
  }
});

// Contrôle de disponibilité d'une date/heure, sans rien écrire : l'UI l'appelle
// pendant la saisie pour alerter avant validation.
router.get('/conflicts', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { timetableId, originalDate, date, startTime, endTime } = req.query as Record<string, string>;
    if (!timetableId || !originalDate || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'timetableId, originalDate, date, startTime et endTime sont requis',
      });
    }
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    const data = await AttendanceMakeupService.checkConflicts(
      { timetableId, originalDate, date, startTime, endTime },
      teacherId,
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(error, res, 'Failed to check conflicts');
  }
});

// Décisions déjà prises (rattrapages programmés / occurrences écartées)
router.get('/', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { academicYearId, semesterId, classId, subjectId, status } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    const data = await AttendanceMakeupService.getDecisions({
      teacherId,
      academicYearId,
      semesterId: semesterId || undefined,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      status: status || undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    handle(error, res, 'Failed to fetch makeup sessions');
  }
});

// Programmer un rattrapage
router.post('/', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    const result = await AttendanceMakeupService.schedule(req.body, teacherId, (req as any).user.id);
    auditLogger.info('Makeup session scheduled', {
      userId: (req as any).user.id,
      makeupId: result.id,
      timetableId: req.body?.timetableId,
      originalDate: req.body?.originalDate,
      makeupDate: result.makeupDate,
    });
    res.status(201).json({
      success: true,
      data: result,
      message: `Rattrapage programmé le ${result.makeupDate}.`,
    });
  } catch (error) {
    handle(error, res, 'Failed to schedule makeup session');
  }
});

// Déplacer un cours à venir vers une autre heure / un autre jour.
// ADMIN : déplacement direct, effectif immédiatement (c'est déjà la voie de
// validation). TEACHER : simple demande, sans effet sur l'agenda tant qu'elle
// n'est pas approuvée — voir /move-requests ci-dessous (§9.6bis).
router.post('/move', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    if ((req as any).user.role === 'TEACHER') {
      const result = await AttendanceMoveRequestService.create(req.body, teacherId, (req as any).user.id);
      auditLogger.info('Move request submitted', {
        userId: (req as any).user.id,
        requestId: result.id,
        timetableId: req.body?.timetableId,
        originalDate: req.body?.originalDate,
        requestedDate: result.requestedDate,
      });
      return res.status(201).json({
        success: true,
        data: result,
        message: `Demande envoyée : en attente de validation par l'administration pour le ${result.requestedDate}.`,
      });
    }

    const result = await AttendanceMakeupService.move(req.body, teacherId, (req as any).user.id);
    auditLogger.info('Timetable occurrence moved', {
      userId: (req as any).user.id,
      makeupId: result.id,
      timetableId: req.body?.timetableId,
      originalDate: req.body?.originalDate,
      newDate: result.newDate,
    });
    res.status(201).json({
      success: true,
      data: result,
      message: `Cours déplacé au ${result.newDate}.`,
    });
  } catch (error) {
    handle(error, res, 'Failed to move timetable occurrence');
  }
});

// --- Demandes de déplacement (§9.6bis) --------------------------------------

// Enseignant : mes demandes (toutes périodes/statuts). Sert à afficher le
// badge « en attente » / « refusée » sur l'onglet Cours à venir.
router.get('/move-requests/mine', authenticateToken, requireRole(['TEACHER']), async (req, res) => {
  try {
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;
    const { academicYearId, classId, subjectId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }
    const data = await AttendanceMoveRequestService.listMine({
      teacherId,
      academicYearId,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    handle(error, res, 'Failed to fetch move requests');
  }
});

// Admin : demandes à traiter, tous enseignants confondus.
router.get('/move-requests/pending', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { academicYearId, classId, subjectId, teacherId, status } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }
    const data = await AttendanceMoveRequestService.listForAdmin({
      academicYearId,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      teacherId: teacherId || undefined,
      status: status || undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    handle(error, res, 'Failed to fetch move requests');
  }
});

// Admin : valide la demande (à la date proposée, ou à une autre si fournie).
router.post('/move-requests/:id/approve', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await AttendanceMoveRequestService.approve(req.params.id, req.body, (req as any).user.id);
    auditLogger.info('Move request approved', {
      userId: (req as any).user.id,
      requestId: req.params.id,
      decidedDate: result.request.decidedDate,
      overridden: result.overridden,
    });
    res.json({
      success: true,
      data: result,
      message: result.overridden
        ? `Déplacement validé avec une autre date : ${result.request.decidedDate}.`
        : `Déplacement validé pour le ${result.request.decidedDate}.`,
    });
  } catch (error) {
    handle(error, res, 'Failed to approve move request');
  }
});

// Admin : refuse la demande.
router.post('/move-requests/:id/reject', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await AttendanceMoveRequestService.reject(req.params.id, req.body, (req as any).user.id);
    res.json({ success: true, data: result, message: 'Demande refusée.' });
  } catch (error) {
    handle(error, res, 'Failed to reject move request');
  }
});

// Enseignant : annule sa propre demande en attente.
router.delete('/move-requests/:id', authenticateToken, requireRole(['TEACHER']), async (req, res) => {
  try {
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;
    const result = await AttendanceMoveRequestService.cancel(req.params.id, teacherId);
    res.json({ success: true, data: result, message: 'Demande annulée.' });
  } catch (error) {
    handle(error, res, 'Failed to cancel move request');
  }
});

// Écarter une occurrence (« pas de cours ce jour »)
router.post('/dismiss', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    const result = await AttendanceMakeupService.dismiss(req.body, teacherId, (req as any).user.id);
    res.status(201).json({ success: true, data: result, message: 'Séance écartée.' });
  } catch (error) {
    handle(error, res, 'Failed to dismiss session');
  }
});

// Annuler une décision : l'occurrence redevient à traiter
router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const teacherId = await requireTeacherId(req, res);
    if (!teacherId) return;

    const result = await AttendanceMakeupService.cancel(req.params.id, teacherId);
    res.json({ success: true, data: result, message: 'Décision annulée.' });
  } catch (error) {
    handle(error, res, 'Failed to cancel makeup session');
  }
});

export default router;
