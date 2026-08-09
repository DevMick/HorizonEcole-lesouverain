import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { ConductService } from '../services/conduct.service';
import { auditLogger } from '../middleware/auditTracking';
import { justificatifUpload, handleUploadError, getFileUrl, getFilePath, deleteFile } from '../middleware/upload';

const router = Router();

// La conduite est gérée par l'administration ; les notes validées sont ensuite
// lisibles par les enseignants (pages « Notes par matière » / « Moyennes »).
const ADMIN = requireRole(['ADMIN']);
const READERS = requireRole(['ADMIN', 'TEACHER']);

const settingsSchema = z.object({
  academicYearId: z.string().min(1),
  baseNote: z.number().min(0).max(20).optional(),
  hoursPerPoint: z.number().min(0.5).max(20).optional(),
  defaultSessionHours: z.number().min(0.5).max(12).optional(),
  // Durée d'un créneau de l'emploi du temps (= 1 heure de cours).
  periodMinutes: z.number().int().min(20).max(120).optional(),
  coefficient: z.number().int().min(0).max(20).optional(),
});

const manualNoteSchema = z.object({
  academicYearId: z.string().min(1),
  semesterId: z.string().min(1),
  classId: z.string().min(1),
  studentId: z.string().min(1),
  manualNote: z.number().min(0).max(20).nullable(),
  comment: z.string().max(500).nullable().optional(),
});

const recalcSchema = z.object({
  academicYearId: z.string().min(1),
  semesterId: z.string().min(1),
  classId: z.string().min(1).optional(),
  force: z.boolean().optional(),
});

const validateSchema = z.object({
  academicYearId: z.string().min(1),
  semesterId: z.string().min(1),
  classId: z.string().min(1),
  validated: z.boolean(),
});

// `z.infer` rend ici tous les champs optionnels (plusieurs versions de zod dans le
// workspace) : on retype explicitement la sortie de `parse`, qui a déjà validé.
interface SettingsBody {
  academicYearId: string;
  baseNote?: number;
  hoursPerPoint?: number;
  defaultSessionHours?: number;
  periodMinutes?: number;
  coefficient?: number;
}
interface ManualNoteBody {
  academicYearId: string;
  semesterId: string;
  classId: string;
  studentId: string;
  manualNote: number | null;
  comment?: string | null;
}
interface OverrideBody {
  academicYearId: string;
  semesterId: string;
  classId: string;
  studentId: string;
  subjectId: string;
  hours: number | null;
  reason?: string | null;
}
interface RecalcBody {
  academicYearId: string;
  semesterId: string;
  classId?: string;
  force?: boolean;
}
interface ValidateBody {
  academicYearId: string;
  semesterId: string;
  classId: string;
  validated: boolean;
}

const fail = (res: any, error: unknown, fallbackMsg: string) => {
  if ((error as any)?.name === 'ZodError') {
    return res.status(400).json({ success: false, error: 'Validation error', details: (error as any).errors });
  }
  if (error instanceof Error && /not found|invalide|comprise|does not belong/i.test(error.message)) {
    return res.status(400).json({ success: false, error: error.message });
  }
  console.error(fallbackMsg, error);
  return res.status(500).json({ success: false, error: fallbackMsg });
};

// --- Paramètres du calcul ---------------------------------------------------

// GET /api/conduct/settings?academicYearId=
router.get('/settings', authenticateToken, READERS, async (req, res) => {
  try {
    const { academicYearId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }
    const data = await ConductService.getSettings(academicYearId);
    res.json({ success: true, data });
  } catch (error) {
    fail(res, error, 'Failed to fetch conduct settings');
  }
});

// PUT /api/conduct/settings
router.put('/settings', authenticateToken, ADMIN, async (req, res) => {
  try {
    const body = settingsSchema.parse(req.body) as SettingsBody;
    const data = await ConductService.updateSettings(body.academicYearId, body);
    res.json({ success: true, data, message: 'Paramètres de conduite enregistrés.' });
  } catch (error) {
    fail(res, error, 'Failed to update conduct settings');
  }
});

// --- Lecture ----------------------------------------------------------------

/**
 * GET /api/conduct?academicYearId=&semesterId=&classId=
 * Notes de conduite enregistrées. `onlyValidated=false` (ADMIN) pour inclure les
 * brouillons ; par défaut on ne renvoie que les trimestres validés — c'est ce que
 * consomment « Notes par matière » et « Moyennes complètes ».
 */
router.get('/', authenticateToken, READERS, async (req, res) => {
  try {
    const { academicYearId, semesterId, classId, studentId, onlyValidated } = req.query as Record<string, string>;
    if (!academicYearId || !semesterId) {
      return res.status(400).json({ success: false, error: 'academicYearId et semesterId sont requis' });
    }

    const isAdmin = (req as any).user?.role === 'ADMIN';
    const data = await ConductService.getStored({
      academicYearId,
      semesterId,
      classId: classId || undefined,
      studentId: studentId || undefined,
      onlyValidated: isAdmin ? onlyValidated !== 'false' : true,
    });
    res.json({ success: true, data });
  } catch (error) {
    fail(res, error, 'Failed to fetch conduct grades');
  }
});

/**
 * GET /api/conduct/preview?academicYearId=&semesterId=&classId=
 * Calcul « à blanc » d'une classe (heures par matière, pénalité, note système,
 * note forcée, statut) — alimente la page de gestion de la conduite.
 */
router.get('/preview', authenticateToken, ADMIN, async (req, res) => {
  try {
    const { academicYearId, semesterId, classId } = req.query as Record<string, string>;
    if (!academicYearId || !semesterId || !classId) {
      return res
        .status(400)
        .json({ success: false, error: 'academicYearId, semesterId et classId sont requis' });
    }

    const { rows, settings } = await ConductService.computeClass({ academicYearId, semesterId, classId });
    res.json({
      success: true,
      data: {
        rows,
        settings,
        isValidated: rows.length > 0 && rows.every((r) => r.isValidated),
      },
    });
  } catch (error) {
    fail(res, error, 'Failed to compute conduct preview');
  }
});

// --- Écritures --------------------------------------------------------------

/**
 * POST /api/conduct/recalculate
 * Applique le calcul système et l'enregistre. `classId` omis ⇒ toutes les classes.
 * Les lignes déjà validées sont ignorées (sauf `force`) et les notes forcées par
 * l'admin sont toujours conservées.
 */
router.post('/recalculate', authenticateToken, ADMIN, async (req, res) => {
  try {
    const body = recalcSchema.parse(req.body) as RecalcBody;
    const result = await ConductService.recalculate(body);

    auditLogger.info('Conduct grades recalculated', {
      userId: (req as any).user.id,
      ...body,
      ...result,
    });

    const scope = body.classId ? 'la classe' : 'toutes les classes';
    res.json({
      success: true,
      data: result,
      message:
        `Conduite calculée pour ${scope} : ${result.updated} élève(s) mis à jour` +
        (result.skipped > 0 ? `, ${result.skipped} ignoré(s) (déjà validés).` : '.'),
    });
  } catch (error) {
    fail(res, error, 'Failed to recalculate conduct grades');
  }
});

// PATCH /api/conduct/manual-note — note forcée par l'admin (prioritaire sur le calcul)
router.patch('/manual-note', authenticateToken, ADMIN, async (req, res) => {
  try {
    const body = manualNoteSchema.parse(req.body) as ManualNoteBody;
    const saved = await ConductService.setManualNote(body);

    auditLogger.info('Conduct manual note set', {
      userId: (req as any).user.id,
      studentId: body.studentId,
      manualNote: body.manualNote,
    });

    res.json({
      success: true,
      data: saved,
      message: body.manualNote === null ? 'Note système rétablie.' : 'Note de conduite corrigée.',
    });
  } catch (error) {
    fail(res, error, 'Failed to set conduct manual note');
  }
});

// PUT /api/conduct/absence-override — corrige les heures d'absence d'une matière,
// avec justificatif (PDF/image) optionnel. Accepte le JSON classique (correction
// d'heures seule) comme le multipart/form-data (avec fichier `justificatif`).
router.put(
  '/absence-override',
  authenticateToken,
  ADMIN,
  justificatifUpload.single('justificatif'),
  handleUploadError,
  async (req, res) => {
    // Nettoie le fichier fraîchement uploadé si la suite échoue.
    const cleanupUploaded = async () => {
      if (req.file) {
        try {
          await deleteFile(getFilePath(req.file.filename, 'justificatif'));
        } catch (e) {
          console.error('Conduct: nettoyage du justificatif uploadé échoué', e);
        }
      }
    };

    try {
      const b = req.body as Record<string, string>;
      // `hours` : '' ou 'null' ⇒ réinitialisation (retour au calcul système).
      const rawHours = b.hours;
      const hours =
        rawHours === undefined || rawHours === '' || rawHours === 'null'
          ? null
          : Number(String(rawHours).replace(',', '.'));
      if (hours !== null && !Number.isFinite(hours)) {
        await cleanupUploaded();
        return res.status(400).json({ success: false, error: "Le nombre d'heures est invalide" });
      }

      const payload: OverrideBody & {
        justificatifUrl?: string | null;
        justificatifFilename?: string | null;
        removeJustificatif?: boolean;
      } = {
        academicYearId: b.academicYearId,
        semesterId: b.semesterId,
        classId: b.classId,
        studentId: b.studentId,
        subjectId: b.subjectId,
        hours,
        reason: b.reason ?? null,
      };

      if (!payload.academicYearId || !payload.semesterId || !payload.classId || !payload.studentId || !payload.subjectId) {
        await cleanupUploaded();
        return res.status(400).json({ success: false, error: 'Paramètres manquants' });
      }

      if (req.file) {
        payload.justificatifUrl = getFileUrl(req.file.filename, 'justificatif');
        // multer/busboy décode le nom d'origine en latin1 : sans cette conversion,
        // « certificat médical.pdf » s'afficherait « certificat mÃ©dical.pdf ».
        payload.justificatifFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      } else if (b.removeJustificatif === 'true') {
        payload.removeJustificatif = true;
      }

      const result = await ConductService.setAbsenceOverride(payload);

      auditLogger.info('Conduct absence hours overridden', {
        userId: (req as any).user.id,
        studentId: payload.studentId,
        subjectId: payload.subjectId,
        hours,
        justificatif: !!req.file,
      });

      res.json({
        success: true,
        data: result.rows,
        message: hours === null ? "Heures d'absence rétablies." : "Heures d'absence corrigées.",
      });
    } catch (error) {
      await cleanupUploaded();
      fail(res, error, 'Failed to override absence hours');
    }
  },
);

// POST /api/conduct/validate — verrouille la conduite du trimestre pour une classe
router.post('/validate', authenticateToken, ADMIN, async (req, res) => {
  try {
    const body = validateSchema.parse(req.body) as ValidateBody;
    const result = await ConductService.setValidation({ ...body, userId: (req as any).user.id });

    auditLogger.info('Conduct grades validation changed', {
      userId: (req as any).user.id,
      ...body,
      count: result.count,
    });

    res.json({
      success: true,
      data: result,
      message: body.validated
        ? `Conduite validée pour ${result.count} élève(s). Elle apparaît désormais dans les notes.`
        : 'Validation retirée.',
    });
  } catch (error) {
    fail(res, error, 'Failed to validate conduct grades');
  }
});

export default router;
