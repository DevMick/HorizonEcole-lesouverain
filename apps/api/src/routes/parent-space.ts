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
 * Espace Parent — lecture seule des données scolaires de ses propres enfants.
 *
 * Ce routeur ne porte que le **contrôle d'accès** : chaque route commence par
 * `resolveChild`, qui n'accepte que les élèves reliés au parent connecté par
 * `student_parents`. La lecture elle-même est déléguée à `school-space.service`,
 * partagé avec l'espace Élève — les deux espaces montrent les mêmes données, ils
 * ne les autorisent simplement pas de la même façon.
 */
const router = Router();

router.use(authenticate, requireRole(UserRole.PARENT));

/** Fiche `parents` du compte connecté (le lien passe par parents.user_id). */
async function currentParent(req: AuthRequest) {
  return prisma.parents.findFirst({
    where: { user_id: req.user!.id },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      relation: true,
      phone: true,
      email: true,
      address: true,
      profession: true,
      workplace: true,
      avatar_url: true,
      is_primary_contact: true,
      is_financial_responsible: true,
    },
  });
}

/**
 * Vérifie que `studentId` est bien un enfant du parent connecté et renvoie
 * l'élève. Répond directement (404/403) et renvoie `null` sinon — l'appelant
 * n'a plus qu'à `return` si le résultat est nul.
 */
async function resolveChild(
  req: AuthRequest,
  res: Response,
  studentId: string,
): Promise<SchoolChild | null> {
  const parent = await currentParent(req);
  if (!parent) {
    res.status(404).json({
      success: false,
      error: 'Aucune fiche parent n\'est rattachée à ce compte',
    });
    return null;
  }

  const link = await prisma.student_parents.findFirst({
    where: { parent_id: parent.id, student_id: studentId },
    select: {
      student: {
        select: { id: true, classId: true, class: { select: { id: true, name: true } } },
      },
    },
  });

  if (!link) {
    res.status(403).json({
      success: false,
      error: 'Cet élève n\'est pas rattaché à votre compte',
    });
    return null;
  }

  return {
    id: link.student.id,
    classId: link.student.classId,
    className: link.student.class?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/parent/me — profil du parent + enfants rattachés
// ---------------------------------------------------------------------------
router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const parent = await currentParent(req);
    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Aucune fiche parent n\'est rattachée à ce compte',
      });
    }

    const links = await prisma.student_parents.findMany({
      where: { parent_id: parent.id },
      orderBy: { created_at: 'asc' },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            avatarUrl: true,
            status: true,
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        parent: {
          id: parent.id,
          firstName: parent.first_name,
          lastName: parent.last_name,
          relation: parent.relation,
          phone: parent.phone,
          email: parent.email,
          address: parent.address,
          profession: parent.profession,
          workplace: parent.workplace,
          avatarUrl: parent.avatar_url,
          isPrimaryContact: parent.is_primary_contact,
          isFinancialResponsible: parent.is_financial_responsible,
        },
        children: links.map((l) => ({
          id: l.student.id,
          studentNumber: l.student.studentNumber,
          firstName: l.student.firstName,
          lastName: l.student.lastName,
          dateOfBirth: l.student.dateOfBirth,
          gender: l.student.gender,
          avatarUrl: l.student.avatarUrl,
          status: l.student.status,
          relation: l.relation,
          class: l.student.class,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/parent/children/:studentId/timetable?academicYearId=
// ---------------------------------------------------------------------------
router.get('/children/:studentId/timetable', async (req: AuthRequest, res, next) => {
  try {
    const child = await resolveChild(req, res, req.params.studentId);
    if (!child) return;

    const { academicYearId } = req.query as Record<string, string>;
    res.json({ success: true, data: await getTimetable(child, academicYearId) });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/parent/children/:studentId/attendance?academicYearId=&subjectId=&semesterId=
// ---------------------------------------------------------------------------
router.get('/children/:studentId/attendance', async (req: AuthRequest, res, next) => {
  try {
    const child = await resolveChild(req, res, req.params.studentId);
    if (!child) return;

    const { academicYearId, subjectId, semesterId } = req.query as Record<string, string>;
    res.json({
      success: true,
      data: await getAttendance(child, { academicYearId, subjectId, semesterId }),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/parent/children/:studentId/grades?academicYearId=&semesterId=&subjectId=
// ---------------------------------------------------------------------------
router.get('/children/:studentId/grades', async (req: AuthRequest, res, next) => {
  try {
    const child = await resolveChild(req, res, req.params.studentId);
    if (!child) return;

    const { academicYearId, semesterId, subjectId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }

    res.json({
      success: true,
      data: await getGrades(child, { academicYearId, semesterId, subjectId }),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/parent/children/:studentId/bulletins?academicYearId=
// ---------------------------------------------------------------------------
router.get('/children/:studentId/bulletins', async (req: AuthRequest, res, next) => {
  try {
    const child = await resolveChild(req, res, req.params.studentId);
    if (!child) return;

    const { academicYearId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'academicYearId est requis' });
    }

    res.json({ success: true, data: await getBulletins(child, academicYearId) });
  } catch (error) {
    next(error);
  }
});

export default router;
