import { prisma } from '@school/database';
import { z } from 'zod';
import { TeacherRemunerationService } from './teacher-remuneration.service';
import { TeacherAbsenceService } from './teacher-absence.service';
import { Decimal } from '@prisma/client/runtime/library';

// Validation schemas
const generatePayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  teacherIds: z.array(z.string().uuid()).optional(), // Si vide, tous les enseignants
  contractTypes: z.array(z.enum(['CDI', 'CDD', 'VACATAIRE'])).optional(),
});

const validatePayrollSchema = z.object({
  payrollId: z.string().uuid(),
});

const recordPaymentSchema = z.object({
  payrollId: z.string().uuid(),
  amount: z.number().positive(),
  paymentDate: z.string().transform(str => new Date(str)),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const createAdvanceSchema = z.object({
  teacherId: z.string().uuid(),
  amount: z.number().positive(),
  paymentDate: z.string().transform(str => new Date(str)),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export class PayrollService {
  /**
   * Get payroll settings
   */
  static async getSettings() {
    let settings = await prisma.payroll_settings.findFirst();

    if (!settings) {
      // Create default settings
      settings = await prisma.payroll_settings.create({
        data: {
          date_calcul_mensuel: 25,
          nombre_semaines_par_mois: new Decimal(4.33),
          seniority_rule_type: 'MONTANT_PAR_PALIER',
          seniority_rule_value: null,
          seniority_rule_max: null,
          seniority_bareme: null,
          prorata_enabled: true,
          prorata_basis: 'CALENDAR_DAYS',
          prorata_days_in_month_method: 'ACTUAL',
          prorata_rounding: 'ROUND_NEAREST',
          prorata_include_primes: true,
          prorata_apply_to: null,
          acompte_enabled: true,
          acompte_max_pct_per_month: new Decimal(40),
          acompte_max_amount_per_request: new Decimal(500000),
          acompte_max_requests_per_month: 2,
          acompte_requires_admin_approval: true,
          acompte_auto_apply_to_payroll: true,
          acompte_allow_multiple_types: true,
          acompte_rounding: 'ROUND_NEAREST',
          acompte_repayment_method: 'SINGLE_MONTH',
          assiette_imposable: 'BRUT_MOINS_COTISATIONS',
          calcul_igr_actif: false,
          calcul_cnps_actif: true,
        } as any,
      });
    }

    return settings;
  }

  /**
   * Update payroll settings
   */
  static async updateSettings(data: any) {
    let settings = await prisma.payroll_settings.findFirst();

    const updateData: any = {
      date_calcul_mensuel: data.dateCalculMensuel,
      nombre_semaines_par_mois: data.nombreSemainesParMois ? new Decimal(data.nombreSemainesParMois) : undefined,
      seniority_rule_type: data.seniorityRuleType,
      seniority_rule_value: data.seniorityRuleValue ? new Decimal(data.seniorityRuleValue) : undefined,
      seniority_rule_max: data.seniorityRuleMax !== undefined ? (data.seniorityRuleMax ? new Decimal(data.seniorityRuleMax) : null) : undefined,
      seniority_bareme: data.seniorityBareme ? JSON.parse(JSON.stringify(data.seniorityBareme)) : undefined,
      // Prorata configuration
      prorata_enabled: data.prorataEnabled,
      prorata_basis: data.prorataBasis,
      prorata_days_in_month_method: data.prorataDaysInMonthMethod,
      prorata_rounding: data.prorataRounding,
      prorata_include_primes: data.prorataIncludePrimes,
      prorata_apply_to: data.prorataApplyTo ? JSON.parse(JSON.stringify(data.prorataApplyTo)) : undefined,
      // Acompte configuration
      acompte_enabled: data.acompteEnabled,
      acompte_max_pct_per_month: data.acompteMaxPctPerMonth !== undefined ? (data.acompteMaxPctPerMonth ? new Decimal(data.acompteMaxPctPerMonth) : null) : undefined,
      acompte_max_amount_per_request: data.acompteMaxAmountPerRequest !== undefined ? (data.acompteMaxAmountPerRequest ? new Decimal(data.acompteMaxAmountPerRequest) : null) : undefined,
      acompte_max_requests_per_month: data.acompteMaxRequestsPerMonth,
      acompte_requires_admin_approval: data.acompteRequiresAdminApproval,
      acompte_auto_apply_to_payroll: data.acompteAutoApplyToPayroll,
      acompte_allow_multiple_types: data.acompteAllowMultipleTypes,
      acompte_rounding: data.acompteRounding,
      acompte_repayment_method: data.acompteRepaymentMethod,
      acompte_plafond_percent: data.acomptePlafondPercent !== undefined ? (data.acomptePlafondPercent ? new Decimal(data.acomptePlafondPercent) : null) : undefined, // Ancien champ, conservé pour compatibilité
      assiette_imposable: 'BRUT_MOINS_COTISATIONS',
      calcul_igr_actif: data.calculIgrActif,
      calcul_cnps_actif: data.calculCnpsActif,
      taux_cnps_salarie: data.tauxCnpsSalarie !== undefined ? (data.tauxCnpsSalarie ? new Decimal(data.tauxCnpsSalarie) : null) : undefined,
      taux_cnps_employeur: data.tauxCnpsEmployeur !== undefined ? (data.tauxCnpsEmployeur ? new Decimal(data.tauxCnpsEmployeur) : null) : undefined,
      bareme_imposition: data.baremeImposition ? JSON.parse(JSON.stringify(data.baremeImposition)) : undefined,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    if (!settings) {
      // Set defaults for creation
      updateData.date_calcul_mensuel = updateData.date_calcul_mensuel ?? 25;
      updateData.nombre_semaines_par_mois = updateData.nombre_semaines_par_mois ?? new Decimal(4.33);
      updateData.seniority_rule_type = updateData.seniority_rule_type ?? 'MONTANT_PAR_PALIER';
      updateData.prorata_enabled = updateData.prorata_enabled ?? true;
      updateData.prorata_basis = updateData.prorata_basis ?? 'CALENDAR_DAYS';
      updateData.prorata_days_in_month_method = updateData.prorata_days_in_month_method ?? 'ACTUAL';
      updateData.prorata_rounding = updateData.prorata_rounding ?? 'ROUND_NEAREST';
      updateData.prorata_include_primes = updateData.prorata_include_primes ?? true;
      updateData.acompte_enabled = updateData.acompte_enabled ?? true;
      updateData.acompte_max_requests_per_month = updateData.acompte_max_requests_per_month ?? 2;
      updateData.acompte_requires_admin_approval = updateData.acompte_requires_admin_approval ?? true;
      updateData.acompte_auto_apply_to_payroll = updateData.acompte_auto_apply_to_payroll ?? true;
      updateData.acompte_allow_multiple_types = updateData.acompte_allow_multiple_types ?? true;
      updateData.acompte_rounding = updateData.acompte_rounding ?? 'ROUND_NEAREST';
      updateData.acompte_repayment_method = updateData.acompte_repayment_method ?? 'SINGLE_MONTH';
      updateData.assiette_imposable = 'BRUT_MOINS_COTISATIONS';
      updateData.calcul_igr_actif = updateData.calcul_igr_actif ?? false;
      updateData.calcul_cnps_actif = updateData.calcul_cnps_actif ?? true;

      settings = await prisma.payroll_settings.create({
        data: updateData as any,
      });
    } else {
      settings = await prisma.payroll_settings.update({
        where: { id: settings.id },
        data: updateData as any,
      });
    }

    return settings;
  }

  /**
   * Calculate base salary for a teacher
   * Différencie CDI/CDD (forfait) vs Vacataire (heures effectuées)
   */
  static async calculateBaseSalary(teacherId: string, month: number, year: number, settings: any) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return { baseSalary: new Decimal(0), hoursWorked: new Decimal(0) };
    }

    const remuneration = await TeacherRemunerationService.getOrCreateRemuneration(teacherId);

    // VACATAIRE : utiliser les heures effectuées du mois
    if (teacher.contract_type === 'VACATAIRE' || remuneration.mode_remuneration === 'HORAIRE') {
      if (!remuneration.taux_horaire) {
        return { baseSalary: new Decimal(0), hoursWorked: new Decimal(0) };
      }

      // Récupérer les heures effectuées pour ce mois (si enregistrées)
      const teacherHours = await prisma.teacher_hours.findFirst({
        where: {
          teacher_id: teacherId,
          month,
          year,
        },
      });

      let hoursWorked: Decimal;
      if (teacherHours) {
        // Utiliser les heures enregistrées
        hoursWorked = teacherHours.hours_worked;
      } else {
        // Fallback : utiliser heures hebdo × semaines (si défini)
        if (remuneration.heures_hebdo) {
          hoursWorked = new Decimal(Number(remuneration.heures_hebdo) * Number(settings.nombre_semaines_par_mois));
        } else {
          hoursWorked = new Decimal(0);
        }
      }

      const baseSalary = new Decimal(Number(remuneration.taux_horaire) * Number(hoursWorked));

      return {
        baseSalary,
        hoursWorked,
      };
    } else {
      // CDI/CDD : FORFAIT_MENSUEL
      const baseSalary = remuneration.forfait_mensuel || new Decimal(0);
      return {
        baseSalary,
        hoursWorked: null,
      };
    }
  }

  /**
   * Calculate allowances for a teacher
   * Inclut les primes récurrentes et exceptionnelles (non récurrentes) pour le mois
   * Une prime est incluse si elle est active à n'importe quel moment du mois
   */
  static async calculateAllowances(teacherId: string, baseSalary: Decimal, month: number, year: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    // Récupérer les primes récurrentes
    // Une prime récurrente est incluse si :
    // - effective_from <= lastDayOfMonth (commence avant ou pendant le mois)
    // - effective_to est null OU effective_to >= firstDayOfMonth (se termine après ou pendant le mois)
    const recurringAllowances = await prisma.teacher_allowances.findMany({
      where: {
        teacher_id: teacherId,
        is_recurring: true,
        effective_from: {
          lte: lastDayOfMonth, // Commence avant ou pendant le mois
        },
        OR: [
          { effective_to: null }, // Pas de date de fin (en cours)
          { effective_to: { gte: firstDayOfMonth } }, // Se termine après ou pendant le mois
        ],
      },
    });

    // Récupérer les primes exceptionnelles (non récurrentes) pour ce mois
    // Même logique : incluse si active à n'importe quel moment du mois
    const exceptionnalAllowances = await prisma.teacher_allowances.findMany({
      where: {
        teacher_id: teacherId,
        is_recurring: false,
        effective_from: {
          lte: lastDayOfMonth, // Commence avant ou pendant le mois
        },
        OR: [
          { effective_to: null }, // Pas de date de fin (en cours)
          { effective_to: { gte: firstDayOfMonth } }, // Se termine après ou pendant le mois
        ],
      },
    });

    // Combiner les deux types de primes
    const allAllowances = [...recurringAllowances, ...exceptionnalAllowances];

    let totalAllowances = new Decimal(0);
    const items: any[] = [];

    for (const allowance of allAllowances) {
      let amount = new Decimal(0);

      if (allowance.type_montant === 'MONTANT_FIXE') {
        amount = allowance.amount;
      } else {
        // POURCENTAGE_DU_BRUT
        const percentage = Number(allowance.amount) / 100;
        amount = new Decimal(Number(baseSalary) * percentage);
      }

      totalAllowances = new Decimal(Number(totalAllowances) + Number(amount));

      items.push({
        item_type: 'ALLOWANCE',
        item_label: allowance.title,
        amount,
        allowance_id: allowance.id,
        is_taxable: allowance.is_taxable,
        notes: allowance.notes,
      });
    }

    return { totalAllowances, items };
  }

  /**
   * Calculate seniority bonus
   * Exclut les vacataires et les CDD de moins de 1 an (optionnel)
   */
  static async calculateSeniorityBonus(teacherId: string, baseSalary: Decimal, settings: any) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return { bonus: new Decimal(0), items: [] };
    }

    // VACATAIRE : pas d'ancienneté
    if (teacher.contract_type === 'VACATAIRE') {
      return { bonus: new Decimal(0), items: [] };
    }

    // CDD : vérifier si durée ≥ 1 an (optionnel, à configurer)
    if (teacher.contract_type === 'CDD' && teacher.end_date) {
      const contractDuration = (new Date(teacher.end_date).getTime() - new Date(teacher.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (contractDuration < 1) {
        // CDD de moins de 1 an : pas d'ancienneté (règle configurable)
        return { bonus: new Decimal(0), items: [] };
      }
    }

    const seniorityYears = TeacherRemunerationService.calculateSeniority(teacher.hire_date);
    
    if (seniorityYears <= 0) {
      return { bonus: new Decimal(0), items: [] };
    }

    let bonus = new Decimal(0);
    let percentage = 0;

    if (settings.seniority_rule_type === 'POURCENTAGE_PAR_ANNEE') {
      // Ancien système : pourcentage par année
      const percentagePerYear = Number(settings.seniority_rule_value || 0);
      const calculatedPercentage = percentagePerYear * seniorityYears;
      const maxPercentage = settings.seniority_rule_max ? Number(settings.seniority_rule_max) : 100;
      percentage = Math.min(calculatedPercentage, maxPercentage);
      bonus = new Decimal(Number(baseSalary) * (percentage / 100));
    } else if (settings.seniority_rule_type === 'MONTANT_PAR_PALIER') {
      // Nouveau système : barème par paliers
      const bareme = settings.seniority_bareme as Array<{ minYears: number; maxYears: number | null; percentage: number }> | null;
      
      if (bareme && Array.isArray(bareme) && bareme.length > 0) {
        // Trier les paliers par minYears (croissant)
        const sortedBareme = [...bareme].sort((a, b) => a.minYears - b.minYears);
        
        // Trouver le palier correspondant à l'ancienneté
        for (const palier of sortedBareme) {
          const minYears = palier.minYears;
          const maxYears = palier.maxYears;
          
          // Vérifier si l'ancienneté est dans ce palier
          if (seniorityYears >= minYears && (maxYears === null || seniorityYears <= maxYears)) {
            percentage = palier.percentage;
            bonus = new Decimal(Number(baseSalary) * (percentage / 100));
            break;
          }
        }
      }
    }

    return {
      bonus,
      items: bonus.gt(0) ? [{
        item_type: 'SENIORITY',
        item_label: `Prime ancienneté (${seniorityYears} ans - ${percentage.toFixed(2)}%)`,
        amount: bonus,
        is_taxable: true,
      }] : [],
    };
  }

  /**
   * Calculate prorata based on hire date, end date, and absences
   * Utilise les nouveaux paramètres de configuration (prorata_enabled, prorata_basis, etc.)
   * Ne s'applique pas aux vacataires (heures à l'acte)
   */
  static async calculateProrata(
    teacherId: string,
    month: number,
    year: number,
    baseSalary: Decimal,
    settings: any
  ) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return {
        prorataAmount: new Decimal(0),
        daysWorked: 0,
        totalDays: 0,
        ratio: 1,
      };
    }

    // Si prorata désactivé, retourner le salaire complet
    if (settings.prorata_enabled === false) {
      return {
        prorataAmount: baseSalary,
        daysWorked: 0,
        totalDays: 0,
        ratio: 1,
      };
    }

    // VACATAIRE : pas de prorata (heures à l'acte)
    if (teacher.contract_type === 'VACATAIRE') {
      return {
        prorataAmount: baseSalary, // Pas de réduction
        daysWorked: 0,
        totalDays: 0,
        ratio: 1,
      };
    }

    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    let startDate = firstDayOfMonth;
    let endDate = lastDayOfMonth;

    // Si embauche dans le mois
    if (teacher.hire_date > firstDayOfMonth) {
      startDate = new Date(teacher.hire_date);
    }

    // Si CDD et fin de contrat dans le mois
    if (teacher.contract_type === 'CDD' && teacher.end_date && new Date(teacher.end_date) < lastDayOfMonth) {
      endDate = new Date(teacher.end_date);
    }

    // Calculer jours travaillés selon la méthode de base (basis)
    let daysWorked = 0;
    let totalDays = 0;

    const basis = settings.prorata_basis || 'CALENDAR_DAYS';
    const daysInMonthMethod = settings.prorata_days_in_month_method || 'ACTUAL';

    if (basis === 'CALENDAR_DAYS') {
      // Jours civils : tous les jours du mois
      if (daysInMonthMethod === 'FIXED_30') {
        totalDays = 30;
      } else {
        totalDays = lastDayOfMonth.getDate();
      }
      daysWorked = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    } else if (basis === 'WORKING_DAYS') {
      // Jours ouvrés (lundi-vendredi)
      totalDays = daysInMonthMethod === 'FIXED_30' 
        ? 22 // Approximation : ~22 jours ouvrés dans 30 jours
        : this.calculateWorkingDays(firstDayOfMonth, lastDayOfMonth);
      daysWorked = this.calculateWorkingDays(startDate, endDate);
    } else if (basis === 'HOURS') {
      // Basé sur heures effectives (pour contrats horaires)
      // Récupérer les heures effectuées pour ce mois
      const teacherHours = await prisma.teacher_hours.findFirst({
        where: {
          teacher_id: teacherId,
          month,
          year,
        },
      });

      if (teacherHours) {
        const remuneration = await TeacherRemunerationService.getOrCreateRemuneration(teacherId);
        if (remuneration.heures_hebdo) {
          // Heures mensuelles théoriques
          const monthlyHours = Number(remuneration.heures_hebdo) * Number(settings.nombre_semaines_par_mois);
          totalDays = monthlyHours;
          daysWorked = Number(teacherHours.hours_worked);
        } else {
          // Pas de base de calcul, pas de prorata
          return {
            prorataAmount: baseSalary,
            daysWorked: 0,
            totalDays: 0,
            ratio: 1,
          };
        }
      } else {
        // Pas d'heures enregistrées, pas de prorata
        return {
          prorataAmount: baseSalary,
          daysWorked: 0,
          totalDays: 0,
          ratio: 1,
        };
      }
    }

    const ratio = totalDays > 0 ? daysWorked / totalDays : 1;
    let prorataAmount = new Decimal(Number(baseSalary) * ratio);

    // Appliquer l'arrondi selon la règle configurée
    const rounding = settings.prorata_rounding || 'ROUND_NEAREST';
    if (rounding === 'ROUND_UP') {
      prorataAmount = prorataAmount.ceil();
    } else {
      prorataAmount = prorataAmount.round();
    }

    return {
      prorataAmount,
      daysWorked,
      totalDays,
      ratio,
    };
  }

  /**
   * Calculate working days (Monday to Friday) between two dates
   */
  static calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  /**
   * Calculate IGR based on taxable base and tax brackets
   * Assiette imposable : BRUT_MOINS_COTISATIONS (seule option disponible)
   */
  static calculateIGR(totalBrut: Decimal, cnpsSalarie: Decimal, settings: any): Decimal {
    // Assiette imposable : BRUT_MOINS_COTISATIONS (seule option)
    const taxableBase = new Decimal(Number(totalBrut) - Number(cnpsSalarie));

    // Get tax brackets from settings
    const bareme = settings.bareme_imposition as Array<{
      minAmount: number;
      maxAmount: number | null;
      rate: number;
    }> | null;

    if (!bareme || !Array.isArray(bareme) || bareme.length === 0) {
      // No brackets configured, return 0
      return new Decimal(0);
    }

    // Sort brackets by minAmount (ascending)
    const sortedBareme = [...bareme].sort((a, b) => a.minAmount - b.minAmount);

    let totalIGR = new Decimal(0);
    const taxableAmount = Number(taxableBase);

    // Apply progressive tax brackets
    for (let i = 0; i < sortedBareme.length; i++) {
      const bracket = sortedBareme[i];
      const minAmount = bracket.minAmount;
      const maxAmount = bracket.maxAmount === null ? Infinity : bracket.maxAmount;
      const rate = bracket.rate;

      if (taxableAmount > minAmount) {
        // Calculate the amount in this bracket
        const bracketAmount = Math.min(taxableAmount, maxAmount) - minAmount;
        
        if (bracketAmount > 0) {
          // Calculate tax for this bracket
          const bracketTax = new Decimal(bracketAmount * (rate / 100));
          totalIGR = new Decimal(Number(totalIGR) + Number(bracketTax));
        }
      }
    }

    return totalIGR;
  }

  /**
   * Calculate deductions (absences, advances)
   * Prend en compte les nouvelles règles d'acomptes (status APPROVED, repayment_method, etc.)
   */
  static async calculateDeductions(teacherId: string, month: number, year: number, settings?: any) {
    const payrollSettings = settings || await this.getSettings();

    // Si les acomptes sont désactivés, ne pas déduire
    if (payrollSettings.acompte_enabled === false || payrollSettings.acompte_auto_apply_to_payroll === false) {
      return {
        absencesDeduction: new Decimal(0),
        advancesDeduction: new Decimal(0),
        items: [],
      };
    }

    // Get unpaid advances (APPROVED status only)
    const advances = await prisma.advance_payments.findMany({
      where: {
        teacher_id: teacherId,
        deducted: false,
        status: 'APPROVED', // Seuls les acomptes approuvés sont déduits
      },
    });

    // Filtrer selon repayment_method
    const applicableAdvances = advances.filter(advance => {
      if (advance.repayment_method === 'SINGLE_MONTH') {
        // Déduire immédiatement
        return true;
      } else if (advance.repayment_method === 'INSTALLMENTS') {
        // Vérifier si c'est le bon mois pour cette échéance
        // Pour simplifier, on déduit proportionnellement selon installments_count
        // TODO: Implémenter une logique plus sophistiquée avec un calendrier d'échéances
        const installmentsCount = advance.installments_count || 1;
        const monthsSincePayment = this.getMonthsDifference(advance.payment_date, new Date(year, month - 1, 1));
        return monthsSincePayment < installmentsCount;
      }
      return true;
    });

    // Calculer le montant total à déduire
    let advancesTotal = new Decimal(0);
    const items: any[] = [];

    for (const advance of applicableAdvances) {
      let advanceAmount = new Decimal(Number(advance.amount));

      if (advance.repayment_method === 'INSTALLMENTS') {
        // Diviser par le nombre d'échéances
        const installmentsCount = advance.installments_count || 1;
        advanceAmount = new Decimal(Number(advance.amount) / installmentsCount);
      }

      // Appliquer l'arrondi selon la règle configurée
      const rounding = payrollSettings.acompte_rounding || 'ROUND_NEAREST';
      if (rounding === 'ROUND_UP') {
        advanceAmount = advanceAmount.ceil();
      } else {
        advanceAmount = advanceAmount.round();
      }

      advancesTotal = advancesTotal.plus(advanceAmount);

      items.push({
        item_type: 'ADVANCE',
        item_label: advance.repayment_method === 'INSTALLMENTS'
          ? `Acompte du ${advance.payment_date.toISOString().split('T')[0]} (échéance)`
          : `Acompte du ${advance.payment_date.toISOString().split('T')[0]}`,
        amount: advanceAmount.neg(), // Montant négatif pour déduction
        is_taxable: false,
        notes: advance.notes,
      });
    }

    // Calculate absences deduction
    const absencesDeduction = await this.calculateAbsencesDeduction(teacherId, month, year, payrollSettings);

    // Add absence items to deduction items if there are absences
    if (absencesDeduction.gt(0)) {
      const absences = await TeacherAbsenceService.getAbsences({
        teacherId,
        month,
        year,
        isJustified: false, // Seules les absences injustifiées sont déduites
      });

      // Récupérer le total des heures d'absence pour la répartition proportionnelle
      const totalHoursAbsent = await TeacherAbsenceService.getTotalHoursAbsent(teacherId, month, year);
      
      // Calculer le montant total de déduction pour répartir proportionnellement
      const totalDeduction = Number(absencesDeduction);
      const totalHours = Number(totalHoursAbsent);
      
      for (const absence of absences) {
        const hours = Number(absence.hours_absent);
        // Répartir proportionnellement le montant total selon les heures
        const absenceDeduction = totalHours > 0 
          ? new Decimal(totalDeduction * (hours / totalHours))
          : new Decimal(0);
        
        items.push({
          item_type: 'ABSENCE',
          item_label: `Absence du ${absence.date.toISOString().split('T')[0]} (${hours}h - injustifiée)`,
          amount: absenceDeduction.neg(), // Montant négatif pour déduction
          is_taxable: false,
          notes: absence.reason || absence.notes,
        });
      }
    }

    return {
      absencesDeduction,
      advancesDeduction: advancesTotal,
      items,
    };
  }

  /**
   * Calculate absences deduction amount for a teacher in a specific month
   * Selon les règles :
   * - CDI : (Heures d'absence / Heures mensuelles) × Salaire mensuel
   * - CDD : Heures d'absence × Taux horaire
   * - Vacataire : Pas de retenue (déjà géré par les heures effectuées)
   */
  static async calculateAbsencesDeduction(
    teacherId: string,
    month: number,
    year: number,
    settings: any
  ): Promise<Decimal> {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      include: {
        remuneration: true,
      },
    });

    if (!teacher || !teacher.remuneration) {
      return new Decimal(0);
    }

    // VACATAIRE : Pas de retenue (les heures non effectuées ne sont pas payées)
    if (teacher.contract_type === 'VACATAIRE') {
      return new Decimal(0);
    }

    // Récupérer les heures d'absence injustifiées pour le mois
    const totalHoursAbsent = await TeacherAbsenceService.getTotalHoursAbsent(teacherId, month, year);

    if (totalHoursAbsent.eq(0)) {
      return new Decimal(0);
    }

    const hoursAbsent = Number(totalHoursAbsent);
    const remuneration = teacher.remuneration;

    if (teacher.contract_type === 'CDI') {
      // CDI : (Heures d'absence / Heures mensuelles) × Salaire mensuel
      if (remuneration.mode_remuneration === 'FORFAIT_MENSUEL' && remuneration.forfait_mensuel) {
        // Calculer les heures mensuelles théoriques
        const monthlyHours = remuneration.heures_hebdo
          ? Number(remuneration.heures_hebdo) * Number(settings.nombre_semaines_par_mois)
          : 0;

        if (monthlyHours > 0) {
          const deduction = new Decimal(Number(remuneration.forfait_mensuel) * (hoursAbsent / monthlyHours));
          return deduction;
        }
      }
    } else if (teacher.contract_type === 'CDD') {
      // CDD : Heures d'absence × Taux horaire
      if (remuneration.mode_remuneration === 'HORAIRE' && remuneration.taux_horaire) {
        const deduction = new Decimal(Number(remuneration.taux_horaire) * hoursAbsent);
        return deduction;
      } else if (remuneration.mode_remuneration === 'FORFAIT_MENSUEL' && remuneration.forfait_mensuel) {
        // Si CDD avec forfait, calculer le taux horaire à partir du forfait
        const monthlyHours = remuneration.heures_hebdo
          ? Number(remuneration.heures_hebdo) * Number(settings.nombre_semaines_par_mois)
          : 0;

        if (monthlyHours > 0) {
          const tauxHoraire = Number(remuneration.forfait_mensuel) / monthlyHours;
          const deduction = new Decimal(tauxHoraire * hoursAbsent);
          return deduction;
        }
      }
    }

    return new Decimal(0);
  }


  /**
   * Calculate the number of months between two dates
   */
  static getMonthsDifference(date1: Date, date2: Date): number {
    const yearDiff = date2.getFullYear() - date1.getFullYear();
    const monthDiff = date2.getMonth() - date1.getMonth();
    return yearDiff * 12 + monthDiff;
  }

  /**
   * Generate payroll for a teacher
   */
  static async generatePayrollForTeacher(teacherId: string, month: number, year: number, createdBy?: string) {
    const settings = await this.getSettings();

    // Check if payroll already exists
    const existing = await prisma.monthly_payrolls.findFirst({
      where: {
        teacher_id: teacherId,
        month,
        year,
      },
    });

    if (existing && existing.status !== 'DRAFT') {
      throw new Error('Une paie validée existe déjà pour ce mois');
    }

    // Calculate base salary
    const { baseSalary, hoursWorked } = await this.calculateBaseSalary(teacherId, month, year, settings);

    // Calculate prorata (pour CDI/CDD uniquement)
    const { prorataAmount, daysWorked, totalDays } = await this.calculateProrata(
      teacherId,
      month,
      year,
      baseSalary,
      settings
    );

    // Calculate allowances
    const { totalAllowances, items: allowanceItems } = await this.calculateAllowances(teacherId, prorataAmount, month, year);

    // Calculate seniority bonus (exclut vacataires)
    const { bonus: seniorityBonus, items: seniorityItems } = await this.calculateSeniorityBonus(teacherId, prorataAmount, settings);

    // Calculate deductions (passer settings pour les règles d'acomptes)
    const { absencesDeduction, advancesDeduction, items: deductionItems } = await this.calculateDeductions(teacherId, month, year, settings);

    // Calculate total brut (avec prorata appliqué sur base + primes récurrentes)
    const totalBrut = new Decimal(Number(prorataAmount) + Number(totalAllowances) + Number(seniorityBonus));

    // Calculate CNPS and IGR if enabled
    let cnpsSalarie = new Decimal(0);
    let cnpsEmployeur = new Decimal(0);
    let igr = new Decimal(0);

    if (settings.calcul_cnps_actif && settings.taux_cnps_salarie) {
      cnpsSalarie = new Decimal(Number(totalBrut) * (Number(settings.taux_cnps_salarie) / 100));
    }

    if (settings.calcul_cnps_actif && settings.taux_cnps_employeur) {
      cnpsEmployeur = new Decimal(Number(totalBrut) * (Number(settings.taux_cnps_employeur) / 100));
    }

    // Calculate IGR if enabled
    if (settings.calcul_igr_actif) {
      igr = this.calculateIGR(totalBrut, cnpsSalarie, settings);
    }

    // Calculate deductions total
    const deductions = new Decimal(Number(absencesDeduction) + Number(advancesDeduction) + Number(cnpsSalarie) + Number(igr));

    // Calculate net payable
    const netPayable = new Decimal(Number(totalBrut) - Number(deductions));

    // Create or update payroll
    let payroll = existing;
    
    if (existing) {
      payroll = await prisma.monthly_payrolls.update({
        where: { id: existing.id },
        data: {
          base_salary: baseSalary,
          total_allowances: totalAllowances,
          seniority_bonus: seniorityBonus,
          total_brut: totalBrut,
          deductions,
          net_payable: netPayable,
          hours_worked: hoursWorked,
          absences_deduction: absencesDeduction,
          advances_deduction: advancesDeduction,
          prorata_amount: prorataAmount,
          prorata_days: daysWorked,
          prorata_total_days: totalDays,
          cnps_salarie: cnpsSalarie,
          cnps_employeur: cnpsEmployeur,
          igr,
          status: 'DRAFT',
        } as any,
      });
    } else {
      payroll = await prisma.monthly_payrolls.create({
        data: {
          teacher_id: teacherId,
          month,
          year,
          base_salary: baseSalary,
          total_allowances: totalAllowances,
          seniority_bonus: seniorityBonus,
          total_brut: totalBrut,
          deductions,
          net_payable: netPayable,
          hours_worked: hoursWorked,
          absences_deduction: absencesDeduction,
          advances_deduction: advancesDeduction,
          prorata_amount: prorataAmount,
          prorata_days: daysWorked,
          prorata_total_days: totalDays,
          cnps_salarie: cnpsSalarie,
          cnps_employeur: cnpsEmployeur,
          igr,
          status: 'DRAFT',
          created_by: createdBy,
        } as any,
      });
    }

    // Delete existing items
    await prisma.payroll_items.deleteMany({
      where: { payroll_id: payroll.id },
    });

    // Create payroll items
    const allItems = [
      {
        payroll_id: payroll.id,
        item_type: 'BASE',
        item_label: daysWorked > 0 && totalDays > 0 && daysWorked < totalDays
          ? `Salaire de base (prorata: ${daysWorked}/${totalDays} jours)`
          : 'Salaire de base',
        amount: prorataAmount,
        is_taxable: true,
      },
      ...allowanceItems.map(item => ({
        payroll_id: payroll.id,
        ...item,
      })),
      ...seniorityItems.map(item => ({
        payroll_id: payroll.id,
        ...item,
      })),
      ...deductionItems.map(item => ({
        payroll_id: payroll.id,
        ...item,
      })),
    ];

    // Add CNPS and IGR as deduction items if applicable
    if (cnpsSalarie.gt(0)) {
      allItems.push({
        payroll_id: payroll.id,
        item_type: 'DEDUCTION',
        item_label: 'CNPS (salarié)',
        amount: cnpsSalarie,
        is_taxable: false,
      });
    }

    if (igr.gt(0)) {
      allItems.push({
        payroll_id: payroll.id,
        item_type: 'DEDUCTION',
        item_label: 'IGR',
        amount: igr,
        is_taxable: false,
      });
    }

    await prisma.payroll_items.createMany({
      data: allItems,
    });

    // Mark advances as deducted
    if (advancesDeduction.gt(0)) {
      await prisma.advance_payments.updateMany({
        where: {
          teacher_id: teacherId,
          deducted: false,
        },
        data: {
          deducted: true,
          deducted_in_payroll_id: payroll.id,
        },
      });
    }

    return this.getPayrollById(payroll.id);
  }

  /**
   * Generate payrolls for multiple teachers
   */
  static async generatePayrolls(data: z.infer<typeof generatePayrollSchema>, createdBy?: string) {
    const { month, year, teacherIds, contractTypes } = generatePayrollSchema.parse(data);

    // Build where clause
    const where: any = {};
    if (teacherIds && teacherIds.length > 0) {
      where.id = { in: teacherIds };
    }
    if (contractTypes && contractTypes.length > 0) {
      where.contract_type = { in: contractTypes };
    }

    const teachers = await prisma.teachers.findMany({ where });

    const results = [];
    const errors = [];

    for (const teacher of teachers) {
      try {
        const payroll = await this.generatePayrollForTeacher(teacher.id, month, year, createdBy);
        results.push(payroll);
      } catch (error: any) {
        errors.push({
          teacherId: teacher.id,
          teacherName: `${teacher.first_name} ${teacher.last_name}`,
          error: error.message,
        });
      }
    }

    return { results, errors };
  }

  /**
   * Get payroll by ID
   */
  static async getPayrollById(payrollId: string) {
    const payroll = await prisma.monthly_payrolls.findUnique({
      where: { id: payrollId },
      include: {
        teacher: {
          include: {
            remuneration: true,
          },
        },
        items: {
          orderBy: { created_at: 'asc' },
        },
        payments: {
          orderBy: { payment_date: 'desc' },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return payroll;
  }

  /**
   * Get payrolls with filters
   */
  static async getPayrolls(filters: {
    month?: number;
    year?: number;
    teacherId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const {
      month,
      year,
      teacherId,
      status,
      page = 1,
      limit = 50,
    } = filters;

    const where: any = {};

    if (month) where.month = month;
    if (year) where.year = year;
    if (teacherId) where.teacher_id = teacherId;
    if (status) where.status = status;

    const [payrolls, total] = await Promise.all([
      prisma.monthly_payrolls.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              contract_type: true,
            },
          },
        },
        orderBy: [
          { year: 'desc' },
          { month: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.monthly_payrolls.count({ where }),
    ]);

    return {
      payrolls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Validate a payroll
   */
  static async validatePayroll(payrollId: string, validatedBy: string) {
    const validated = validatePayrollSchema.parse({ payrollId });

    const payroll = await prisma.monthly_payrolls.update({
      where: { id: validated.payrollId },
      data: {
        status: 'VALIDATED',
        validated_by: validatedBy,
        validated_at: new Date(),
      },
    });

    return payroll;
  }

  /**
   * Record a payment
   */
  static async recordPayment(data: z.infer<typeof recordPaymentSchema>, createdBy?: string) {
    const validated = recordPaymentSchema.parse(data);

    const payment = await prisma.payroll_payments.create({
      data: {
        payroll_id: validated.payrollId,
        amount: new Decimal(validated.amount),
        payment_date: validated.paymentDate,
        payment_method: validated.paymentMethod,
        reference: validated.reference,
        notes: validated.notes,
        created_by: createdBy,
      },
    });

    // Update payroll status if fully paid
    const payroll = await prisma.monthly_payrolls.findUnique({
      where: { id: validated.payrollId },
      include: {
        payments: true,
      },
    });

    if (payroll) {
      const totalPaid = payroll.payments.reduce((sum, p) => sum + Number(p.amount), 0) + validated.amount;
      if (totalPaid >= Number(payroll.net_payable)) {
        await prisma.monthly_payrolls.update({
          where: { id: validated.payrollId },
          data: { status: 'PAID' },
        });
      }
    }

    return payment;
  }

  /**
   * Create an advance payment
   */
  static async createAdvance(data: z.infer<typeof createAdvanceSchema>, createdBy?: string) {
    const validated = createAdvanceSchema.parse(data);

    const advance = await prisma.advance_payments.create({
      data: {
        teacher_id: validated.teacherId,
        amount: new Decimal(validated.amount),
        payment_date: validated.paymentDate,
        payment_method: validated.paymentMethod,
        reference: validated.reference,
        notes: validated.notes,
        created_by: createdBy,
      },
    });

    return advance;
  }

  /**
   * Get advances for a teacher
   */
  static async getAdvances(teacherId: string, deducted?: boolean) {
    const where: any = { teacher_id: teacherId };
    if (deducted !== undefined) {
      where.deducted = deducted;
    }

    const advances = await prisma.advance_payments.findMany({
      where,
      orderBy: { payment_date: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return advances;
  }
}

