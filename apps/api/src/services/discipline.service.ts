import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Validation schemas
const createIncidentSchema = z.object({
  studentId: z.string().uuid(),
  date: z.string().transform(str => new Date(str)),
  time: z.string().optional(),
  location: z.string().optional(),
  description: z.string().min(10),
  severity: z.enum(['MINEUR', 'MOYEN', 'GRAVE', 'TRES_GRAVE']),
  witnesses: z.string().optional(),
});

const updateIncidentSchema = createIncidentSchema.partial().omit({ studentId: true });

const createSanctionSchema = z.object({
  incidentId: z.string().uuid(),
  studentId: z.string().uuid(),
  sanctionType: z.enum(['AVERTISSEMENT', 'BLAME', 'EXCLUSION_TEMPORAIRE', 'EXCLUSION_DEFINITIVE', 'CONVOCATION_PARENTS', 'TRAVAUX_INTERET_GENERAL']),
  description: z.string(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
});

const updateSanctionSchema = createSanctionSchema.partial().omit({ incidentId: true, studentId: true });

export class DisciplineService {
  // ========== INCIDENTS ==========

  static async getIncidents(filters: {
    studentId?: string;
    reportedBy?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { studentId, reportedBy, severity, startDate, endDate, page = 1, limit = 50 } = filters;

    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (reportedBy) where.reportedBy = reportedBy;
    if (severity) where.severity = severity;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [incidents, total] = await Promise.all([
      prisma.disciplinary_incidents.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.disciplinary_incidents.count({ where }),
    ]);

    return { incidents, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getIncidentById(id: string) {
    const incident = await prisma.disciplinary_incidents.findUnique({
      where: { id },
      include: {
        student: { include: { studentParents: { include: { parents: true } } } },
      },
    });

    if (!incident) throw new Error('Disciplinary incident not found');
    return incident;
  }

  static async createIncident(data: z.infer<typeof createIncidentSchema>, reportedBy: string) {
    const student = await prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) throw new Error('Student not found');

    const timeDate = data.time ? new Date(`1970-01-01T${data.time}:00Z`) : undefined;

    const incident = await prisma.disciplinary_incidents.create({
      data: {
        id: crypto.randomUUID(),
        student: { connect: { id: data.studentId } },
        date: data.date,
        time: timeDate,
        description: data.description,
        severity: data.severity,
        location: data.location,
        witnesses: data.witnesses,
        reported_by: reportedBy,
      },
      include: {
        student: true,
      }
    });

    return incident;
  }

  static async updateIncident(id: string, data: z.infer<typeof updateIncidentSchema>) {
    const incident = await prisma.disciplinary_incidents.findUnique({ where: { id } });
    if (!incident) throw new Error('Disciplinary incident not found');

    const updateData: any = { ...data };
    if (data.time) {
      updateData.time = new Date(`1970-01-01T${data.time}:00Z`);
    }

    return await prisma.disciplinary_incidents.update({
      where: { id },
      data: updateData,
      include: { student: true }
    });
  }

  static async deleteIncident(id: string) {
    const incident = await prisma.disciplinary_incidents.findUnique({
      where: { id },
    });

    if (!incident) throw new Error('Disciplinary incident not found');

    // Note: sanctions model does not exist in schema, so we can delete directly

    await prisma.disciplinary_incidents.delete({ where: { id } });
    return { message: 'Disciplinary incident deleted successfully' };
  }

  // ========== SANCTIONS ==========

  static async getSanctions(filters: {
    incidentId?: string;
    studentId?: string;
    sanctionType?: string;
    isExecuted?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const { incidentId, studentId, sanctionType, isExecuted, page = 1, limit = 50 } = filters;

    const where: any = {};
    if (incidentId) where.incidentId = incidentId;
    if (studentId) where.studentId = studentId;
    if (sanctionType) where.sanctionType = sanctionType;
    if (isExecuted !== undefined) where.isExecuted = isExecuted;

    const [sanctions, total] = await Promise.all([
      Promise.resolve([]), // sanction model does not exist
      Promise.resolve(0), // sanction model does not exist
    ]);

    return { sanctions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getSanctionById(id: string) {
    // sanction model does not exist
    throw new Error('Sanction model does not exist');
  }

  static async createSanction(data: z.infer<typeof createSanctionSchema>, decidedBy: string) {
    // sanction model does not exist
    throw new Error('Sanction model does not exist');
  }

  static async updateSanction(id: string, data: z.infer<typeof updateSanctionSchema>) {
    // sanction model does not exist
    throw new Error('Sanction model does not exist');
  }

  static async executeSanction(id: string, executionNotes?: string) {
    // sanction model does not exist
    throw new Error('Sanction model does not exist');
  }

  static async deleteSanction(id: string) {
    // sanction model does not exist
    throw new Error('Sanction model does not exist');
  }

  // Statistics
  static async getDisciplineStats(filters: { startDate?: string; endDate?: string } = {}) {
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [
      totalIncidents,
      incidentsBySeverity,
      totalSanctions,
      sanctionsByType,
    ] = await Promise.all([
      prisma.disciplinary_incidents.count({ where }),
      prisma.disciplinary_incidents.groupBy({
        by: ['severity'],
        where,
        _count: true,
      }),
      Promise.resolve(0), // sanction model does not exist
      Promise.resolve([]), // sanction model does not exist
    ]);

    return {
      totalIncidents,
      incidentsBySeverity,
      totalSanctions,
      sanctionsByType,
    };
  }
}

export { createIncidentSchema, updateIncidentSchema, createSanctionSchema, updateSanctionSchema };
