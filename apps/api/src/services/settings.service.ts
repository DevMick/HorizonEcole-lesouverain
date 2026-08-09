import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import config from '@school/config';

const prisma = new PrismaClient();

// Note: Settings can be stored in a simple key-value table or in a JSON config
// For now, we'll create services that return/update configuration

const schoolSettingsSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  logo: z.string().optional(),
  academicYearStart: z.number().min(1).max(12).optional(),
  gradeScale: z.number().positive().optional(),
  passingGrade: z.number().positive().optional(),
});

export class SettingsService {
  // Get school settings (mock - could be from DB or config file)
  static async getSchoolSettings() {
    // Identité et devise viennent de @school/config, qui fait autorité : les
    // dupliquer ici les avait fait diverger (l'école y était décrite au
    // Cameroun — XAF, Africa/Douala — alors qu'elle est en Côte d'Ivoire).
    return {
      name: config.school.name,
      address: config.school.address,
      phone: config.school.phone,
      email: config.school.email,
      website: config.school.website,
      logo: '/uploads/logo.png',
      academicYearStart: 9, // September
      gradeScale: 20,
      passingGrade: 10,
      currency: config.financial.currency,
      timezone: config.school.timezone,
    };
  }

  // Update school settings
  static async updateSchoolSettings(data: z.infer<typeof schoolSettingsSchema>) {
    // In a real app, this would update a settings table or config file
    // For now, we'll just return the merged settings
    const current = await this.getSchoolSettings();
    return { ...current, ...data };
  }

  // Get payment modes (can be dynamic or static)
  static async getPaymentModes() {
    return [
      { id: 'CASH', label: 'Espèces', isActive: true },
      { id: 'CHEQUE', label: 'Chèque', isActive: true },
      { id: 'VIREMENT', label: 'Virement Bancaire', isActive: true },
      { id: 'MOBILE_MONEY', label: 'Mobile Money', isActive: true },
      { id: 'CARTE', label: 'Carte Bancaire', isActive: true },
    ];
  }

  // Get expense categories
  static async getExpenseCategories() {
    return [
      { id: 'SALAIRES', label: 'Salaires', isActive: true },
      { id: 'FOURNITURES', label: 'Fournitures', isActive: true },
      { id: 'MAINTENANCE', label: 'Maintenance', isActive: true },
      { id: 'TRANSPORT', label: 'Transport', isActive: true },
      { id: 'ACTIVITES', label: 'Activités', isActive: true },
      { id: 'ENERGIE', label: 'Énergie', isActive: true },
      { id: 'LOYER', label: 'Loyer', isActive: true },
      { id: 'ASSURANCES', label: 'Assurances', isActive: true },
      { id: 'AUTRE', label: 'Autre', isActive: true },
    ];
  }

  // Get revenue sources
  static async getRevenueSources() {
    return [
      { id: 'SCOLARITE', label: 'Scolarité', isActive: true },
      { id: 'INSCRIPTION', label: 'Inscription', isActive: true },
      { id: 'CANTINE', label: 'Cantine', isActive: true },
      { id: 'TRANSPORT', label: 'Transport', isActive: true },
      { id: 'SUBVENTION', label: 'Subvention', isActive: true },
      { id: 'DON', label: 'Don', isActive: true },
      { id: 'AUTRE', label: 'Autre', isActive: true },
    ];
  }

  // Get all system configuration
  static async getSystemConfig() {
    const [school, paymentModes, expenseCategories, revenueSources] = await Promise.all([
      this.getSchoolSettings(),
      this.getPaymentModes(),
      this.getExpenseCategories(),
      this.getRevenueSources(),
    ]);

    return {
      school,
      paymentModes,
      expenseCategories,
      revenueSources,
      academicLevels: [
        { id: 'SIXIEME', label: '6ème' },
        { id: 'CINQUIEME', label: '5ème' },
        { id: 'QUATRIEME', label: '4ème' },
        { id: 'TROISIEME', label: '3ème' },
      ],
      userRoles: [
        { id: 'ADMIN', label: 'Administrateur' },
        { id: 'ENSEIGNANT', label: 'Enseignant' },
        { id: 'COMPTABLE', label: 'Comptable' },
        { id: 'STUDENT', label: 'Élève' },
        { id: 'PARENT', label: 'Parent' },
      ],
    };
  }
}

export { schoolSettingsSchema };
