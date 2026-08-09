import { Router, Response } from 'express';
import { prisma } from '@school/database';
import { UserRole } from '@school/types';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import {
  getAttendance,
  getBulletins,
  getGrades,
  getTimetable,
  type SchoolChild,
} from '../services/school-space.service';

/**
 * Espace Élève — lecture seule de sa propre scolarité.
 *
 * Aucune route n'accepte d'identifiant d'élève : le seul élève lisible est celui
 * du compte connecté (`students.user_id`). C'est plus strict que l'espace Parent,
 * où l'élève est un paramètre contrôlé — ici il n'est même pas exprimable, ce qui
 * élimine par construction toute possibilité de lire la scolarité d'un camarade.
 */
const router = Router();

router.use(authenticate, requireRole(UserRole.STUDENT));

/**
 * Élève du compte connecté. Répond directement 404 et renvoie `null` si le
 * compte n'est relié à aucune fiche élève.
 */
async function currentStudent(req: AuthRequest, res: Response): Promise<SchoolChild | null> {
  const student = await prisma.student.findFirst({
    where: { userId: req.user!.id },
    select: { id: true, classId: true, class: { select: { id: true, name: true } } },
  });

  if (!student) {
    res.status(404).json({
      success: false,
      error: 'Aucune fiche élève n\'est rattachée à ce compte',
    });
    return null;
  }

  return {
    id: student.id,
    classId: student.classId,
    className: student.class?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/student/me — identité de l'élève + sa classe
// ---------------------------------------------------------------------------
router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: {
        id: true,
        studentNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        avatarUrl: true,
        status: true,
        enrollmentDate: true,
        class: { select: { id: true, name: true } },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Aucune fiche élève n\'est rattachée à ce compte',
      });
    }

    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/student/timetable?academicYearId=
// ---------------------------------------------------------------------------
router.get('/timetable', async (req: AuthRequest, res, next) => {
  try {
    const student = await currentStudent(req, res);
    if (!student) return;

    const { academicYearId } = req.query as Record<string, string>;
    res.json({ success: true, data: await getTimetable(student, academicYearId) });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/student/attendance?academicYearId=&subjectId=&semesterId=
// ---------------------------------------------------------------------------
router.get('/attendance', async (req: AuthRequest, res, next) => {
  try {
    const student = await currentStudent(req, res);
    if (!student) return;

    const { academicYearId, subjectId, semesterId } = req.query as Record<string, string>;
    res.json({
      success: true,
      data: await getAttendance(student, { academicYearId, subjectId, semesterId }),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/student/grades?academicYearId=&semesterId=&subjectId=
// ---------------------------------------------------------------------------
router.get('/grades', async (req: AuthRequest, res, next) => {
  try {
    const student = await currentStudent(req, res);
    if (!student) return;

    const { academicYearId, semesterId, subjectId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }

    res.json({
      success: true,
      data: await getGrades(student, { academicYearId, semesterId, subjectId }),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/student/bulletins?academicYearId=
// ---------------------------------------------------------------------------
router.get('/bulletins', async (req: AuthRequest, res, next) => {
  try {
    const student = await currentStudent(req, res);
    if (!student) return;

    const { academicYearId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }

    res.json({ success: true, data: await getBulletins(student, academicYearId) });
  } catch (error) {
    next(error);
  }
});

export default router;
