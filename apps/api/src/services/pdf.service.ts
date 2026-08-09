import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import { prisma } from '@school/database';
import { ConductService } from './conduct.service';

const execAsync = promisify(exec);

/**
 * Identifiant de la pseudo-matière « CONDUITE ». Elle n'a pas de ligne dans
 * `subjects` : la note est calculée en direct par ConductService à partir des
 * appels et des corrections d'heures (plus d'étape de validation). Doit rester
 * aligné avec `CONDUCT_COL` côté web (CompleteAveragesPage).
 */
const CONDUCT_SUBJECT_ID = '__conduct__';

/**
 * Charge la conduite d'une classe pour un trimestre, sous une forme directement
 * injectable dans les tableaux de moyennes (pseudo-`class_subjects`). La note est
 * recalculée à la lecture : le bulletin reflète toujours les derniers appels.
 */
async function loadConduct(classId: string, semesterId: string, academicYearId: string) {
  const [rows, settings] = await Promise.all([
    ConductService.getStored({ academicYearId, semesterId, classId }),
    ConductService.getSettings(academicYearId),
  ]);
  const byStudent = new Map(rows.map((r) => [r.studentId, r]));
  const column = byStudent.size
    ? { subjects: { id: CONDUCT_SUBJECT_ID, name: 'CONDUITE', code: 'COND' }, coefficient: settings.coefficient }
    : null;
  return { byStudent, column, settings };
}

/**
 * Moyenne générale de CHAQUE élève de la classe pour un trimestre donné.
 *
 * ⚠️ Reproduit exactement la formule du bulletin : moyenne par matière **arrondie
 * à 2 décimales** (comme à l'affichage), puis pondérée par le coefficient de la
 * matière ; la conduite compte comme une matière supplémentaire. Cet arrondi
 * intermédiaire n'est pas cosmétique : sans lui, la « Moyenne du 3è Trimestre »
 * du bilan de fin d'année ne tomberait pas au centime sur la « Moyenne
 * Trimestrielle » imprimée plus haut sur la même page.
 *
 * Une seule requête `grades` pour toute la classe (et non une par élève) : le
 * bilan annuel appelle cette fonction pour chacun des trimestres.
 */
async function computeClassGeneralAverages(
  classId: string,
  semesterId: string,
  academicYearId: string,
): Promise<Map<string, number>> {
  const [classSubjects, conduct, grades, students] = await Promise.all([
    prisma.class_subjects.findMany({
      where: { class_id: classId },
      select: { coefficient: true, subjects: { select: { id: true } } },
    }),
    loadConduct(classId, semesterId, academicYearId),
    prisma.grades.findMany({
      where: { class_id: classId, semester_id: semesterId, academic_year_id: academicYearId },
      select: {
        student_id: true,
        subject_id: true,
        note: true,
        max_note: true,
        evaluationType: { select: { coefficient: true } },
      },
    }),
    prisma.student.findMany({ where: { classId }, select: { id: true } }),
  ]);

  const coeffBySubject = new Map<string, number>(
    classSubjects.map((cs: any) => [cs.subjects.id, Number(cs.coefficient) || 1]),
  );

  // élève → matière → cumul (note pondérée, poids)
  const perStudent = new Map<string, Map<string, { weighted: number; weight: number }>>();
  for (const g of grades) {
    // Une note sur une matière hors maquette de la classe ne compte pas.
    if (!coeffBySubject.has(g.subject_id)) continue;
    let bySubject = perStudent.get(g.student_id);
    if (!bySubject) {
      bySubject = new Map();
      perStudent.set(g.student_id, bySubject);
    }
    const acc = bySubject.get(g.subject_id) ?? { weighted: 0, weight: 0 };
    const { weighted, weight } = gradeAverageParts(Number(g.note), g.max_note, g.evaluationType?.coefficient);
    acc.weighted += weighted;
    acc.weight += weight;
    bySubject.set(g.subject_id, acc);
  }

  const averages = new Map<string, number>();
  for (const student of students) {
    let totalWeighted = 0;
    let totalCoefficients = 0;

    const bySubject = perStudent.get(student.id);
    if (bySubject) {
      for (const [subjectId, acc] of bySubject) {
        if (acc.weight <= 0) continue;
        const subjectAverage = Math.round((acc.weighted / acc.weight) * 100) / 100;
        if (subjectAverage <= 0) continue;
        const coefficient = coeffBySubject.get(subjectId) ?? 1;
        totalWeighted += subjectAverage * coefficient;
        totalCoefficients += coefficient;
      }
    }

    const cg = conduct.column ? conduct.byStudent.get(student.id) : null;
    if (cg) {
      const note = Math.round(Number(cg.finalNote) * 100) / 100;
      if (note > 0) {
        totalWeighted += note * conduct.column!.coefficient;
        totalCoefficients += conduct.column!.coefficient;
      }
    }

    averages.set(student.id, totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0);
  }

  return averages;
}

/**
 * Contribution d'une note à la moyenne d'une matière.
 * La note est ramenée sur /20 (quel que soit le barème), puis pondérée par le
 * coefficient du type d'évaluation (1 par défaut, 2 si la note est coefficientée).
 * ⚠️ Formule IDENTIQUE à la grille de saisie (GradesPage) — garder les deux alignées.
 */
function gradeAverageParts(
  note: number,
  maxNote: number | null | undefined,
  coefficient: number | null | undefined,
): { weighted: number; weight: number } {
  const mn = maxNote && maxNote > 0 ? maxNote : 20;
  const normalized = (note / mn) * 20;
  const weight = coefficient && coefficient > 0 ? coefficient : 1;
  return { weighted: normalized * weight, weight };
}

export class PDFService {
  private static uploadsDir = path.join(process.cwd(), 'uploads', 'salary-slips');
  private static receiptsDir = path.join(process.cwd(), 'uploads', 'payment-receipts');
  private static payrollSlipsDir = path.join(process.cwd(), 'uploads', 'payroll-slips');
  private static payrollPaymentReceiptsDir = path.join(process.cwd(), 'uploads', 'payroll-payment-receipts');
  private static completeAveragesDir = path.join(process.cwd(), 'uploads', 'complete-averages');
  private static libreOfficePath: string | null = null;

  static async ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.receiptsDir)) {
      fs.mkdirSync(this.receiptsDir, { recursive: true });
    }
    if (!fs.existsSync(this.payrollSlipsDir)) {
      fs.mkdirSync(this.payrollSlipsDir, { recursive: true });
    }
    if (!fs.existsSync(this.payrollPaymentReceiptsDir)) {
      fs.mkdirSync(this.payrollPaymentReceiptsDir, { recursive: true });
    }
    if (!fs.existsSync(this.completeAveragesDir)) {
      fs.mkdirSync(this.completeAveragesDir, { recursive: true });
    }
  }

  /**
   * Detect LibreOffice installation path
   */
  private static async detectLibreOffice(): Promise<string | null> {
    // Check if already detected
    if (this.libreOfficePath && fs.existsSync(this.libreOfficePath)) {
      return this.libreOfficePath;
    }

    // Check environment variable first
    const envPath = process.env.LIBREOFFICE_PATH;
    if (envPath && fs.existsSync(envPath)) {
      this.libreOfficePath = envPath;
      return envPath;
    }

    // Common Windows paths
    const commonPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      path.join(process.env.PROGRAMFILES || '', 'LibreOffice', 'program', 'soffice.exe'),
      path.join(process.env['ProgramFiles(x86)'] || '', 'LibreOffice', 'program', 'soffice.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
    ];

    // Check common paths
    for (const possiblePath of commonPaths) {
      if (possiblePath && fs.existsSync(possiblePath)) {
        this.libreOfficePath = possiblePath;
        return possiblePath;
      }
    }

    // Check if soffice is in PATH
    try {
      const { stdout } = await execAsync('soffice --version');
      if (stdout) {
        this.libreOfficePath = 'soffice';
        return 'soffice';
      }
    } catch (error) {
      // soffice not in PATH
    }

    return null;
  }

  /**
   * Convert Word document to PDF using LibreOffice (preserves formatting perfectly)
   */
  private static async convertWordToPDFWithLibreOffice(
    wordPath: string,
    pdfPath: string
  ): Promise<boolean> {
    try {
      const libreOfficePath = await this.detectLibreOffice();
      if (!libreOfficePath) {
        return false;
      }

      // Get output directory
      const outputDir = path.dirname(pdfPath);
      
      // LibreOffice command to convert Word to PDF
      // --headless: run without GUI
      // --convert-to pdf: convert to PDF format
      // --outdir: output directory
      // Note: LibreOffice outputs with the same name but .pdf extension
      let command: string;
      
      if (process.platform === 'win32') {
        // Windows: use proper quoting
        const escapedLibreOfficePath = libreOfficePath.includes(' ') ? `"${libreOfficePath}"` : libreOfficePath;
        const escapedOutputDir = outputDir.includes(' ') ? `"${outputDir}"` : outputDir;
        const escapedWordPath = wordPath.includes(' ') ? `"${wordPath}"` : wordPath;
        
        command = `${escapedLibreOfficePath} --headless --convert-to pdf --outdir ${escapedOutputDir} ${escapedWordPath}`;
      } else {
        // Linux/Mac: use proper escaping
        const escapedOutputDir = outputDir.replace(/(\s)/g, '\\$1');
        const escapedWordPath = wordPath.replace(/(\s)/g, '\\$1');
        
        command = `${libreOfficePath} --headless --convert-to pdf --outdir "${escapedOutputDir}" "${escapedWordPath}"`;
      }

      console.log(`Converting Word to PDF with LibreOffice...`);
      console.log(`Command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 seconds timeout
        shell: process.platform === 'win32' ? 'cmd.exe' : undefined,
      });

      if (stderr && !stderr.includes('INFO') && !stderr.includes('WARN')) {
        console.warn('LibreOffice stderr:', stderr);
      }

      // LibreOffice outputs the file with the same name but .pdf extension
      const expectedPdfPath = path.join(
        outputDir,
        path.basename(wordPath, '.docx') + '.pdf'
      );

      // If the output filename doesn't match, rename it
      if (fs.existsSync(expectedPdfPath) && expectedPdfPath !== pdfPath) {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
        fs.renameSync(expectedPdfPath, pdfPath);
      }

      // Wait a bit for file system to sync (especially on Windows)
      await new Promise(resolve => setTimeout(resolve, 500));

      if (fs.existsSync(pdfPath)) {
        console.log('✓ PDF generated successfully with LibreOffice');
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Error converting with LibreOffice:', error.message);
      if (error.stdout) console.log('LibreOffice stdout:', error.stdout);
      if (error.stderr) console.log('LibreOffice stderr:', error.stderr);
      return false;
    }
  }

  static async generateSalarySlip(salaryId: string): Promise<string> {
    await this.ensureUploadsDir();

    // Get salary data with staff information
    const salary = await prisma.monthly_payrolls.findUnique({
      where: { id: salaryId },
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    if (!salary) {
      throw new Error('Salary record not found');
    }

    // Generate HTML content for the salary slip
    const htmlContent = this.generateSalarySlipHTML(salary);
    
    // For now, we'll create a simple HTML file
    // In production, you would use libraries like Puppeteer, PDFKit, or jsPDF
    const fileName = `salary-slip-${salary.teacher?.first_name || 'unknown'}-${salary.teacher?.last_name || 'unknown'}-${salary.year}-${String(salary.month).padStart(2, '0')}.html`;
    const filePath = path.join(this.uploadsDir, fileName);
    
    fs.writeFileSync(filePath, htmlContent);

    // Update the salary record with the PDF URL
    // Note: pdfUrl field does not exist in monthly_payrolls schema
    await prisma.monthly_payrolls.update({
      where: { id: salaryId },
      data: { 
        // pdfUrl: `/uploads/salary-slips/${fileName}`, // Field does not exist
        status: 'PAID' // Using PAID instead of APPROVED
      }
    });

    return `/uploads/salary-slips/${fileName}`;
  }

  private static generateSalarySlipHTML(salary: any): string {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const monthName = monthNames[salary.month - 1];

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bulletin de Paie - ${salary.staff.firstName} ${salary.staff.lastName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .salary-slip {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #228B22;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .school-name {
            font-size: 24px;
            font-weight: bold;
            color: #228B22;
            margin-bottom: 5px;
        }
        .school-address {
            color: #666;
            font-size: 14px;
        }
        .document-title {
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
            color: #333;
        }
        .employee-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: bold;
            color: #333;
        }
        .salary-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .salary-table th,
        .salary-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .salary-table th {
            background-color: #228B22;
            color: white;
            font-weight: bold;
        }
        .salary-table .amount {
            text-align: right;
            font-weight: bold;
        }
        .total-row {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .net-salary {
            background-color: #228B22;
            color: white;
            font-size: 18px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        .signature-box {
            width: 200px;
            text-align: center;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            margin-bottom: 5px;
            height: 40px;
        }
    </style>
</head>
<body>
    <div class="salary-slip">
        <div class="header">
            <div class="school-name">ÉCOLE LE SOUVERAIN</div>
            <div class="school-address">Yaoundé, Cameroun | Tél: +237 XXX XX XX XX</div>
        </div>

        <div class="document-title">BULLETIN DE PAIE - ${monthName} ${salary.year}</div>

        <div class="employee-info">
            <div class="info-row">
                <span class="info-label">Nom complet:</span>
                <span>${salary.staff.firstName} ${salary.staff.lastName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Fonction:</span>
                <span>${salary.staff.function}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Période:</span>
                <span>${monthName} ${salary.year}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Date d'émission:</span>
                <span>${currentDate}</span>
            </div>
        </div>

        <table class="salary-table">
            <thead>
                <tr>
                    <th>DÉSIGNATION</th>
                    <th class="amount">MONTANT (XAF)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Salaire de base</td>
                    <td class="amount">${salary.baseSalary.toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                    <td>Indemnités</td>
                    <td class="amount">${salary.allowances.toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                    <td>Heures supplémentaires (${salary.overtimeHours}h)</td>
                    <td class="amount">${(salary.overtimeHours * salary.overtimeRate).toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                    <td>Primes et bonus</td>
                    <td class="amount">${salary.bonuses.toLocaleString('fr-FR')}</td>
                </tr>
                <tr class="total-row">
                    <td><strong>SALAIRE BRUT</strong></td>
                    <td class="amount"><strong>${salary.grossSalary.toLocaleString('fr-FR')}</strong></td>
                </tr>
                <tr>
                    <td>Déductions diverses</td>
                    <td class="amount">-${salary.deductions.toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                    <td>CNPS (8%)</td>
                    <td class="amount">-${salary.cnpsEmployee.toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                    <td>Impôt sur le revenu</td>
                    <td class="amount">-${salary.incomeTax.toLocaleString('fr-FR')}</td>
                </tr>
                <tr class="net-salary">
                    <td><strong>SALAIRE NET À PAYER</strong></td>
                    <td class="amount"><strong>${salary.netSalary.toLocaleString('fr-FR')}</strong></td>
                </tr>
            </tbody>
        </table>

        ${salary.notes ? `
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
            <strong>Notes:</strong><br>
            ${salary.notes}
        </div>
        ` : ''}

        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Signature de l'employé</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div>Signature de la direction</div>
            </div>
        </div>

        <div class="footer">
            <p>Ce document est généré automatiquement le ${currentDate}</p>
            <p>École Le Souverain - Système de Gestion Scolaire</p>
        </div>
    </div>
</body>
</html>`;
  }

  static async getSalarySlipUrl(salaryId: string): Promise<string | null> {
    // const salary = await prisma.monthly_payrolls.findUnique({
    //   where: { id: salaryId },
    //   select: { pdfUrl: true } // Field does not exist in schema
    // });

    // return salary?.pdfUrl || null;
    return null; // pdfUrl field does not exist in monthly_payrolls schema
  }

  static async deleteSalarySlip(salaryId: string): Promise<void> {
    // pdfUrl field does not exist in monthly_payrolls schema
    // const salary = await prisma.monthly_payrolls.findUnique({
    //   where: { id: salaryId },
    //   select: { pdfUrl: true }
    // });

    // if (salary?.pdfUrl) {
    //   const filePath = path.join(process.cwd(), salary.pdfUrl);
    //   if (fs.existsSync(filePath)) {
    //     fs.unlinkSync(filePath);
    //   }
    // }

    // await prisma.monthly_payrolls.update({
    //   where: { id: salaryId },
    //   data: { pdfUrl: null }
    // });
  }

  /**
   * Generate payment receipt PDF directly using PDFKit (no LibreOffice required)
   */
  static async generatePaymentReceipt(paymentId: string): Promise<string> {
    await this.ensureUploadsDir();

    // Get payment data with all relations
    const payment = await prisma.student_payments.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            studentParents: {
              include: {
                parents: {
                  select: {
                    phone: true,
                  },
                },
              },
            },
          },
        },
        academicYear: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true,
          },
        },
        school_fee_rate_details: {
          include: {
            payment_types: {
              select: {
                id: true,
                name: true,
              },
            },
            school_fee_rates: {
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        recordedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Check if student has a custom payment plan
    const customPaymentPlan = await prisma.custom_payment_plans.findUnique({
      where: {
        student_id_academic_year_id: {
          student_id: payment.student_id,
          academic_year_id: payment.academic_year_id,
        },
      },
      select: {
        total_amount: true,
        is_active: true,
      },
    });

    let totalExpectedAmount = 0;

    if (customPaymentPlan && customPaymentPlan.is_active) {
      // Use custom payment plan total
      totalExpectedAmount = Number(customPaymentPlan.total_amount) || 0;
    } else {
      // Get the school fee rate for the student's class to calculate total expected
      const schoolFeeRate = await prisma.school_fee_rates.findFirst({
        where: {
          class_id: payment.student.classId || '',
        },
        include: {
          school_fee_rate_details: {
            select: {
              amount: true,
            },
          },
        },
      });

      // Calculate total expected amount for the academic year (sum of all payment types)
      totalExpectedAmount = schoolFeeRate?.school_fee_rate_details.reduce(
        (sum, detail) => sum + Number(detail.amount),
        0
      ) || 0;
    }

    // Get payment date - use the actual payment date, not current date
    const paymentDate = new Date(payment.payment_date);
    const paymentCreatedAt = payment.created_at || new Date();
    
    // Get all payments for this student in this academic year UP TO AND INCLUDING the current payment
    // We need to include payments that were made before or at the same time as this payment
    // This ensures each receipt shows the correct cumulative amount at the time of that specific payment
    // Strategy: Include payments with earlier dates OR same date but earlier/equal created_at
    const allPaymentsUpToDate = await prisma.student_payments.findMany({
      where: {
        student_id: payment.student_id,
        academic_year_id: payment.academic_year_id,
        OR: [
          {
            // Payments with strictly earlier dates (always included)
            payment_date: {
              lt: paymentDate,
            },
          },
          {
            // Payments on the same date, but only if created at or before this payment
            AND: [
              {
                payment_date: paymentDate,
              },
              {
                created_at: {
                  lte: paymentCreatedAt,
                },
              },
            ],
          },
        ],
      },
      select: {
        amount: true,
        payment_date: true,
        id: true,
        created_at: true,
      },
      orderBy: [
        {
          payment_date: 'asc',
        },
        {
          created_at: 'asc',
        },
      ],
    });

    // Check if current payment is included in the results
    const currentPaymentIncluded = allPaymentsUpToDate.some(p => p.id === paymentId);
    
    // Calculate total paid amount up to and including this payment
    let totalPaidAmount = allPaymentsUpToDate.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    
    // If current payment is not included (edge case), add it
    if (!currentPaymentIncluded) {
      totalPaidAmount += Number(payment.amount);
    }

    // Calculate remaining amount (total expected - total paid)
    const remainingAmount = Math.max(0, totalExpectedAmount - totalPaidAmount);
    
    // Current payment amount (this specific payment)
    const paidAmount = Number(payment.amount);
    
    // Log for debugging
    console.log(`[Receipt Generation] Payment ID: ${paymentId}`);
    console.log(`[Receipt Generation] Payment Date: ${paymentDate.toISOString()}`);
    console.log(`[Receipt Generation] Payment Created At: ${paymentCreatedAt.toISOString()}`);
    console.log(`[Receipt Generation] Payments found up to date: ${allPaymentsUpToDate.length}`);
    console.log(`[Receipt Generation] Current payment amount: ${paidAmount}`);
    console.log(`[Receipt Generation] Total paid amount (cumulative): ${totalPaidAmount}`);
    console.log(`[Receipt Generation] Remaining amount: ${remainingAmount}`);

    // Generate filename - Word document, not PDF
    // Use payment ID in filename to ensure uniqueness for each payment
    // This prevents different payments from overwriting each other's receipts
    const receiptNumber = payment.receipt_number || `REC-${paymentId.substring(0, 8)}`;
    const fileName = `receipt-${paymentId}-${receiptNumber.replace(/[^a-zA-Z0-9]/g, '-')}.docx`;
    const filePath = path.join(this.receiptsDir, fileName);
    
    // Delete existing file if it exists to ensure fresh generation
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Receipt Generation] Deleted existing file: ${filePath}`);
    }

    // Helper function to format currency with spaces (20 000 instead of 20000)
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    // Use the payment date, not the current date
    const datePaiement = paymentDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    
    // For the time, use the payment's created_at time if available, otherwise use a default time
    // Since payment_date is a DATE field (not datetime), we use created_at for the time
    const paymentDateTime = payment.created_at || paymentDate;
    const heurePaiement = paymentDateTime.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).replace(':', 'H');

    // Get parent contact
    const parentContacts = payment.student.studentParents
      .map(sp => sp.parents.phone)
      .filter(phone => phone)
      .join('/') || 'N/A';

    // School phone (default)
    const telephoneEcole = '0101540599';

    // Use Word template and convert to PDF (preserving exact format)
    console.log('Generating PDF receipt from Word template...');
    
    // Prepare template data - using % delimiters as in the template
    const templateData = {
      numero_recu: String(receiptNumber || 'N/A'),
      date_paiement: String(datePaiement || 'N/A'),
      heure_paiement: String(heurePaiement || 'N/A'),
      annee_academique: String(payment.academicYear?.name || 'N/A'),
      matricule: String(payment.student?.studentNumber || 'N/A'),
      nom_eleve: String(payment.student?.lastName || 'N/A'),
      prenom_eleve: String(payment.student?.firstName || 'N/A'),
      sexe: String(payment.student?.gender === 'M' || payment.student?.gender === 'Masculin' ? 'M' : 'F'),
      classe: String(payment.student?.class?.name || 'N/A'),
      telephone_ecole: String(telephoneEcole || 'N/A'),
      contact_parent: String(parentContacts || 'N/A'),
      montant_verse: String(`${formatCurrency(paidAmount)} F CFA`),
      scolarite_base: String(`${formatCurrency(totalExpectedAmount)} F CFA`),
      scolarite_payee: String(`${formatCurrency(totalPaidAmount)} F CFA`),
      reste_a_payer: String(`${formatCurrency(remainingAmount)} F CFA`),
    };
    
    // Load Word template
    const possiblePaths = [
      path.join(process.cwd(), 'apps', 'api', 'templates', 'payment-receipt', 'receipt-template.docx'),
      path.join(process.cwd(), 'templates', 'payment-receipt', 'receipt-template.docx'),
      path.resolve(__dirname, '..', 'templates', 'payment-receipt', 'receipt-template.docx'),
      path.resolve(__dirname, '..', '..', 'templates', 'payment-receipt', 'receipt-template.docx'),
    ];
    
    let templatePath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        templatePath = possiblePath;
        console.log(`✓ Template found at: ${templatePath}`);
        break;
      }
    }
    
    if (!templatePath) {
      const errorMessage = `Template file not found. Please ensure receipt-template.docx exists in one of these locations:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Read template file
    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);
    
    // Create docxtemplater instance with % delimiters (as in the template)
    let doc: Docxtemplater;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '%',
          end: '%'
        }
      });
    } catch (error: any) {
      console.error('Error creating Docxtemplater instance:', error);
      if (error.properties && error.properties.errors) {
        const errors = error.properties.errors.map((e: any) => 
          `- ${e.name}: ${e.message} (at ${e.properties?.tag || 'unknown'})`
        ).join('\n');
        throw new Error(`Template compilation error:\n${errors}`);
      }
      throw new Error(`Template compilation error: ${error.message}`);
    }

    // Replace placeholders
    try {
      doc.render(templateData);
    } catch (error: any) {
      console.error('Error rendering template:', error);
      if (error.properties && error.properties.errors) {
        const errors = error.properties.errors.map((e: any) => 
          `- ${e.name}: ${e.message} (at ${e.properties?.tag || 'unknown'})`
        ).join('\n');
        throw new Error(`Template rendering error:\n${errors}`);
      }
      throw new Error(`Template rendering error: ${error.message}`);
    }

    // Generate filled Word document - save directly as final file
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Word receipt document generated successfully: ${filePath}`);


    return `/uploads/payment-receipts/${fileName}`;
  }

  /**
   * Generate payment receipt as PDF (converts Word to PDF)
   * This preserves the exact formatting from the Word template
   */
  static async generatePaymentReceiptPDF(paymentId: string): Promise<string> {
    // First generate the Word document
    const wordDocUrl = await this.generatePaymentReceipt(paymentId);
    const wordFilePath = path.join(process.cwd(), wordDocUrl);
    
    if (!fs.existsSync(wordFilePath)) {
      throw new Error('Word document not found after generation');
    }

    // Generate PDF filename - extract from Word filename which now includes payment ID
    // Format: receipt-{paymentId}-{receiptNumber}.docx
    const wordFileName = path.basename(wordDocUrl);
    const pdfFileName = wordFileName.replace('.docx', '.pdf');
    const pdfFilePath = path.join(this.receiptsDir, pdfFileName);
    
    // Delete existing PDF file if it exists to ensure fresh generation
    if (fs.existsSync(pdfFilePath)) {
      fs.unlinkSync(pdfFilePath);
      console.log(`[Receipt PDF Generation] Deleted existing PDF file: ${pdfFilePath}`);
    }

    // Convert Word to PDF using LibreOffice
    const conversionSuccess = await this.convertWordToPDFWithLibreOffice(wordFilePath, pdfFilePath);

    if (!conversionSuccess) {
      throw new Error('Failed to convert Word document to PDF. LibreOffice may not be installed or configured correctly.');
    }

    console.log(`✅ PDF receipt generated successfully: ${pdfFilePath}`);
    return `/uploads/payment-receipts/${pdfFileName}`;
  }

  /**
   * Generate payroll slip PDF for a teacher
   */
  static async generatePayrollSlipPDF(payrollId: string): Promise<string> {
    await this.ensureUploadsDir();

    // Fetch payroll data with all related information
    const payroll = await prisma.monthly_payrolls.findUnique({
      where: { id: payrollId },
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            hire_date: true,
            contract_type: true,
          },
        },
        items: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!payroll) {
      throw new Error('Payroll record not found');
    }

    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const monthName = monthNames[payroll.month - 1];
    const fileName = `bulletin-paie-${payroll.teacher.first_name}-${payroll.teacher.last_name}-${monthName}-${payroll.year}.pdf`;
    const filePath = path.join(this.payrollSlipsDir, fileName);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    // Pipe to file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Helper function to format currency
    const formatCurrency = (amount: number | string | Decimal | null): string => {
      if (!amount) return '0';
      const num = typeof amount === 'string' ? parseFloat(amount) : typeof amount === 'object' ? amount.toNumber() : amount;
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num) + ' FCFA';
    };

    // Header
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('BULLETIN DE PAIE', { align: 'center' });

    doc.moveDown(0.5);

    // Establishment info (you can customize this)
    doc.fontSize(10)
       .font('Helvetica')
       .text('ÉCOLE LE SOUVERAIN', { align: 'center' })
       .text('Système de Gestion Scolaire', { align: 'center' });

    doc.moveDown(1);

    // Teacher information
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('INFORMATIONS ENSEIGNANT', { underline: true });

    doc.moveDown(0.3);
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Nom: ${payroll.teacher.first_name} ${payroll.teacher.last_name}`)
       .text(`Email: ${payroll.teacher.email || 'N/A'}`)
       .text(`Téléphone: ${payroll.teacher.phone || 'N/A'}`)
       .text(`Type de contrat: ${payroll.teacher.contract_type}`)
       .text(`Date d'embauche: ${new Date(payroll.teacher.hire_date).toLocaleDateString('fr-FR')}`);

    doc.moveDown(1);

    // Period
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('PÉRIODE', { underline: true });

    doc.moveDown(0.3);
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Mois: ${monthName} ${payroll.year}`)
       .text(`Statut: ${payroll.status === 'VALIDATED' ? 'Validé' : payroll.status === 'PAID' ? 'Payé' : 'Brouillon'}`);

    if (payroll.hours_worked) {
      doc.text(`Heures travaillées: ${payroll.hours_worked}h`);
    }

    doc.moveDown(1);

    // Earnings section
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('ÉLÉMENTS DE PERCEPTION', { underline: true });

    doc.moveDown(0.3);
    doc.fontSize(10)
       .font('Helvetica');

    const earningsY = doc.y;
    doc.text('Salaire de base:', 50, earningsY)
       .text(formatCurrency(payroll.base_salary), 200, earningsY, { align: 'right', width: 150 });

    let currentY = doc.y + 5;
    doc.text('Total primes et indemnités:', 50, currentY)
       .text(formatCurrency(payroll.total_allowances), 200, currentY, { align: 'right', width: 150 });

    currentY = doc.y + 5;
    doc.text("Prime d'ancienneté:", 50, currentY)
       .text(formatCurrency(payroll.seniority_bonus), 200, currentY, { align: 'right', width: 150 });

    currentY = doc.y + 10;
    doc.font('Helvetica-Bold')
       .text('TOTAL BRUT:', 50, currentY)
       .text(formatCurrency(payroll.total_brut), 200, currentY, { align: 'right', width: 150 });

    doc.moveDown(1);

    // Deductions section
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('DÉDUCTIONS', { underline: true });

    doc.moveDown(0.3);
    doc.fontSize(10)
       .font('Helvetica');

    const deductionsY = doc.y;
    if (Number(payroll.absences_deduction) > 0) {
      doc.text('Absences:', 50, deductionsY)
         .text(`-${formatCurrency(payroll.absences_deduction)}`, 200, deductionsY, { align: 'right', width: 150 });
      currentY = doc.y + 5;
    } else {
      currentY = deductionsY;
    }

    if (Number(payroll.advances_deduction) > 0) {
      doc.text('Acomptes:', 50, currentY)
         .text(`-${formatCurrency(payroll.advances_deduction)}`, 200, currentY, { align: 'right', width: 150 });
      currentY = doc.y + 5;
    }

    if (payroll.cnps_salarie && Number(payroll.cnps_salarie) > 0) {
      doc.text('CNPS (salarié):', 50, currentY)
         .text(`-${formatCurrency(payroll.cnps_salarie)}`, 200, currentY, { align: 'right', width: 150 });
      currentY = doc.y + 5;
    }

    if (payroll.igr && Number(payroll.igr) > 0) {
      doc.text('IGR:', 50, currentY)
         .text(`-${formatCurrency(payroll.igr)}`, 200, currentY, { align: 'right', width: 150 });
      currentY = doc.y + 5;
    }

    currentY = doc.y + 10;
    doc.font('Helvetica-Bold')
       .text('TOTAL DÉDUCTIONS:', 50, currentY)
       .text(`-${formatCurrency(payroll.deductions)}`, 200, currentY, { align: 'right', width: 150 });

    doc.moveDown(1.5);

    // Net payable
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#1890ff')
       .text('NET À PAYER:', 50, doc.y)
       .text(formatCurrency(payroll.net_payable), 200, doc.y, { align: 'right', width: 150 });

    doc.fillColor('black');

    // Employer contributions (if applicable)
    if (payroll.cnps_employeur && Number(payroll.cnps_employeur) > 0) {
      doc.moveDown(1);
      doc.fontSize(10)
         .font('Helvetica')
         .text('COTISATIONS EMPLOYEUR (à titre informatif):', { underline: true });
      doc.moveDown(0.3);
      doc.text(`CNPS employeur: ${formatCurrency(payroll.cnps_employeur)}`);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#666666')
       .text(`Bulletin généré le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' })
       .text(`Numéro de bulletin: ${payroll.id.substring(0, 8).toUpperCase()}`, { align: 'center' });

    // Finalize PDF
    doc.end();

    // Wait for the PDF to be written
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => {
        console.log(`✅ Payroll slip PDF generated: ${filePath}`);
        resolve();
      });
      stream.on('error', reject);
    });

    return `/uploads/payroll-slips/${fileName}`;
  }

  /**
   * Generate payroll payment receipt PDF directly from payroll (without payment record)
   */
  static async generatePayrollPaymentReceiptFromPayroll(payrollId: string, createdBy?: any): Promise<string> {
    await this.ensureUploadsDir();

    // Get payroll data with all relations
    const payroll = await prisma.monthly_payrolls.findUnique({
      where: { id: payrollId },
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            hire_date: true,
            contract_type: true,
          },
        },
        items: {
          orderBy: { created_at: 'asc' },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!payroll) {
      throw new Error('Payroll not found');
    }

    // Generate receipt number
    const receiptNumber = `REC-SAL-${payrollId.substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
    const fileName = `receipt-payroll-${receiptNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    const filePath = path.join(this.payrollPaymentReceiptsDir, fileName);

    // Check if receipt already exists
    if (fs.existsSync(filePath)) {
      console.log(`✅ Receipt already exists: ${filePath}`);
      return `/uploads/payroll-payment-receipts/${fileName}`;
    }

    // Helper function to format currency
    const formatCurrency = (amount: number | string | Decimal | null): string => {
      if (!amount) return '0';
      const num = typeof amount === 'string' ? parseFloat(amount) : typeof amount === 'object' ? amount.toNumber() : amount;
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    };

    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const monthName = monthNames[payroll.month - 1];
    const paymentDate = payroll.validated_at || new Date();
    const formattedPaymentDate = paymentDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const formattedPaymentTime = paymentDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Generate HTML template
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de Paiement de Salaire</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #333;
      padding: 8px;
      background: #fff;
      margin: 0;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #228B22;
      border-radius: 6px;
      padding: 12px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #228B22;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .header h1 {
      color: #228B22;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .header h2 {
      color: #666;
      font-size: 12px;
      font-weight: normal;
    }
    .school-info {
      text-align: center;
      margin-bottom: 8px;
      color: #666;
      font-size: 8px;
    }
    .receipt-number {
      text-align: right;
      margin-bottom: 8px;
      font-weight: bold;
      color: #228B22;
      font-size: 10px;
    }
    .section {
      margin-bottom: 10px;
    }
    .section-title {
      background: #228B22;
      color: #fff;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 6px;
      border-radius: 3px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 8px;
      margin-bottom: 2px;
    }
    .info-value {
      color: #333;
      font-size: 9px;
    }
    .amount-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
      font-size: 9px;
    }
    .amount-table th {
      background: #f5f5f5;
      padding: 5px 6px;
      text-align: left;
      font-weight: bold;
      font-size: 8px;
      border: 1px solid #ddd;
    }
    .amount-table td {
      padding: 5px 6px;
      border: 1px solid #ddd;
      font-size: 9px;
    }
    .amount-table .label {
      font-weight: 600;
      color: #333;
    }
    .amount-table .amount {
      text-align: right;
      font-weight: bold;
      color: #228B22;
    }
    .total-section {
      background: #f9f9f9;
      padding: 8px;
      border-radius: 4px;
      margin-top: 8px;
      border: 2px solid #228B22;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 11px;
    }
    .total-label {
      font-weight: bold;
      color: #333;
    }
    .total-amount {
      font-weight: bold;
      font-size: 14px;
      color: #228B22;
    }
    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 7px;
      color: #666;
    }
    .signature-section {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 25px;
      width: 120px;
      margin-left: auto;
      margin-right: auto;
    }
    .signature-label {
      margin-top: 2px;
      font-size: 8px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>REÇU DE PAIEMENT DE SALAIRE</h1>
      <h2>ÉCOLE LE SOUVERAIN</h2>
    </div>

    <div class="school-info">
      Système de Gestion Scolaire
    </div>

    <div class="receipt-number">
      N° Reçu: ${receiptNumber}
    </div>

    <div class="section">
      <div class="section-title">INFORMATIONS DE PAIEMENT</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Date de paiement</div>
          <div class="info-value">${formattedPaymentDate} à ${formattedPaymentTime}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Méthode de paiement</div>
          <div class="info-value">À définir</div>
        </div>
        <div class="info-item">
          <div class="info-label">Validé par</div>
          <div class="info-value">${payroll.validatedBy ? `${payroll.validatedBy.firstName} ${payroll.validatedBy.lastName}` : 'N/A'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">INFORMATIONS ENSEIGNANT</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Nom complet</div>
          <div class="info-value">${payroll.teacher.first_name} ${payroll.teacher.last_name}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Type de contrat</div>
          <div class="info-value">${payroll.teacher.contract_type}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Email</div>
          <div class="info-value">${payroll.teacher.email || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Téléphone</div>
          <div class="info-value">${payroll.teacher.phone || 'N/A'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">DÉTAILS DE LA PAIE</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Période</div>
          <div class="info-value">${monthName} ${payroll.year}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Statut de la paie</div>
          <div class="info-value">${payroll.status === 'VALIDATED' ? 'Validée' : payroll.status === 'PAID' ? 'Payée' : 'Brouillon'}</div>
        </div>
      </div>

      <table class="amount-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align: right;">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">Salaire de base</td>
            <td class="amount">${formatCurrency(payroll.base_salary)}</td>
          </tr>
          <tr>
            <td class="label">Primes et indemnités</td>
            <td class="amount">${formatCurrency(payroll.total_allowances)}</td>
          </tr>
          <tr>
            <td class="label">Prime d'ancienneté</td>
            <td class="amount">${formatCurrency(payroll.seniority_bonus)}</td>
          </tr>
          <tr>
            <td class="label">Total brut</td>
            <td class="amount">${formatCurrency(payroll.total_brut)}</td>
          </tr>
          <tr>
            <td class="label">Déductions (CNPS, IGR, etc.)</td>
            <td class="amount" style="color: #ff4d4f;">-${formatCurrency(payroll.deductions)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="total-section">
      <div class="total-row">
        <span class="total-label">Net à payer</span>
        <span class="total-amount">${formatCurrency(payroll.net_payable)} FCFA</span>
      </div>
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Signature Enseignant</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Signature Administrateur</div>
      </div>
    </div>

    <div class="footer">
      <p>Reçu généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} - Ce document est généré automatiquement et fait foi de paiement.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Generate PDF using Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      await browser.close();

      console.log(`✅ Payroll payment receipt PDF generated: ${filePath}`);
      return `/uploads/payroll-payment-receipts/${fileName}`;
    } catch (error: any) {
      if (browser) {
        await browser.close();
      }
      console.error('Error generating payroll payment receipt PDF:', error);
      throw new Error(`Failed to generate receipt PDF: ${error.message}`);
    }
  }

  /**
   * Generate payroll payment receipt PDF using HTML template and Puppeteer
   */
  static async generatePayrollPaymentReceipt(paymentId: string): Promise<string> {
    await this.ensureUploadsDir();

    // Get payment data with all relations
    const payment = await prisma.payroll_payments.findUnique({
      where: { id: paymentId },
      include: {
        monthly_payroll: {
          include: {
            teacher: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone: true,
                hire_date: true,
                contract_type: true,
              },
            },
            items: {
              orderBy: { created_at: 'asc' },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const payroll = payment.monthly_payroll;
    if (!payroll) {
      throw new Error('Payroll not found');
    }

    // Generate receipt number
    const receiptNumber = `REC-SAL-${paymentId.substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
    const fileName = `receipt-payroll-${receiptNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    const filePath = path.join(this.payrollPaymentReceiptsDir, fileName);

    // Check if receipt already exists
    if (fs.existsSync(filePath)) {
      console.log(`✅ Receipt already exists: ${filePath}`);
      return `/uploads/payroll-payment-receipts/${fileName}`;
    }

    // Helper function to format currency
    const formatCurrency = (amount: number | string | Decimal | null): string => {
      if (!amount) return '0';
      const num = typeof amount === 'string' ? parseFloat(amount) : typeof amount === 'object' ? amount.toNumber() : amount;
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    };

    // Format payment method
    const paymentMethodLabels: Record<string, string> = {
      CASH: 'Espèces',
      CHEQUE: 'Chèque',
      VIREMENT: 'Virement bancaire',
      MOBILE_MONEY: 'Mobile Money',
      CARTE: 'Carte bancaire',
    };

    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const monthName = monthNames[payroll.month - 1];
    const paymentDate = new Date(payment.payment_date);
    const formattedPaymentDate = paymentDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const formattedPaymentTime = paymentDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Generate HTML template
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de Paiement de Salaire</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #333;
      padding: 8px;
      background: #fff;
      margin: 0;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #228B22;
      border-radius: 6px;
      padding: 12px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #228B22;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .header h1 {
      color: #228B22;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .header h2 {
      color: #666;
      font-size: 12px;
      font-weight: normal;
    }
    .school-info {
      text-align: center;
      margin-bottom: 8px;
      color: #666;
      font-size: 8px;
    }
    .receipt-number {
      text-align: right;
      margin-bottom: 8px;
      font-weight: bold;
      color: #228B22;
      font-size: 10px;
    }
    .section {
      margin-bottom: 10px;
    }
    .section-title {
      background: #228B22;
      color: #fff;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 6px;
      border-radius: 3px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 8px;
      margin-bottom: 2px;
    }
    .info-value {
      color: #333;
      font-size: 9px;
    }
    .amount-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
      font-size: 9px;
    }
    .amount-table th {
      background: #f5f5f5;
      padding: 5px 6px;
      text-align: left;
      font-weight: bold;
      font-size: 8px;
      border: 1px solid #ddd;
    }
    .amount-table td {
      padding: 5px 6px;
      border: 1px solid #ddd;
      font-size: 9px;
    }
    .amount-table .label {
      font-weight: 600;
      color: #333;
    }
    .amount-table .amount {
      text-align: right;
      font-weight: bold;
      color: #228B22;
    }
    .total-section {
      background: #f9f9f9;
      padding: 8px;
      border-radius: 4px;
      margin-top: 8px;
      border: 2px solid #228B22;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 11px;
    }
    .total-label {
      font-weight: bold;
      color: #333;
    }
    .total-amount {
      font-weight: bold;
      font-size: 14px;
      color: #228B22;
    }
    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 7px;
      color: #666;
    }
    .signature-section {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 25px;
      width: 120px;
      margin-left: auto;
      margin-right: auto;
    }
    .signature-label {
      margin-top: 2px;
      font-size: 8px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>REÇU DE PAIEMENT DE SALAIRE</h1>
      <h2>ÉCOLE LE SOUVERAIN</h2>
    </div>

    <div class="school-info">
      Système de Gestion Scolaire
    </div>

    <div class="receipt-number">
      N° Reçu: ${receiptNumber}
    </div>

    <div class="section">
      <div class="section-title">INFORMATIONS DE PAIEMENT</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Date de paiement</div>
          <div class="info-value">${formattedPaymentDate} à ${formattedPaymentTime}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Méthode de paiement</div>
          <div class="info-value">${paymentMethodLabels[payment.payment_method] || payment.payment_method}</div>
        </div>
        ${payment.reference ? `
        <div class="info-item">
          <div class="info-label">Référence</div>
          <div class="info-value">${payment.reference}</div>
        </div>
        ` : ''}
        <div class="info-item">
          <div class="info-label">Enregistré par</div>
          <div class="info-value">${payment.createdBy ? `${payment.createdBy.firstName || ''} ${payment.createdBy.lastName || ''}` : 'N/A'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">INFORMATIONS ENSEIGNANT</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Nom complet</div>
          <div class="info-value">${payroll.teacher.first_name} ${payroll.teacher.last_name}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Type de contrat</div>
          <div class="info-value">${payroll.teacher.contract_type}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Email</div>
          <div class="info-value">${payroll.teacher.email || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Téléphone</div>
          <div class="info-value">${payroll.teacher.phone || 'N/A'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">DÉTAILS DE LA PAIE</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Période</div>
          <div class="info-value">${monthName} ${payroll.year}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Statut de la paie</div>
          <div class="info-value">${payroll.status === 'VALIDATED' ? 'Validée' : payroll.status === 'PAID' ? 'Payée' : 'Brouillon'}</div>
        </div>
      </div>

      <table class="amount-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align: right;">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">Salaire de base</td>
            <td class="amount">${formatCurrency(payroll.base_salary)}</td>
          </tr>
          <tr>
            <td class="label">Primes et indemnités</td>
            <td class="amount">${formatCurrency(payroll.total_allowances)}</td>
          </tr>
          <tr>
            <td class="label">Prime d'ancienneté</td>
            <td class="amount">${formatCurrency(payroll.seniority_bonus)}</td>
          </tr>
          <tr>
            <td class="label">Total brut</td>
            <td class="amount">${formatCurrency(payroll.total_brut)}</td>
          </tr>
          <tr>
            <td class="label">Déductions (CNPS, IGR, etc.)</td>
            <td class="amount" style="color: #ff4d4f;">-${formatCurrency(payroll.deductions)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="total-section">
      <div class="total-row">
        <span class="total-label">Montant payé</span>
        <span class="total-amount">${formatCurrency(payment.amount)} FCFA</span>
      </div>
      <div class="total-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #ddd;">
        <span class="total-label">Net à payer (total)</span>
        <span class="total-amount" style="font-size: 12px;">${formatCurrency(payroll.net_payable)} FCFA</span>
      </div>
    </div>

    ${payment.notes ? `
    <div class="section">
      <div class="section-title">NOTES</div>
      <div style="padding: 5px; background: #f9f9f9; border-radius: 3px; font-size: 8px;">
        ${payment.notes}
      </div>
    </div>
    ` : ''}

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Signature Enseignant</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Signature Administrateur</div>
      </div>
    </div>

    <div class="footer">
      <p>Reçu généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} - Ce document est généré automatiquement et fait foi de paiement.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Generate PDF using Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      await browser.close();

      console.log(`✅ Payroll payment receipt PDF generated: ${filePath}`);
      return `/uploads/payroll-payment-receipts/${fileName}`;
    } catch (error: any) {
      if (browser) {
        await browser.close();
      }
      console.error('Error generating payroll payment receipt PDF:', error);
      throw new Error(`Failed to generate receipt PDF: ${error.message}`);
    }
  }

  /**
   * Generate student payment receipt PDF directly using HTML template and Puppeteer
   * This is a simpler approach than using Word templates + LibreOffice
   */
  static async generateStudentPaymentReceiptPDFDirect(paymentId: string): Promise<string> {
    await this.ensureUploadsDir();

    // Get payment data with all relations
    const payment = await prisma.student_payments.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            studentParents: {
              include: {
                parents: {
                  select: {
                    phone: true,
                  },
                },
              },
            },
          },
        },
        academicYear: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true,
          },
        },
        school_fee_rate_details: {
          include: {
            payment_types: {
              select: {
                id: true,
                name: true,
              },
            },
            school_fee_rates: {
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        recordedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Get payment date - use the actual payment date, not current date
    const paymentDate = new Date(payment.payment_date);
    const paymentCreatedAt = payment.created_at || new Date();
    
    // Get all payments for this student in this academic year UP TO AND INCLUDING the current payment
    const allPaymentsUpToDate = await prisma.student_payments.findMany({
      where: {
        student_id: payment.student_id,
        academic_year_id: payment.academic_year_id,
        OR: [
          {
            payment_date: {
              lt: paymentDate,
            },
          },
          {
            AND: [
              {
                payment_date: paymentDate,
              },
              {
                created_at: {
                  lte: paymentCreatedAt,
                },
              },
            ],
          },
        ],
      },
      select: {
        amount: true,
        payment_date: true,
        id: true,
        created_at: true,
      },
      orderBy: [
        {
          payment_date: 'asc',
        },
        {
          created_at: 'asc',
        },
      ],
    });

    // Check if current payment is included in the results
    const currentPaymentIncluded = allPaymentsUpToDate.some(p => p.id === paymentId);
    
    // Calculate total paid amount up to and including this payment
    let totalPaidAmount = allPaymentsUpToDate.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    
    // If current payment is not included (edge case), add it
    if (!currentPaymentIncluded) {
      totalPaidAmount += Number(payment.amount);
    }

    // Use getStudentPaymentStatus to get payment status (same as frontend uses)
    // This ensures we use the same logic and data source
    let customPaymentPlan = null;
    let totalExpectedFromStatus = 0;
    let isCustomPlanFromStatus = false;
    let paymentStatus: any = null;
    
    try {
      const { StudentPaymentService } = await import('./studentPayment.service');
      paymentStatus = await StudentPaymentService.getStudentPaymentStatus(
        payment.student_id,
        payment.academic_year_id
      );
      
      console.log(`[Receipt Generation] Payment status from getStudentPaymentStatus:`, {
        hasCustomPlan: !!paymentStatus.customPaymentPlan,
        hasSummary: !!paymentStatus.summary,
        totalExpected: paymentStatus.summary?.totalExpected,
        totalPaid: paymentStatus.summary?.totalPaid,
        summaryKeys: paymentStatus.summary ? Object.keys(paymentStatus.summary) : 'no summary',
      });
      
      // Debug: Check if summary exists and has totalExpected
      if (paymentStatus.summary) {
        console.log(`[Receipt Generation] ✅ Summary exists, totalExpected: ${paymentStatus.summary.totalExpected}`);
      } else {
        console.log(`[Receipt Generation] ❌ Summary is missing!`);
      }
      
      // Always use totalExpected from getStudentPaymentStatus (it's the source of truth used by frontend)
      // Even if customPaymentPlan is null, the totalExpected might be calculated from installments
      totalExpectedFromStatus = Number(paymentStatus.summary?.totalExpected || 0);
      
      // If there's a custom payment plan in the status, use it
      if (paymentStatus.customPaymentPlan) {
        customPaymentPlan = paymentStatus.customPaymentPlan;
        isCustomPlanFromStatus = true;
        console.log(`[Receipt Generation] ✅ Found custom plan via getStudentPaymentStatus: ${customPaymentPlan.name}, Total: ${totalExpectedFromStatus}`);
      }
    } catch (error) {
      console.error(`[Receipt Generation] Error calling getStudentPaymentStatus:`, error);
    }

    let totalExpectedAmount = 0;
    let isCustomPlan = false;

    // ALWAYS use totalExpected from getStudentPaymentStatus FIRST (it's the source of truth used by frontend)
    // This ensures the receipt shows the same amount as the interface
    console.log(`[Receipt Generation] Checking paymentStatus:`, {
      hasPaymentStatus: !!paymentStatus,
      hasSummary: !!paymentStatus?.summary,
      totalExpected: paymentStatus?.summary?.totalExpected,
      totalExpectedType: typeof paymentStatus?.summary?.totalExpected,
      paymentStatusKeys: paymentStatus ? Object.keys(paymentStatus) : 'no paymentStatus',
    });
    
    // PRIORITY 1: Use totalExpected from getStudentPaymentStatus (same as frontend)
    // This is the source of truth - use it directly without complex conditions
    // totalExpectedFromStatus is already declared above, just use it
    if (totalExpectedFromStatus > 0) {
      totalExpectedAmount = Number(totalExpectedFromStatus);
      console.log(`[Receipt Generation] ✅ Using totalExpected from getStudentPaymentStatus: ${totalExpectedAmount}`);
      
      // Check if this differs from standard rate to determine if it's a custom plan
      const standardRate = await prisma.school_fee_rates.findFirst({
        where: {
          class_id: payment.student.classId || '',
        },
        include: {
          school_fee_rate_details: {
            select: {
              amount: true,
            },
          },
        },
      });
      const standardTotal = standardRate?.school_fee_rate_details.reduce(
        (sum, detail) => sum + Number(detail.amount),
        0
      ) || 0;
      
      // If totalExpected differs from standard, it's a custom plan
      if (Math.abs(totalExpectedAmount - standardTotal) > 0.01) {
        isCustomPlan = true;
        console.log(`[Receipt Generation] ✅ USING totalExpected from getStudentPaymentStatus: ${totalExpectedAmount} (Custom plan - differs from standard ${standardTotal})`);
      } else {
        console.log(`[Receipt Generation] Using totalExpected from getStudentPaymentStatus: ${totalExpectedAmount} (Standard rate: ${standardTotal})`);
      }
    } else if (customPaymentPlan || isCustomPlanFromStatus) {
      // Fallback: Use custom payment plan if found
      // Fallback: Use custom payment plan if found (either from getStudentPaymentStatus or direct query)
      if (isCustomPlanFromStatus && totalExpectedFromStatus > 0) {
        totalExpectedAmount = totalExpectedFromStatus;
        isCustomPlan = true;
        console.log(`[Receipt Generation] ✅ USING CUSTOM PAYMENT PLAN (from getStudentPaymentStatus): Total: ${totalExpectedAmount}`);
      } else if (customPaymentPlan) {
        // If plan is not active, log but still use it (might be intentional)
        if (!customPaymentPlan.is_active) {
          console.warn(`[Receipt Generation] ⚠️ Using inactive custom payment plan: ${customPaymentPlan.name}`);
        }
        
        // Verify total_amount by recalculating from installments
        const calculatedTotalFromInstallments = customPaymentPlan.custom_payment_plan_installments?.reduce(
          (sum, inst) => sum + Number(inst.amount),
          0
        ) || 0;
        
        // Use the stored total_amount, but log both for verification
        const storedTotalAmount = Number(customPaymentPlan.total_amount) || 0;
        
        console.log(`[Receipt Generation] ✅ USING CUSTOM PAYMENT PLAN: ${customPaymentPlan.name}`);
        console.log(`[Receipt Generation] Stored total_amount: ${storedTotalAmount}`);
        console.log(`[Receipt Generation] Calculated from installments: ${calculatedTotalFromInstallments}`);
        
        // Use calculated total from installments as it's more reliable (source of truth)
        // If installments exist, use their sum; otherwise fall back to stored value
        if (calculatedTotalFromInstallments > 0) {
          totalExpectedAmount = calculatedTotalFromInstallments;
          console.log(`[Receipt Generation] Using calculated total from installments: ${totalExpectedAmount}`);
          
          // If there's a mismatch, log a warning
          if (Math.abs(storedTotalAmount - calculatedTotalFromInstallments) > 0.01) {
            console.warn(`[Receipt Generation] ⚠️ WARNING: Mismatch detected! Stored: ${storedTotalAmount}, Calculated: ${calculatedTotalFromInstallments}. Using calculated value.`);
          }
        } else {
          // Fallback to stored value if no installments found
          totalExpectedAmount = storedTotalAmount;
          console.log(`[Receipt Generation] No installments found, using stored total: ${totalExpectedAmount}`);
        }
        
        isCustomPlan = true;
        console.log(`[Receipt Generation] Final totalExpectedAmount: ${totalExpectedAmount}`);
      }
    } else {
      // Use standard school fee rate (fallback)
      console.log(`[Receipt Generation] ⚠️ Fallback: No totalExpected from getStudentPaymentStatus, using standard fee rate`);
      console.log(`[Receipt Generation] Debug - paymentStatus exists: ${!!paymentStatus}, summary exists: ${!!paymentStatus?.summary}, totalExpected: ${paymentStatus?.summary?.totalExpected}`);
      const schoolFeeRate = await prisma.school_fee_rates.findFirst({
        where: {
          class_id: payment.student.classId || '',
        },
        include: {
          school_fee_rate_details: {
            select: {
              amount: true,
            },
          },
        },
      });

      totalExpectedAmount = schoolFeeRate?.school_fee_rate_details.reduce(
        (sum, detail) => sum + Number(detail.amount),
        0
      ) || 0;
      console.log(`[Receipt Generation] Standard fee rate used, Total: ${totalExpectedAmount}`);
    }

    // Calculate remaining amount
    const remainingAmount = Math.max(0, totalExpectedAmount - totalPaidAmount);
    const paidAmount = Number(payment.amount);
    
    // Log for debugging - comprehensive logging
    console.log(`[Receipt Generation] ========================================`);
    console.log(`[Receipt Generation] Payment ID: ${paymentId}`);
    console.log(`[Receipt Generation] Student ID: ${payment.student_id}`);
    console.log(`[Receipt Generation] Academic Year ID: ${payment.academic_year_id}`);
    console.log(`[Receipt Generation] Is Custom Plan: ${isCustomPlan}`);
    console.log(`[Receipt Generation] Total Expected Amount: ${totalExpectedAmount}`);
    console.log(`[Receipt Generation] Total Paid Amount: ${totalPaidAmount}`);
    console.log(`[Receipt Generation] Current Payment Amount: ${paidAmount}`);
    console.log(`[Receipt Generation] Calculation: ${totalExpectedAmount} - ${totalPaidAmount} = ${remainingAmount}`);
    console.log(`[Receipt Generation] Remaining Amount: ${remainingAmount}`);
    console.log(`[Receipt Generation] ========================================`);
    
    // Generate receipt number
    const receiptNumber = payment.receipt_number || `REC-${paymentId.substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
    const fileName = `receipt-${paymentId}-${receiptNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    const filePath = path.join(this.receiptsDir, fileName);

    // Delete existing file if it exists to ensure fresh generation
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Receipt Generation] Deleted existing file: ${filePath}`);
    }

    // Helper function to format currency
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    // Format payment method
    const paymentMethodLabels: Record<string, string> = {
      CASH: 'Espèces',
      CHEQUE: 'Chèque',
      VIREMENT: 'Virement bancaire',
      MOBILE_MONEY: 'Mobile Money',
      CARTE: 'Carte bancaire',
    };

    // Format dates
    const formattedPaymentDate = paymentDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const paymentDateTime = paymentCreatedAt || paymentDate;
    const formattedPaymentTime = paymentDateTime.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Get parent contact
    const parentContacts = payment.student.studentParents
      .map(sp => sp.parents.phone)
      .filter(phone => phone)
      .join(' / ') || 'N/A';

    // School phone
    const telephoneEcole = '0101540599';

    // Generate HTML template
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de Paiement de Scolarité</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #333;
      padding: 8px;
      background: #fff;
      margin: 0;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #228B22;
      border-radius: 6px;
      padding: 12px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #228B22;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .header h1 {
      color: #228B22;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .header h2 {
      color: #666;
      font-size: 12px;
      font-weight: normal;
    }
    .school-info {
      text-align: center;
      margin-bottom: 8px;
      color: #666;
      font-size: 8px;
    }
    .receipt-number {
      text-align: right;
      margin-bottom: 8px;
      font-weight: bold;
      color: #228B22;
      font-size: 10px;
    }
    .section {
      margin-bottom: 10px;
    }
    .section-title {
      background: #228B22;
      color: #fff;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 6px;
      border-radius: 3px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 8px;
      margin-bottom: 2px;
    }
    .info-value {
      color: #333;
      font-size: 9px;
    }
    .amount-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
      font-size: 9px;
    }
    .amount-table th {
      background: #f5f5f5;
      padding: 5px 6px;
      text-align: left;
      font-weight: bold;
      font-size: 8px;
      border: 1px solid #ddd;
    }
    .amount-table td {
      padding: 5px 6px;
      border: 1px solid #ddd;
      font-size: 9px;
    }
    .amount-table .label {
      font-weight: 600;
      color: #333;
    }
    .amount-table .amount {
      text-align: right;
      font-weight: bold;
      color: #228B22;
    }
    .total-section {
      background: #f9f9f9;
      padding: 8px;
      border-radius: 4px;
      margin-top: 8px;
      border: 2px solid #228B22;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 11px;
    }
    .total-label {
      font-weight: bold;
      color: #333;
    }
    .total-amount {
      font-weight: bold;
      font-size: 14px;
      color: #228B22;
    }
    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 7px;
      color: #666;
    }
    .signature-section {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 25px;
      width: 120px;
      margin-left: auto;
      margin-right: auto;
    }
    .signature-label {
      margin-top: 2px;
      font-size: 8px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>REÇU DE PAIEMENT DE SCOLARITÉ</h1>
      <h2>ÉCOLE LE SOUVERAIN</h2>
    </div>

    <div class="school-info">
      Système de Gestion Scolaire
    </div>

    <div class="receipt-number">
      N° Reçu: ${receiptNumber}
    </div>

    <div class="section">
      <div class="section-title">INFORMATIONS DE PAIEMENT</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Date de paiement</div>
          <div class="info-value">${formattedPaymentDate} à ${formattedPaymentTime}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Méthode de paiement</div>
          <div class="info-value">${paymentMethodLabels[payment.payment_method] || payment.payment_method}</div>
        </div>
        ${payment.reference ? `
        <div class="info-item">
          <div class="info-label">Référence</div>
          <div class="info-value">${payment.reference}</div>
        </div>
        ` : ''}
        <div class="info-item">
          <div class="info-label">Enregistré par</div>
          <div class="info-value">${payment.recordedBy ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}` : 'N/A'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">INFORMATIONS ÉLÈVE</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Matricule</div>
          <div class="info-value">${payment.student?.studentNumber || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Nom complet</div>
          <div class="info-value">${payment.student?.lastName || 'N/A'} ${payment.student?.firstName || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Sexe</div>
          <div class="info-value">${payment.student?.gender === 'M' || payment.student?.gender === 'Masculin' ? 'Masculin' : 'Féminin'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Classe</div>
          <div class="info-value">${payment.student?.class?.name || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Année académique</div>
          <div class="info-value">${payment.academicYear?.name || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Type de versement</div>
          <div class="info-value">${payment.school_fee_rate_details?.payment_types?.name || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Téléphone école</div>
          <div class="info-value">${telephoneEcole}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Contact parent</div>
          <div class="info-value">${parentContacts}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">DÉTAILS DE PAIEMENT</div>
      <table class="amount-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align: right;">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">${isCustomPlan ? 'Montant total du plan personnalisé' : 'Scolarité de base'}</td>
            <td class="amount">${formatCurrency(totalExpectedAmount)}</td>
          </tr>
          <tr>
            <td class="label">${isCustomPlan ? 'Montant payé (cumul plan personnalisé)' : 'Scolarité payée (cumul)'}</td>
            <td class="amount">${formatCurrency(totalPaidAmount)}</td>
          </tr>
          <tr>
            <td class="label">Montant versé (ce paiement)</td>
            <td class="amount" style="color: #1890ff;">${formatCurrency(paidAmount)}</td>
          </tr>
          <tr>
            <td class="label">Reste à payer</td>
            <td class="amount" style="color: ${remainingAmount > 0 ? '#ff4d4f' : '#52c41a'};">${formatCurrency(remainingAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="total-section">
      <div class="total-row">
        <span class="total-label">Montant versé</span>
        <span class="total-amount">${formatCurrency(paidAmount)} FCFA</span>
      </div>
    </div>

    ${payment.notes ? `
    <div class="section">
      <div class="section-title">NOTES</div>
      <div style="padding: 5px; background: #f9f9f9; border-radius: 3px; font-size: 8px;">
        ${payment.notes}
      </div>
    </div>
    ` : ''}

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Signature Parent/Tuteur</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Signature Administrateur</div>
      </div>
    </div>

    <div class="footer">
      <p>Reçu généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} - Ce document est généré automatiquement et fait foi de paiement.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Generate PDF using Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      await browser.close();

      console.log(`✅ Student payment receipt PDF generated: ${filePath}`);
      return `/uploads/payment-receipts/${fileName}`;
    } catch (error: any) {
      if (browser) {
        await browser.close();
      }
      console.error('Error generating student payment receipt PDF:', error);
      throw new Error(`Failed to generate receipt PDF: ${error.message}`);
    }
  }

  /**
   * Generate complete averages PDF in landscape format
   */
  static async generateCompleteAveragesPDF(
    classId: string,
    semesterId: string,
    academicYearId: string
  ): Promise<string> {
    await this.ensureUploadsDir();

    // Read logo image and convert to base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'apps', 'web', 'src', 'assets', 'images', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (error) {
      console.warn('Logo not found, using text instead');
    }

    // Get class data
    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!schoolClass) {
      throw new Error('Class not found');
    }

    // Get semester data
    const semester = await prisma.semesters.findUnique({
      where: { id: semesterId },
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
      },
    });

    if (!semester) {
      throw new Error('Semester not found');
    }

    // Get academic year data
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    // Get students in class
    const students = await prisma.student.findMany({
      where: { classId: classId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
        gender: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // Get class subjects with coefficients
    const classSubjects: any[] = await prisma.class_subjects.findMany({
      where: { class_id: classId },
      include: {
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        subjects: {
          name: 'asc',
        },
      },
    });

    // La conduite est traitée comme une matière supplémentaire : colonne, rang,
    // et poids dans la MG — exactement comme à l'écran (§ page Conduite).
    const conduct = await loadConduct(classId, semesterId, academicYearId);
    if (conduct.column) classSubjects.push(conduct.column);

    // Get all grades for the class, semester, and academic year
    const grades = await prisma.grades.findMany({
      where: {
        class_id: classId,
        semester_id: semesterId,
        academic_year_id: academicYearId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        evaluationType: {
          select: {
            id: true,
            name: true,
            coefficient: true,
          },
        },
      },
    });

    // Calculate averages for each student
    interface SubjectAverage {
      subjectId: string;
      subjectName: string;
      coefficient: number;
      average: number;
      rank: number;
    }

    interface StudentAverage {
      studentId: string;
      studentNumber: string;
      studentName: string;
      gender: string;
      subjectAverages: Map<string, SubjectAverage>;
      generalAverage: number;
      finalRank: number;
    }

    const studentAverages: StudentAverage[] = [];

    // For each student
    students.forEach((student) => {
      const subjectAveragesMap = new Map<string, SubjectAverage>();

      // For each subject in the class
      classSubjects.forEach((classSubject: any) => {
        const subjectId = classSubject.subjects.id;
        const subjectName = classSubject.subjects.name;
        const coefficient = classSubject.coefficient || 1;

        // La conduite ne vient pas de `grades` : sa note est déjà calculée.
        if (subjectId === CONDUCT_SUBJECT_ID) {
          const cg = conduct.byStudent.get(student.id);
          subjectAveragesMap.set(subjectId, {
            subjectId,
            subjectName,
            coefficient,
            average: cg ? Math.round(Number(cg.finalNote) * 100) / 100 : 0,
            rank: 0,
          });
          return;
        }

        // Get all grades for this student in this subject
        const studentGrades = grades.filter(
          (grade) => grade.student_id === student.id && grade.subject_id === subjectId
        );

        if (studentGrades.length === 0) {
          subjectAveragesMap.set(subjectId, {
            subjectId,
            subjectName,
            coefficient,
            average: 0,
            rank: 0,
          });
          return;
        }

        // Calculate weighted average for this subject
        let totalWeighted = 0;
        let totalCoefficients = 0;

        studentGrades.forEach((grade) => {
          const { weighted, weight } = gradeAverageParts(
            Number(grade.note), grade.max_note, grade.evaluationType?.coefficient,
          );
          totalWeighted += weighted;
          totalCoefficients += weight;
        });

        const average = totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0;

        subjectAveragesMap.set(subjectId, {
          subjectId,
          subjectName,
          coefficient,
          average: Math.round(average * 100) / 100,
          rank: 0, // Will be set later
        });
      });

      // Calculate General Average (MG)
      let totalWeightedMG = 0;
      let totalCoefficientsMG = 0;

      subjectAveragesMap.forEach((subjectAvg) => {
        if (subjectAvg.average > 0) {
          totalWeightedMG += subjectAvg.average * subjectAvg.coefficient;
          totalCoefficientsMG += subjectAvg.coefficient;
        }
      });

      const generalAverage =
        totalCoefficientsMG > 0 ? Math.round((totalWeightedMG / totalCoefficientsMG) * 100) / 100 : 0;

      studentAverages.push({
        studentId: student.id,
        studentNumber: student.studentNumber || '',
        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        gender: student.gender || '',
        subjectAverages: subjectAveragesMap,
        generalAverage,
        finalRank: 0, // Will be set later
      });
    });

    // Calculate ranks for each subject
    classSubjects.forEach((classSubject: any) => {
      const subjectId = classSubject.subjects.id;

      // Sort students by average in this subject (descending)
      const sortedBySubject = [...studentAverages].sort((a, b) => {
        const avgA = a.subjectAverages.get(subjectId)?.average || 0;
        const avgB = b.subjectAverages.get(subjectId)?.average || 0;
        return avgB - avgA;
      });

      // Assign ranks
      sortedBySubject.forEach((student, index) => {
        const subjectAvg = student.subjectAverages.get(subjectId);
        if (subjectAvg) {
          subjectAvg.rank = index + 1;
        }
      });
    });

    // Calculate final ranks (by General Average)
    const sortedByMG = [...studentAverages].sort((a, b) => b.generalAverage - a.generalAverage);
    sortedByMG.forEach((student, index) => {
      student.finalRank = index + 1;
    });

    // Generate file name
    const fileName = `moyennes-completes-${schoolClass.name.replace(/[^a-zA-Z0-9]/g, '-')}-${semester.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;
    const filePath = path.join(this.completeAveragesDir, fileName);

    // Format dates
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    // Generate HTML template in landscape format
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moyennes Complètes - ${schoolClass.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 9px;
      line-height: 1.2;
      color: #333;
      padding: 5mm;
      background: #fff;
      margin: 0;
    }
    .container {
      width: 100%;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #24AE6A;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .header h1 {
      color: #24AE6A;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .header h2 {
      color: #666;
      font-size: 14px;
      font-weight: normal;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding: 6px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 9px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 8px;
      margin-bottom: 2px;
    }
    .info-value {
      color: #333;
      font-size: 9px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 8px;
    }
    table th {
      background: #24AE6A;
      color: #fff;
      padding: 6px 4px;
      text-align: center;
      font-weight: bold;
      font-size: 8px;
      border: 1px solid #1E965A;
    }
    table td {
      padding: 5px 4px;
      border: 1px solid #ddd;
      text-align: center;
      font-size: 8px;
    }
    table tr:nth-child(even) {
      background: #f9f9f9;
    }
    table tr:hover {
      background: #f0f0f0;
    }
    .rank-cell {
      font-weight: bold;
      color: #24AE6A;
    }
    .average-cell {
      font-weight: bold;
      color: #333;
    }
    .mg-cell {
      font-weight: bold;
      font-size: 9px;
      color: #E96702;
      background: #fff3e0;
    }
    .subject-header {
      background: #e8f5e9 !important;
      font-weight: bold;
      color: #000 !important;
    }
    .footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 7px;
      color: #666;
    }
    @page {
      size: A4 landscape;
      margin: 5mm;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MOYENNES COMPLÈTES PAR CLASSE</h1>
      ${logoBase64 ? `
      <div style="text-align: center; margin-top: 8px;">
        <img src="${logoBase64}" alt="Logo" style="max-height: 60px; max-width: 200px;" />
      </div>
      ` : '<h2>ÉCOLE LE SOUVERAIN</h2>'}
    </div>

    <div class="info-section">
      <div class="info-item">
        <span class="info-label">Classe:</span>
        <span class="info-value">${schoolClass.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Trimestre:</span>
        <span class="info-value">${semester.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Année Scolaire:</span>
        <span class="info-value">${academicYear.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Période:</span>
        <span class="info-value">${formatDate(semester.start_date)} - ${formatDate(semester.end_date)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Date de génération:</span>
        <span class="info-value">${new Date().toLocaleDateString('fr-FR')}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">Rang</th>
          <th style="width: 150px;">Nom et Prénom</th>
          <th style="width: 50px;">Sexe</th>
          ${classSubjects
            .map(
              (cs: any) => `
          <th class="subject-header">${cs.subjects.name}</th>
          `
            )
            .join('')}
          <th style="width: 80px;" class="mg-cell">MG</th>
        </tr>
      </thead>
      <tbody>
        ${sortedByMG
          .map(
            (student) => `
        <tr>
          <td class="rank-cell">${student.finalRank}</td>
          <td style="text-align: left; padding-left: 6px;">${student.studentName}</td>
          <td>${student.gender === 'M' || student.gender === 'MALE' || student.gender === 'Masculin' ? 'M' : student.gender === 'F' || student.gender === 'FEMALE' || student.gender === 'Féminin' ? 'F' : student.gender || '-'}</td>
          ${classSubjects
            .map((cs: any) => {
              const subjectAvg = student.subjectAverages.get(cs.subjects.id);
              // Matière non notée : cellule laissée vide (pas de tiret).
              if (!subjectAvg || subjectAvg.average === 0) {
                return `
          <td></td>
          `;
              }
              return `
          <td class="average-cell">${subjectAvg.average.toFixed(2)}</td>
          `;
            })
            .join('')}
          <td class="mg-cell">${student.generalAverage.toFixed(2)}</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    // Generate PDF using Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

      await page.pdf({
        path: filePath,
        format: 'A4',
        landscape: true,
        margin: {
          top: '5mm',
          right: '5mm',
          bottom: '5mm',
          left: '5mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      await browser.close();

      console.log(`✅ Complete averages PDF generated: ${filePath}`);
      return `/uploads/complete-averages/${fileName}`;
    } catch (error: any) {
      if (browser) {
        await browser.close();
      }
      console.error('Error generating complete averages PDF:', error);
      throw new Error(`Failed to generate complete averages PDF: ${error.message}`);
    }
  }

  /**
   * Generate class grades PDF by subject in portrait format
   */
  static async generateClassGradesBySubjectPDF(
    classId: string,
    semesterId: string,
    academicYearId: string,
    subjectId: string
  ): Promise<string> {
    await this.ensureUploadsDir();

    // Read logo image and convert to base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'apps', 'web', 'src', 'assets', 'images', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (error) {
      console.warn('Logo not found, using text instead');
    }

    // Get class data
    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!schoolClass) {
      throw new Error('Class not found');
    }

    // Get semester data
    const semester = await prisma.semesters.findUnique({
      where: { id: semesterId },
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
      },
    });

    if (!semester) {
      throw new Error('Semester not found');
    }

    // Get academic year data
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    // Get subject data
    const subject = await prisma.subjects.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!subject) {
      throw new Error('Subject not found');
    }

    // Get students in class
    const students = await prisma.student.findMany({
      where: { classId: classId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
        gender: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // Get all grades for this subject, class, semester, and academic year
    const grades = await prisma.grades.findMany({
      where: {
        class_id: classId,
        semester_id: semesterId,
        academic_year_id: academicYearId,
        subject_id: subjectId,
      },
      include: {
        evaluationType: {
          select: {
            id: true,
            name: true,
            coefficient: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Calculate averages for each student
    interface StudentGrade {
      studentId: string;
      studentNumber: string;
      studentName: string;
      gender: string;
      grades: Array<{
        evaluationType: string;
        note: number;
        maxNote: number;
        date: Date;
      }>;
      average: number;
    }

    const studentGrades: StudentGrade[] = [];

    students.forEach((student) => {
      // Get all grades for this student in this subject
      const studentSubjectGrades = grades.filter((grade) => grade.student_id === student.id);

      if (studentSubjectGrades.length === 0) {
        return; // Skip students with no grades
      }

      // Prepare grades for calculation
      const gradeList = studentSubjectGrades.map((grade) => ({
        evaluationType: grade.evaluationType?.name || 'N/A',
        note: Number(grade.note),
        maxNote: grade.max_note || 20,
        coefficient: grade.evaluationType?.coefficient ?? 1,
        date: grade.created_at || new Date(),
      }));

      // Sort grades by creation date
      gradeList.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      // Calculate weighted average
      let totalWeighted = 0;
      let totalCoefficients = 0;

      gradeList.forEach((grade) => {
        const { weighted, weight } = gradeAverageParts(grade.note, grade.maxNote, grade.coefficient);
        totalWeighted += weighted;
        totalCoefficients += weight;
      });

      const average = totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0;

      studentGrades.push({
        studentId: student.id,
        studentNumber: student.studentNumber || '',
        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        gender: student.gender || '',
        grades: gradeList,
        average: Math.round(average * 100) / 100,
      });
    });

    // Sort students by average (descending)
    studentGrades.sort((a, b) => b.average - a.average);

    // Get maximum number of grades
    const maxGradesCount = Math.max(...studentGrades.map((sg) => sg.grades.length), 0);

    // Generate file name
    const fileName = `notes-${schoolClass.name.replace(/[^a-zA-Z0-9]/g, '-')}-${subject.name.replace(/[^a-zA-Z0-9]/g, '-')}-${semester.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;
    const filePath = path.join(this.completeAveragesDir, fileName);

    // Format dates
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    // Generate HTML template in portrait format
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notes par Matière - ${subject.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #333;
      padding: 5mm;
      background: #fff;
      margin: 0;
    }
    .container {
      width: 100%;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #24AE6A;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .header h1 {
      color: #24AE6A;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 6px;
    }
    .logo-container {
      text-align: center;
      margin-top: 8px;
    }
    .logo-container img {
      max-height: 60px;
      max-width: 200px;
    }
    .info-section {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 9px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      margin-bottom: 4px;
      min-width: 120px;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 8px;
      margin-bottom: 2px;
    }
    .info-value {
      color: #333;
      font-size: 9px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 9px;
    }
    table th {
      background: #24AE6A;
      color: #fff;
      padding: 8px 6px;
      text-align: center;
      font-weight: bold;
      font-size: 9px;
      border: 1px solid #1E965A;
    }
    table td {
      padding: 7px 6px;
      border: 1px solid #ddd;
      text-align: center;
      font-size: 9px;
    }
    table tr:nth-child(even) {
      background: #f9f9f9;
    }
    .rank-cell {
      font-weight: bold;
      color: #24AE6A;
      width: 50px;
    }
    .average-cell {
      font-weight: bold;
      font-size: 10px;
      color: #E96702;
      background: #fff3e0;
    }
    .subject-name {
      font-weight: bold;
      color: #000;
      font-size: 11px;
    }
    @page {
      size: A4 portrait;
      margin: 5mm;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NOTES PAR MATIÈRE</h1>
      ${logoBase64 ? `
      <div class="logo-container">
        <img src="${logoBase64}" alt="Logo" />
      </div>
      ` : ''}
    </div>

    <div class="info-section">
      <div class="info-item">
        <span class="info-label">Classe:</span>
        <span class="info-value">${schoolClass.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Matière:</span>
        <span class="info-value subject-name">${subject.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Trimestre:</span>
        <span class="info-value">${semester.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Année Scolaire:</span>
        <span class="info-value">${academicYear.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Période:</span>
        <span class="info-value">${formatDate(semester.start_date)} - ${formatDate(semester.end_date)}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px;">Rang</th>
          <th style="width: 200px;">Nom et Prénom</th>
          <th style="width: 60px;">Sexe</th>
          ${Array.from({ length: maxGradesCount }, (_, i) => `
          <th style="width: 80px;">Note ${i + 1}</th>
          `).join('')}
          <th style="width: 100px;" class="average-cell">MOY</th>
        </tr>
      </thead>
      <tbody>
        ${studentGrades
          .map(
            (student, index) => `
        <tr>
          <td class="rank-cell">${index + 1}</td>
          <td style="text-align: left; padding-left: 8px;">${student.studentName}</td>
          <td>${student.gender === 'M' || student.gender === 'MALE' || student.gender === 'Masculin' ? 'M' : student.gender === 'F' || student.gender === 'FEMALE' || student.gender === 'Féminin' ? 'F' : student.gender || '-'}</td>
          ${Array.from({ length: maxGradesCount }, (_, i) => {
            const grade = student.grades[i];
            if (!grade) {
              return `
          <td>-</td>
          `;
            }
            return `
          <td>${grade.note}/${grade.maxNote}</td>
          `;
          }).join('')}
          <td class="average-cell">${student.average.toFixed(2)}</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    // Generate PDF using Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

      await page.pdf({
        path: filePath,
        format: 'A4',
        landscape: false, // Portrait format
        margin: {
          top: '5mm',
          right: '5mm',
          bottom: '5mm',
          left: '5mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      await browser.close();

      console.log(`✅ Class grades by subject PDF generated: ${filePath}`);
      return `/uploads/complete-averages/${fileName}`;
    } catch (error: any) {
      if (browser) {
        await browser.close();
      }
      console.error('Error generating class grades by subject PDF:', error);
      throw new Error(`Failed to generate class grades by subject PDF: ${error.message}`);
    }
  }

  /**
   * Calcule le bulletin d'un élève et en rend le HTML, découpé en trois : les
   * styles, le filigrane et le corps (des enfants directs de <body>). Ce
   * découpage permet d'empiler N bulletins dans un même document sans dupliquer
   * la feuille de style ni le filigrane — cf. generateClassBulletinsPDF.
   */
  private static async buildStudentBulletin(
    studentId: string,
    classId: string,
    semesterId: string,
    academicYearId: string,
    generatedAt?: Date
  ): Promise<{
    student: { firstName: string; lastName: string };
    semester: { name: string };
    styles: string;
    watermark: string;
    body: string;
  }> {
    // Resolve the web assets dir robustly: the API may run with cwd = repo root
    // (node dist) OR cwd = apps/api (pnpm --filter api dev). __dirname points at
    // apps/api/{src|dist}/services in both cases, so climb to apps/web/src/assets.
    const assetDirCandidates = [
      path.resolve(__dirname, '../../../web/src/assets/images'),
      path.join(process.cwd(), 'apps', 'web', 'src', 'assets', 'images'),
      path.join(process.cwd(), '..', 'web', 'src', 'assets', 'images'),
    ];
    const assetsDir = assetDirCandidates.find((d) => fs.existsSync(d)) || assetDirCandidates[0];
    const readImageBase64 = (file: string, mime: string): string => {
      try {
        const p = path.join(assetsDir, file);
        if (fs.existsSync(p)) return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
      } catch {
        /* ignore */
      }
      return '';
    };

    const logoBase64 = readImageBase64('logo.png', 'image/png');
    if (!logoBase64) console.warn('Bulletin: logo.png introuvable sous', assetsDir);
    // Emblème national (colonne de droite de l'en-tête)
    const emblemeBase64 = readImageBase64('embleme.jpg', 'image/jpeg');

    // Get student data
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Get class data
    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!schoolClass) {
      throw new Error('Class not found');
    }

    // Get semester data
    const semester = await prisma.semesters.findUnique({
      where: { id: semesterId },
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
      },
    });

    if (!semester) {
      throw new Error('Semester not found');
    }

    // Get academic year data
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    // Get all students in class for effectif
    const allStudents = await prisma.student.findMany({
      where: { classId: classId },
      select: { id: true },
    });
    const effectif = allStudents.length;

    // Get class subjects with coefficients
    const classSubjects: any[] = await prisma.class_subjects.findMany({
      where: { class_id: classId },
      include: {
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        subjects: {
          name: 'asc',
        },
      },
    });

    // La conduite figure au bulletin comme une matière (catégorie AUTRES) :
    // elle a un coefficient et pèse donc dans la moyenne générale et le rang.
    const conduct = await loadConduct(classId, semesterId, academicYearId);
    if (conduct.column) classSubjects.push(conduct.column);

    // Get all grades for the student, class, semester, and academic year
    const grades = await prisma.grades.findMany({
      where: {
        student_id: studentId,
        class_id: classId,
        semester_id: semesterId,
        academic_year_id: academicYearId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        evaluationType: {
          select: {
            id: true,
            name: true,
            coefficient: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Get all grades for annual average calculation (all semesters)
    // Trimestres de l'année, dans l'ordre chronologique : sert à la fois au calcul
    // annuel et au choix du modèle de bulletin (seul le dernier porte le bilan).
    const allSemesters = await prisma.semesters.findMany({
      where: { academic_year_id: academicYearId },
      select: { id: true, name: true, coefficient: true },
      orderBy: { start_date: 'asc' },
    });

    const annualGrades = await prisma.grades.findMany({
      where: {
        student_id: studentId,
        class_id: classId,
        academic_year_id: academicYearId,
        semester_id: {
          in: allSemesters.map((s) => s.id),
        },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        evaluationType: {
          select: {
            coefficient: true,
          },
        },
      },
    });

    // Carte « Assiduité » : les trois chiffres viennent d'une source unique et
    // s'additionnent (total = justifiées + non justifiées). « Non justifiées » est
    // aussi la base de la note de conduite et des sanctions plus bas.
    const attendance = await ConductService.getAttendanceSummary({ academicYearId, semesterId, classId });
    const studentAttendance = attendance.get(studentId) ?? {
      justifiedHours: 0,
      unjustifiedHours: 0,
      totalHours: 0,
    };
    const justifiedAbsences = studentAttendance.justifiedHours;
    const unjustifiedAbsences = studentAttendance.unjustifiedHours;
    const totalAbsenceHours = studentAttendance.totalHours;
    const displayedAbsenceHours = unjustifiedAbsences;

    // Calculate averages for each subject
    interface SubjectResult {
      subjectId: string;
      subjectName: string;
      coefficient: number;
      trimesterAverage: number;
      trimesterRank: number;
      trimesterWeighted: number;
      annualAverage: number;
      annualRank: number;
      teacherName: string;
      appreciation: string;
    }

    const subjectResults: SubjectResult[] = [];
    const subjectCategories: { [key: string]: string[] } = {
      LETTRES: ['Français', 'Philosophie', 'Anglais', 'Histoire', 'Géographie', 'Histoire-Géographie'],
      SCIENCES: ['Mathématique', 'Physique', 'Chimie', 'Physique-chimie', 'SVT', 'Sc. de la vie et de la terre'],
      AUTRES: ['EPS', 'Éducation phys.et sportive', 'Informatique', 'Arts', 'Musique', 'Arts plastique', 'Entrepreneuriat', 'Conduite'],
    };

    // Calculate trimester and annual averages for each subject
    classSubjects.forEach((classSubject: any) => {
      const subjectId = classSubject.subjects.id;
      const subjectName = classSubject.subjects.name;
      const coefficient = classSubject.coefficient || 1;

      // La conduite n'a pas de notes dans `grades` : sa moyenne est la note validée.
      if (subjectId === CONDUCT_SUBJECT_ID) {
        const cg = conduct.byStudent.get(studentId);
        const note = cg ? Math.round(Number(cg.finalNote) * 100) / 100 : 0;
        subjectResults.push({
          subjectId,
          subjectName,
          coefficient,
          trimesterAverage: note,
          trimesterRank: 0,
          trimesterWeighted: Math.round(note * coefficient * 100) / 100,
          annualAverage: 0,
          annualRank: 0,
          teacherName: '',
          appreciation:
            note >= 16 ? 'TRES BIEN' : note >= 14 ? 'BIEN' : note >= 12 ? 'ASSEZ BIEN' : note >= 10 ? 'PASSABLE' : 'INSUFFISANT',
        });
        return;
      }

      // Trimester grades
      const trimesterSubjectGrades = grades.filter((g) => g.subject_id === subjectId);
      let trimesterAverage = 0;
      let trimesterWeighted = 0;
      let teacherName = '';

      if (trimesterSubjectGrades.length > 0) {
        let totalWeighted = 0;
        let totalCoefficients = 0;

        trimesterSubjectGrades.forEach((grade) => {
          const { weighted, weight } = gradeAverageParts(
            Number(grade.note), grade.max_note, grade.evaluationType?.coefficient,
          );
          totalWeighted += weighted;
          totalCoefficients += weight;

          if (grade.teacher) {
            teacherName = `${grade.teacher.first_name} ${grade.teacher.last_name}`;
          }
        });

        trimesterAverage = totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0;
        trimesterWeighted = trimesterAverage * coefficient;
      }

      // Annual grades
      const annualSubjectGrades = annualGrades.filter((g) => g.subject_id === subjectId);
      let annualAverage = 0;

      if (annualSubjectGrades.length > 0) {
        let totalWeighted = 0;
        let totalCoefficients = 0;

        annualSubjectGrades.forEach((grade) => {
          const { weighted, weight } = gradeAverageParts(
            Number(grade.note), grade.max_note, grade.evaluationType?.coefficient,
          );
          totalWeighted += weighted;
          totalCoefficients += weight;
        });

        annualAverage = totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0;
      }

      // Calculate ranks (simplified - would need all students' data for accurate ranking)
      const trimesterRank = 0; // Will be calculated later
      const annualRank = 0; // Will be calculated later

      // Determine appreciation based on average
      let appreciation = '';
      if (trimesterAverage >= 16) {
        appreciation = 'TRES BIEN';
      } else if (trimesterAverage >= 14) {
        appreciation = 'BIEN';
      } else if (trimesterAverage >= 12) {
        appreciation = 'ASSEZ BIEN';
      } else if (trimesterAverage >= 10) {
        appreciation = 'PASSABLE';
      } else {
        appreciation = 'INSUFFISANT';
      }

      subjectResults.push({
        subjectId,
        subjectName,
        coefficient,
        trimesterAverage: Math.round(trimesterAverage * 100) / 100,
        trimesterRank,
        trimesterWeighted: Math.round(trimesterWeighted * 100) / 100,
        annualAverage: Math.round(annualAverage * 100) / 100,
        annualRank,
        teacherName,
        appreciation,
      });
    });

    // Calculate ranks for each subject
    const allStudentsInClass = await prisma.student.findMany({
      where: { classId: classId },
      select: { id: true },
    });

    for (const subjectResult of subjectResults) {
      // Rang en conduite : classement sur les notes de conduite de la classe.
      if (subjectResult.subjectId === CONDUCT_SUBJECT_ID) {
        const ranked = allStudentsInClass
          .map((s) => ({ studentId: s.id, average: Number(conduct.byStudent.get(s.id)?.finalNote ?? 0) }))
          .filter((r) => r.average > 0)
          .sort((a, b) => b.average - a.average);
        const idx = ranked.findIndex((r) => r.studentId === studentId);
        subjectResult.trimesterRank = idx >= 0 ? idx + 1 : 0;
        continue;
      }

      // Get all students' averages for this subject in this semester
      const allStudentGrades = await prisma.grades.findMany({
        where: {
          class_id: classId,
          semester_id: semesterId,
          academic_year_id: academicYearId,
          subject_id: subjectResult.subjectId,
        },
        include: {
          student: {
            select: { id: true },
          },
          evaluationType: {
            select: { coefficient: true },
          },
        },
      });

      // Calculate average for each student
      const studentAverages: { studentId: string; average: number }[] = [];
      allStudentsInClass.forEach((s) => {
        const studentSubjectGrades = allStudentGrades.filter((g) => g.student_id === s.id);
        if (studentSubjectGrades.length > 0) {
          let totalWeighted = 0;
          let totalCoefficients = 0;

          studentSubjectGrades.forEach((grade) => {
            const { weighted, weight } = gradeAverageParts(
              Number(grade.note), grade.max_note, grade.evaluationType?.coefficient,
            );
            totalWeighted += weighted;
            totalCoefficients += weight;
          });

          const average = totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0;
          studentAverages.push({ studentId: s.id, average });
        }
      });

      // Sort and find rank
      studentAverages.sort((a, b) => b.average - a.average);
      const studentIndex = studentAverages.findIndex((sa) => sa.studentId === studentId);
      subjectResult.trimesterRank = studentIndex >= 0 ? studentIndex + 1 : 0;
    }

    // Calculate general average and rank
    let totalWeightedMG = 0;
    let totalCoefficientsMG = 0;

    subjectResults.forEach((sr) => {
      if (sr.trimesterAverage > 0) {
        totalWeightedMG += sr.trimesterAverage * sr.coefficient;
        totalCoefficientsMG += sr.coefficient;
      }
    });

    const generalAverage = totalCoefficientsMG > 0 ? totalWeightedMG / totalCoefficientsMG : 0;

    // Calculate student's rank in class
    const allStudentAverages: { studentId: string; average: number }[] = [];
    for (const s of allStudentsInClass) {
      const studentAllGrades = await prisma.grades.findMany({
        where: {
          student_id: s.id,
          class_id: classId,
          semester_id: semesterId,
          academic_year_id: academicYearId,
        },
        include: {
          evaluationType: {
            select: { coefficient: true },
          },
        },
      });

      if (studentAllGrades.length > 0) {
        let totalWeighted = 0;
        let totalCoefficients = 0;

        studentAllGrades.forEach((grade) => {
          const subjectCoeff = classSubjects.find((cs: any) => cs.subjects.id === grade.subject_id)?.coefficient || 1;
          const { weighted, weight } = gradeAverageParts(
            Number(grade.note), grade.max_note, grade.evaluationType?.coefficient,
          );
          totalWeighted += weighted * subjectCoeff;
          totalCoefficients += weight * subjectCoeff;
        });

        // La conduite pèse dans la MG : elle doit peser aussi dans le rang de classe.
        const cg = conduct.column ? conduct.byStudent.get(s.id) : null;
        if (cg && Number(cg.finalNote) > 0) {
          const coef = conduct.column!.coefficient;
          totalWeighted += Number(cg.finalNote) * coef;
          totalCoefficients += coef;
        }

        const average = totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0;
        allStudentAverages.push({ studentId: s.id, average });
      }
    }

    allStudentAverages.sort((a, b) => b.average - a.average);
    const studentRankIndex = allStudentAverages.findIndex((sa) => sa.studentId === studentId);
    const studentRank = studentRankIndex >= 0 ? studentRankIndex + 1 : 0;

    // Calculate class statistics
    const classAverages = allStudentAverages.map((sa) => sa.average);
    const classMin = classAverages.length > 0 ? Math.min(...classAverages) : 0;
    const classMax = classAverages.length > 0 ? Math.max(...classAverages) : 0;
    const classAverage = classAverages.length > 0 ? classAverages.reduce((a, b) => a + b, 0) / classAverages.length : 0;

    // ----- Modèle de bulletin : bilan de fin d'année (dernier trimestre) -----
    /**
     * Le bulletin du DERNIER trimestre de l'année porte en plus le « Bilan de fin
     * d'année » : récapitulatif des trois trimestres, moyenne générale annuelle,
     * rang annuel et décision de passage. Les autres trimestres gardent le modèle
     * standard. C'est le seul écart entre les modèles.
     *
     * MGA = Σ(moyenne du trimestre × coefficient) / Σ(coefficients), les deux
     * derniers trimestres comptant double (cf. `semesters.coefficient`) : un
     * trimestre est affiché sur /20×coef (T1 sur /20, T2 et T3 sur /40).
     * Un trimestre sans note est ignoré (son coefficient ne dilue pas la moyenne).
     */
    const semesterIndex = allSemesters.findIndex((s) => s.id === semesterId);
    const isLastTrimester = allSemesters.length > 1 && semesterIndex === allSemesters.length - 1;

    let annualReport: {
      trimesters: { label: string; weighted: number; max: number }[];
      average: number;
      rank: number;
      admitted: boolean;
    } | null = null;

    if (isLastTrimester) {
      const perSemester = await Promise.all(
        allSemesters.map((s) => computeClassGeneralAverages(classId, s.id, academicYearId)),
      );

      const annualOf = (id: string) => {
        let weighted = 0;
        let coefficients = 0;
        allSemesters.forEach((s, i) => {
          const mg = perSemester[i].get(id) ?? 0;
          if (mg > 0) {
            weighted += mg * s.coefficient;
            coefficients += s.coefficient;
          }
        });
        return coefficients > 0 ? weighted / coefficients : 0;
      };

      const annualAverage = annualOf(studentId);

      // Rang annuel : sur les élèves effectivement notés sur l'année.
      const ranked = allStudentsInClass
        .map((s) => ({ studentId: s.id, average: annualOf(s.id) }))
        .filter((r) => r.average > 0)
        .sort((a, b) => b.average - a.average);
      const annualRankIndex = ranked.findIndex((r) => r.studentId === studentId);

      annualReport = {
        trimesters: allSemesters.map((s, i) => ({
          label: s.name,
          weighted: (perSemester[i].get(studentId) ?? 0) * s.coefficient,
          max: 20 * s.coefficient,
        })),
        average: annualAverage,
        rank: annualRankIndex >= 0 ? annualRankIndex + 1 : 0,
        admitted: annualAverage >= 10,
      };
    }

    // Group subjects by category
    const lettersSubjects: SubjectResult[] = [];
    const sciencesSubjects: SubjectResult[] = [];
    const autresSubjects: SubjectResult[] = [];

    subjectResults.forEach((sr) => {
      const name = sr.subjectName.toUpperCase();
      if (subjectCategories.LETTRES.some((cat) => name.includes(cat.toUpperCase()))) {
        lettersSubjects.push(sr);
      } else if (subjectCategories.SCIENCES.some((cat) => name.includes(cat.toUpperCase()))) {
        sciencesSubjects.push(sr);
      } else {
        autresSubjects.push(sr);
      }
    });

    // Calculate category totals
    const calculateCategoryTotal = (subjects: SubjectResult[]) => {
      const totalCoeff = subjects.reduce((sum, s) => sum + s.coefficient, 0);
      const totalWeighted = subjects.reduce((sum, s) => sum + s.trimesterWeighted, 0);
      const totalAnnual = subjects.reduce((sum, s) => sum + s.annualAverage * s.coefficient, 0);
      return {
        coeff: totalCoeff,
        weighted: totalWeighted,
        average: totalCoeff > 0 ? totalWeighted / totalCoeff : 0,
        annualAverage: totalCoeff > 0 ? totalAnnual / totalCoeff : 0,
      };
    };

    const lettersTotal = calculateCategoryTotal(lettersSubjects);
    const sciencesTotal = calculateCategoryTotal(sciencesSubjects);
    const autresTotal = calculateCategoryTotal(autresSubjects);
    const grandTotal = {
      coeff: lettersTotal.coeff + sciencesTotal.coeff + autresTotal.coeff,
      weighted: lettersTotal.weighted + sciencesTotal.weighted + autresTotal.weighted,
    };

    // Format dates
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    // ----- Helpers de mise en forme du bulletin -----
    /** Note à 2 décimales, virgule française ; cellule laissée vide si non notée. */
    const fmt2 = (n: number | null | undefined) =>
      n == null || n <= 0 ? '' : Number(n).toFixed(2).replace('.', ',');
    /** Rang ordinal court (1er, 2e, …) ; vide si l'élève n'est pas classé. */
    const rankLabel = (r: number) => (r > 0 ? `${r}${r === 1 ? 'er' : 'e'}` : '');
    /** Classe sémantique d'une moyenne : au-dessus / en-dessous de 10. */
    const noteCls = (n: number) => (n <= 0 ? 'na' : n >= 10 ? 'ok' : 'bad');
    /** Mention académique standard à partir d'une moyenne /20 ; vide sans moyenne. */
    const mentionOf = (m: number) => {
      if (m <= 0) return '';
      if (m < 10) return 'Insuffisant';
      if (m < 12) return 'Passable';
      if (m < 14) return 'Assez Bien';
      if (m < 16) return 'Bien';
      if (m < 18) return 'Très Bien';
      return 'Excellent';
    };
    const generalMention = mentionOf(generalAverage);

    // ----- Mentions du conseil de classe : distinctions & sanctions -----
    /**
     * Cochées automatiquement à partir du résultat de l'élève (moyenne générale)
     * et de son assiduité — les deux axes du modèle papier :
     *   - « Blâme Travail »  ⇐ les résultats  (MG sous la moyenne) ;
     *   - « Blâme conduite » ⇐ l'assiduité    (absences non justifiées).
     * Ils sont indépendants : un élève peut cumuler les deux, ou n'en avoir aucun.
     *
     * ⚠️ L'assiduité retenue est `displayedAbsenceHours` — les heures comptées par
     * la Conduite, c.-à-d. les absences NON justifiées (l'administration a déjà
     * déduit celles couvertes par un justificatif). On n'utilise volontairement pas
     * `unjustifiedAbsences` : il dérive du journal legacy `student_absences` et vaut
     * toujours 0.
     *
     * Une seule distinction est cochée : la plus haute atteinte. Un élève trop
     * absent n'est pas distingué, même avec une bonne moyenne. Un élève sans note
     * (MG = 0) n'est ni distingué ni blâmé sur son travail — seule l'assiduité peut
     * alors le sanctionner.
     */
    const DISTINCTION_MIN_AVG = { felicitations: 16, tableauHonneur: 14 };
    /**
     * Seuil unique d'assiduité, en heures d'absence non justifiées :
     *   - jusqu'à ce seuil inclus : l'élève reste distinguable et n'est pas blâmé ;
     *   - au-delà : plus aucune distinction ET « Blâme conduite ».
     * Une seule valeur pour les deux effets : impossible de rouvrir une zone où
     * l'élève ne serait ni récompensé ni sanctionné.
     */
    const ABSENCE_LIMIT_H = 6;
    /** Sous cette moyenne, le travail est blâmé. */
    const BLAME_BELOW_AVG = 10;

    const absenceH = displayedAbsenceHours;
    const hasAverage = generalAverage > 0;
    const tooAbsent = absenceH > ABSENCE_LIMIT_H;

    const distinction: 'felicitations' | 'tableauHonneur' | null =
      !hasAverage || tooAbsent
        ? null
        : generalAverage >= DISTINCTION_MIN_AVG.felicitations
          ? 'felicitations'
          : generalAverage >= DISTINCTION_MIN_AVG.tableauHonneur
            ? 'tableauHonneur'
            : null;

    const blameTravail = hasAverage && generalAverage < BLAME_BELOW_AVG;
    const blameConduite = tooAbsent;

    /** Case à cocher du bulletin : cochée et mise en avant, ou vide. */
    const checkLine = (checked: boolean, label: string) =>
      `<div class="check${checked ? ' on' : ''}">${checked ? '☑' : '☐'} ${label}</div>`;
    // Date du visa : celle de la génération administrative des bulletins de la
    // classe, pas celle du téléchargement — un parent qui rouvre son PDF en mars
    // doit y lire la date à laquelle le bulletin a été édité.
    const today = (generatedAt ?? new Date()).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    /** Un bloc de disciplines : bandeau catégorie + lignes zébrées + sous-total. */
    const renderCategory = (
      label: string,
      list: SubjectResult[],
      total: { coeff: number; weighted: number }
    ) => {
      if (list.length === 0) return '';
      // Pas de bandeau de catégorie : les disciplines s'enchaînent et c'est la
      // ligne « Total <catégorie> » qui ferme et nomme chaque bloc.
      return `
      ${list
        .map(
          (sr, i) => `
      <tr class="${i % 2 === 1 ? 'zebra' : ''}">
        <td class="disc">${sr.subjectName}</td>
        <td class="num ${noteCls(sr.trimesterAverage)}">${fmt2(sr.trimesterAverage)}</td>
        <td class="num">${sr.coefficient}</td>
        <td class="num strong">${fmt2(sr.trimesterWeighted)}</td>
        <td class="num">${rankLabel(sr.trimesterRank)}</td>
        <td class="appr">${sr.trimesterAverage > 0 ? sr.appreciation : ''}</td>
        <td class="prof">${sr.teacherName || ''}</td>
      </tr>`
        )
        .join('')}
      <tr class="sub">
        <td>Total ${label.toLowerCase()}</td>
        <td class="num"></td>
        <td class="num">${total.coeff}</td>
        <td class="num">${fmt2(total.weighted)}</td>
        <td class="num"></td>
        <td></td>
        <td></td>
      </tr>`;
    };

    // Feuille de style du bulletin — commune à tous les élèves, elle n'est
    // écrite qu'une fois dans le document, qu'il porte un bulletin ou toute une
    // classe (cf. renderBulletinDocument).
    const styles = `
    :root {
      /* Palette issue du logo (vert + orange), utilisée avec retenue */
      --green: #1E9E4B;
      --green-dark: #0E6E34;
      --orange: #EE7D22;
      --orange-dark: #C15C12;
      --green-tint: #EAF5EF;
      --orange-tint: #FDF1E5;
      --zebra: #F6FAF7;
      --line: #000;         /* filets des cartes / encadrés */
      --grid: #000;         /* filets du tableau des disciplines */
      --ink: #000;
      --muted: #000;        /* aucun texte gris dans le bulletin */
      --ok: #15803D;
      --bad: #B91C1C;
      /* Logo et emblème portés par le style, pas par le balisage : les data-URI
         (≈ 500 Ko à eux deux) ne sont ainsi écrits qu'une fois par document, et
         non une fois par bulletin — sans quoi une classe entière produit
         plusieurs mégaoctets de HTML que Chrome ne finit pas de charger. */
      --logo-src: ${logoBase64 ? `url("${logoBase64}")` : 'none'};
      --embleme-src: ${emblemeBase64 ? `url("${emblemeBase64}")` : 'none'};
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Georgia', 'Times New Roman', 'Times', serif;
      font-size: 10.5px;
      line-height: 1.35;
      color: var(--ink);
      background: #fff;
      /* Sans cela Chrome « nettoie » les aplats et le filigrane à l'impression */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ===== Filigrane logo (arrière-plan centré) ===== */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 135mm;
      height: 135mm;
      background-image: var(--logo-src);
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      opacity: 0.13;
      z-index: 0;
      pointer-events: none;
    }
    body > *:not(.watermark) {
      position: relative;
      z-index: 1;
    }

    /* ===== En-tête institutionnel ===== */
    .bulletin-head {
      display: grid;
      grid-template-columns: 1fr 1.5fr 1fr;
      gap: 12px;
      align-items: start;
    }
    .head-col {
      font-size: 10px;
      line-height: 1.4;
      color: var(--ink);
      text-align: center;
    }
    .head-col .strong { font-weight: bold; }
    /* Logo (gauche) et emblème (droite), sous leur mention respective */
    .head-col img,
    .head-img {
      display: block;
      max-width: 64px;
      max-height: 64px;
      margin: 5px auto 0;
    }
    .head-img {
      width: 64px;
      height: 64px;
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
    }
    .head-logo { background-image: var(--logo-src); }
    .head-embleme { background-image: var(--embleme-src); }
    .head-center { text-align: center; }
    .school-name {
      font-size: 16px;
      font-weight: bold;
      color: var(--green-dark);
      letter-spacing: .2px;
      line-height: 1.2;
    }
    .school-meta {
      font-size: 9.5px;
      color: var(--ink);
      margin-top: 3px;
      line-height: 1.45;
    }

    /* ===== Titre du document : une seule ligne encadrée ===== */
    .doc-title {
      margin-top: 10px;
      text-align: center;
    }
    .doc-title h1 {
      display: inline-block;
      padding: 4px 18px;
      border: 1.5px solid var(--green-dark);
      font-size: 15px;
      font-weight: bold;
      color: var(--green-dark);
      letter-spacing: 1px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .doc-sub {
      margin-top: 5px;
      font-size: 10px;
      color: var(--muted);
    }
    .doc-sub strong { color: var(--ink); }
    /* Filet drapeau : seul rappel graphique fort, 2px */
    .flag-bar {
      display: flex;
      height: 2.5px;
      margin: 6px 0 6px;
    }
    .flag-bar span { flex: 1; }
    .flag-bar .g { background: var(--green); }
    .flag-bar .o { background: var(--orange); }

    /* ===== Identité élève : libellés verts soulignés (style « kv ») ===== */
    .student-section {
      background: var(--green-tint);
      border: 1px solid var(--line);
      padding: 8px 10px;
      margin-bottom: 6px;
    }
    .student-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 7px;
      text-align: center;
      color: var(--green-dark);
      text-transform: uppercase;
      letter-spacing: .4px;
    }
    .student-details {
      display: grid;
      grid-template-columns: 1.15fr 1fr .85fr;
      gap: 10px;
      font-size: 11.5px;
    }
    .student-detail-item {
      margin-bottom: 4px;
      color: var(--ink);
      font-weight: 600;
    }
    .student-detail-item .lbl {
      font-weight: bold;
      color: var(--green-dark);
      border-bottom: .5px solid var(--green);
    }

    /* ===== Table des disciplines ===== */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 6px;
    }
    table th, table td {
      border: 1px solid var(--grid);
      /* 3px plutôt que 4 : multiplié par la douzaine de lignes du tableau, c'est
         ce qui laisse la place au bilan annuel du 3e trimestre sans repasser sur
         une seconde page. */
      padding: 3px;
      text-align: center;
    }
    table thead th {
      background: var(--green-dark);
      color: #fff;
      font-weight: bold;
      font-size: 9.5px;
      letter-spacing: .3px;
      white-space: nowrap;
    }
    td.disc {
      text-align: left;
      padding-left: 6px;
    }
    td.num { font-variant-numeric: tabular-nums; }
    td.strong { font-weight: bold; }
    td.ok { color: var(--ok); font-weight: bold; }
    td.bad { color: var(--bad); font-weight: bold; }
    td.na { color: var(--muted); }
    td.appr, td.prof {
      font-size: 10px;
      color: var(--ink);
    }
    tr.zebra td { background: var(--zebra); }
    tr.sub td {
      background: var(--orange-tint);
      font-weight: bold;
      color: var(--orange-dark);
    }
    tr.sub td:first-child {
      text-align: left;
      padding-left: 6px;
      text-transform: uppercase;
      font-size: 9.5px;
    }
    tr.total td {
      background: var(--green-dark);
      color: #fff;
      font-weight: bold;
    }
    tr.total td:first-child {
      text-align: left;
      padding-left: 6px;
      letter-spacing: .4px;
    }

    /* ===== Synthèse : 3 cartes légères ===== */
    .bilan-grid {
      display: grid;
      grid-template-columns: 1fr 1.1fr 1fr;
      gap: 8px;
      margin-bottom: 6px;
    }
    .bilan-card {
      border: 1px solid var(--line);
    }
    .bilan-card h3 {
      background: var(--green-dark);
      color: #fff;
      font-size: 9.5px;
      font-weight: bold;
      letter-spacing: .5px;
      text-transform: uppercase;
      text-align: center;
      padding: 3.5px 4px;
    }
    .bilan-card .body {
      padding: 6px 8px;
      font-size: 10px;
    }
    .bilan-item {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 3px;
    }
    .bilan-item .v { font-weight: bold; }
    /* Heures non justifiées : ce sont elles qui coûtent des points de conduite. */
    .bilan-item .v.bad { color: var(--bad); }
    /* Moyenne générale : le chiffre-clé du bulletin */
    .mg {
      text-align: center;
      padding: 2px 0 4px;
    }
    .mg .val {
      font-size: 24px;
      font-weight: bold;
      line-height: 1.1;
    }
    .mg .val.ok { color: var(--ok); }
    .mg .val.bad { color: var(--bad); }
    .mg .val small {
      font-size: 12px;
      color: var(--muted);
      font-weight: normal;
    }

    /* ===== Mentions du conseil ===== */
    .mentions-section {
      border: 1px solid var(--line);
      margin-bottom: 6px;
    }
    .mentions-section h3 {
      background: var(--green-tint);
      color: var(--green-dark);
      font-size: 9.5px;
      font-weight: bold;
      letter-spacing: .5px;
      text-transform: uppercase;
      text-align: center;
      padding: 3.5px 4px;
      border-bottom: 1px solid var(--line);
    }
    .mentions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1.4fr;
      gap: 10px;
      padding: 7px 9px;
      font-size: 10px;
    }
    .mentions-grid .lbl {
      font-weight: bold;
      color: var(--green-dark);
      border-bottom: .5px solid var(--green);
      display: inline-block;
      margin-bottom: 4px;
    }
    .check { margin-bottom: 3px; color: var(--ink); }
    /* Case retenue par le conseil : elle doit sauter aux yeux à l'impression. */
    .check.on { font-weight: bold; color: var(--green-dark); }

    /* ===== Bilan de fin d'année (dernier trimestre) =====
       Ce bloc n'existe qu'au dernier trimestre et s'ajoute à un bulletin déjà
       plein : il est donc réglé plus serré que le reste du document, sans quoi
       le bulletin du 3e trimestre passe sur une seconde page. */
    .annual-section {
      border: 1px solid var(--line);
      margin-bottom: 6px;
    }
    .annual-section h3 {
      background: var(--green-tint);
      color: var(--green-dark);
      font-size: 9.5px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: .4px;
      text-align: center;
      padding: 2.5px 4px;
      border-bottom: 1px solid var(--line);
    }
    .annual-grid {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 8px;
      padding: 4px 9px;
      font-size: 9.5px;
    }
    .annual-grid .lbl {
      font-weight: bold;
      color: var(--green-dark);
      border-bottom: .5px solid var(--green);
      display: inline-block;
      margin-bottom: 2px;
    }
    .annual-item {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 0.5px 0;
    }
    .annual-item .v { font-weight: bold; font-variant-numeric: tabular-nums; }
    .annual-item .v small { font-weight: normal; color: var(--ink); }
    .annual-item .v.ok { color: var(--ok); }
    .annual-item .v.bad { color: var(--bad); }
    /* Moyenne annuelle : le chiffre qui décide du passage. */
    .annual-item.strong {
      border-top: .5px solid var(--line);
      margin-top: 2px;
      padding-top: 2.5px;
      font-size: 10.5px;
    }
    .decision {
      margin-top: 2px;
      min-height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 10.5px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: .3px;
      border: .5px dashed var(--line);
      padding: 4px 6px;
    }
    .decision.ok { color: var(--ok); border-color: var(--ok); background: #F0FDF4; }
    .decision.ko { color: var(--bad); border-color: var(--bad); background: #FEF2F2; }
    /* Appréciation générale : sans cadre, juste sous son libellé */
    .appr-general {
      margin-top: 2px;
      font-size: 12px;
      font-weight: bold;
      color: var(--orange-dark);
      letter-spacing: .3px;
    }

    /* ===== Pied de page =====
       Ne porte plus que le visa : la mention légale a été retirée. D'où le flex
       aligné à droite plutôt que l'ancienne grille deux colonnes (note | visa),
       qui aurait laissé le visa dans la colonne de gauche. */
    .footer {
      border-top: 1.5px solid var(--green);
      padding-top: 6px;
      display: flex;
      justify-content: flex-end;
    }
    .visa { text-align: right; }
    .visa .date {
      font-size: 10px;
      color: var(--ink);
      margin-bottom: 4px;
    }
    .visa .who {
      font-size: 10.5px;
      font-weight: bold;
      color: var(--green-dark);
      border-bottom: .5px solid var(--green);
      display: inline-block;
      padding-bottom: 1px;
    }
    @page {
      size: A4 portrait;
      margin: 10mm 9mm;
    }
    /* Un bulletin = une feuille. Dans un document de classe, chaque feuille sauf
       la première s'ouvre sur une nouvelle page : page-break-before plutôt que
       page-break-after, sinon un bulletin qui remplit sa page pousse le saut sur
       la suivante et intercale une page blanche. */
    .sheet { position: relative; z-index: 1; }
    .sheet + .sheet {
      page-break-before: always;
      break-before: page;
    }
`;

    // Filigrane : `position: fixed`, Chrome le répète donc sur chaque page du
    // document — il ne doit être présent qu'une seule fois, même pour une classe.
    const watermark = logoBase64 ? `<div class="watermark" role="presentation"></div>` : '';

    // Corps d'un bulletin, enveloppé dans une feuille : c'est elle qui porte le
    // saut de page quand on en empile plusieurs dans un document de classe.
    const body = `
<div class="sheet">

  <!-- En-tête institutionnel : logo à gauche, emblème à droite -->
  <div class="bulletin-head">
    <div class="head-col">
      <div class="strong">MINISTÈRE DE L'ÉDUCATION NATIONALE</div>
      ${logoBase64 ? `<div class="head-img head-logo" role="img" aria-label="Logo"></div>` : ''}
    </div>
    <div class="head-center">
      <div class="school-name">COLLÈGE PRIVÉ LE SOUVERAIN DE LARABIA</div>
      <div class="school-meta">
        Code 000680 · Statut Public · Tél. 01 95 77 23<br>
        admin@souverainlarabia.edu.ci
      </div>
    </div>
    <div class="head-col">
      <div class="strong">RÉPUBLIQUE DE CÔTE D'IVOIRE</div>
      <div><em>Union - Discipline - Travail</em></div>
      ${emblemeBase64 ? `<div class="head-img head-embleme" role="img" aria-label="Emblème"></div>` : ''}
    </div>
  </div>

  <!-- Titre du document -->
  <div class="doc-title">
    <h1>Bulletin de Notes — ${semester.name}</h1>
    <div class="doc-sub">
      Année scolaire : <strong>${academicYear.name}</strong> &nbsp;·&nbsp;
      Classe : <strong>${schoolClass.name}</strong> &nbsp;·&nbsp;
      Effectif : <strong>${effectif}</strong>
    </div>
  </div>
  <div class="flag-bar"><span class="g"></span><span class="o"></span></div>

  <!-- Identité de l'élève -->
  <div class="student-section">
    <div class="student-name">${student.firstName.toUpperCase()} ${student.lastName.toUpperCase()}</div>
    <div class="student-details">
      <div>
        <div class="student-detail-item"><span class="lbl">Matricule</span> : ${student.studentNumber || ''}</div>
        <div class="student-detail-item"><span class="lbl">Né(e) le</span> : ${formatDate(student.dateOfBirth)}</div>
        <div class="student-detail-item"><span class="lbl">Lieu de naissance</span> : ${student.placeOfBirth || ''}</div>
      </div>
      <div>
        <div class="student-detail-item"><span class="lbl">Sexe</span> : ${student.gender === 'M' || student.gender === 'MALE' ? 'Masculin' : 'Féminin'}</div>
        <div class="student-detail-item"><span class="lbl">Nationalité</span> : ${student.nationality || 'Ivoirienne'}</div>
        <div class="student-detail-item"><span class="lbl">Affecté(e)</span> : oui</div>
      </div>
      <div>
        <div class="student-detail-item"><span class="lbl">Redoublant(e)</span> : non</div>
        <div class="student-detail-item"><span class="lbl">Boursier(e)</span> : non</div>
        <div class="student-detail-item"><span class="lbl">Interne</span> : non</div>
      </div>
    </div>
  </div>

  <!-- Disciplines -->
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Disciplines</th>
        <th style="width: 9%;">Moy. /20</th>
        <th style="width: 7%;">Coef.</th>
        <th style="width: 13%;">Moy. × Coef.</th>
        <th style="width: 8%;">Rang</th>
        <th style="width: 17%;">Appréciation</th>
        <th style="width: 21%;">Professeur</th>
      </tr>
    </thead>
    <tbody>
      ${renderCategory('Lettres', lettersSubjects, lettersTotal)}
      ${renderCategory('Sciences', sciencesSubjects, sciencesTotal)}
      ${renderCategory('Autres', autresSubjects, autresTotal)}
      <tr class="total">
        <td>Totaux généraux</td>
        <td class="num"></td>
        <td class="num">${grandTotal.coeff}</td>
        <td class="num">${fmt2(grandTotal.weighted)}</td>
        <td class="num"></td>
        <td></td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <!-- Synthèse du trimestre -->
  <div class="bilan-grid">
    <div class="bilan-card">
      <h3>Assiduité</h3>
      <div class="body">
        <div class="bilan-item"><span>Total d'heures d'absence</span><span class="v">${totalAbsenceHours.toFixed(1)}</span></div>
        <div class="bilan-item"><span>Justifiées</span><span class="v">${justifiedAbsences.toFixed(1)}</span></div>
        <div class="bilan-item"><span>Non justifiées</span><span class="v ${unjustifiedAbsences > 0 ? 'bad' : ''}">${unjustifiedAbsences.toFixed(1)}</span></div>
      </div>
    </div>
    <div class="bilan-card">
      <h3>Résultat de l'élève</h3>
      <div class="body">
        <div class="mg">
          <div class="val ${noteCls(generalAverage)}">${fmt2(generalAverage)}<small> / 20</small></div>
        </div>
        <div class="bilan-item"><span>Rang</span><span class="v">${studentRank > 0 ? `${rankLabel(studentRank)} sur ${effectif}` : ''}</span></div>
      </div>
    </div>
    <div class="bilan-card">
      <h3>Résultats de la classe</h3>
      <div class="body">
        <div class="bilan-item"><span>Moyenne de classe</span><span class="v">${fmt2(classAverage)}</span></div>
        <div class="bilan-item"><span>Plus forte moyenne</span><span class="v">${fmt2(classMax)}</span></div>
        <div class="bilan-item"><span>Plus faible moyenne</span><span class="v">${fmt2(classMin)}</span></div>
      </div>
    </div>
  </div>

  <!-- Mentions du conseil de classe -->
  <div class="mentions-section">
    <h3>Mentions du conseil de classe</h3>
    <div class="mentions-grid">
      <div>
        <span class="lbl">Distinctions</span>
        ${checkLine(distinction === 'felicitations', "Tableau d'honneur + Félicitations")}
        ${checkLine(distinction === 'tableauHonneur', "Tableau d'honneur")}
      </div>
      <div>
        <span class="lbl">Sanctions</span>
        ${checkLine(blameTravail, 'Blâme Travail')}
        ${checkLine(blameConduite, 'Blâme conduite')}
      </div>
      <div>
        <span class="lbl">Appréciation générale</span>
        <div class="appr-general">${generalMention}</div>
      </div>
    </div>
  </div>

  ${
    annualReport
      ? `
  <!-- Bilan de fin d'année — uniquement sur le bulletin du dernier trimestre -->
  <div class="annual-section">
    <h3>Bilan de fin d'année</h3>
    <div class="annual-grid">
      <div>
        <span class="lbl">Récapitulatif</span>
        ${annualReport.trimesters
          .map(
            (t) => `
        <div class="annual-item"><span>Moyenne du ${t.label}</span><span class="v">${fmt2(t.weighted)} <small>/${t.max}</small></span></div>`,
          )
          .join('')}
        <div class="annual-item strong"><span>Moyenne générale annuelle</span><span class="v ${noteCls(
          annualReport.average,
        )}">${fmt2(annualReport.average)} <small>/20</small></span></div>
        <div class="annual-item"><span>Rang annuel</span><span class="v">${
          annualReport.rank > 0 ? `${rankLabel(annualReport.rank)} sur ${effectif}` : ''
        }</span></div>
      </div>
      <div>
        <span class="lbl">Décision de fin d'année</span>
        ${
          annualReport.average > 0
            ? `<div class="decision ${annualReport.admitted ? 'ok' : 'ko'}">${
                annualReport.admitted ? 'ADMIS(E) EN CLASSE SUPÉRIEURE' : 'REDOUBLE'
              }</div>`
            : '<div class="decision"></div>'
        }
      </div>
    </div>
  </div>`
      : ''
  }

  <!-- Pied de page -->
  <div class="footer">
    <div class="visa">
      <div class="date">Fait à Larabia, le ${today}</div>
      <div class="who">Le Directeur des Études</div>
    </div>
  </div>
</div>
`;

    return { student, semester, styles, watermark, body };
  }

  /**
   * Assemble un document A4 à partir de N bulletins et le rend en PDF.
   * Les styles et le filigrane (`position: fixed`) ne sont écrits qu'une fois ;
   * le saut de page entre bulletins est porté par la règle CSS `.sheet + .sheet`.
   */
  private static async renderBulletinDocument(
    title: string,
    styles: string,
    watermark: string,
    bodies: string[],
    fileName: string
  ): Promise<string> {
    await this.ensureUploadsDir();
    const filePath = path.join(this.completeAveragesDir, fileName);

    const htmlTemplate = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
${styles}
  </style>
</head>
<body>
  ${watermark}
  ${bodies.join('\n')}
</body>
</html>
    `;

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      // Une classe entière fait plusieurs dizaines de pages : le délai par défaut
      // (30 s) suffit pour un bulletin, pas toujours pour trente.
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0', timeout: 120_000 });

      await page.pdf({
        path: filePath,
        format: 'A4',
        landscape: false, // Portrait format
        margin: {
          top: '10mm',
          right: '9mm',
          bottom: '10mm',
          left: '9mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
        timeout: 120_000,
      });

      await browser.close();

      console.log(`✅ Bulletin PDF generated: ${filePath}`);
      return `/uploads/complete-averages/${fileName}`;
    } catch (error: any) {
      if (browser) {
        await browser.close();
      }
      console.error('Error generating bulletin PDF:', error);
      throw new Error(`Failed to generate bulletin PDF: ${error.message}`);
    }
  }

  /**
   * Bulletin trimestriel d'un élève.
   * `generatedAt` est la date de publication des bulletins de la classe (table
   * `bulletin_releases`) : c'est elle qui est imprimée sur le document. À défaut
   * (prévisualisation admin avant publication), on retombe sur la date du jour.
   */
  static async generateStudentBulletinPDF(
    studentId: string,
    classId: string,
    semesterId: string,
    academicYearId: string,
    generatedAt?: Date
  ): Promise<string> {
    const { student, semester, styles, watermark, body } = await this.buildStudentBulletin(
      studentId,
      classId,
      semesterId,
      academicYearId,
      generatedAt
    );

    const fileName = `bulletin-${student.firstName}-${student.lastName}-${semester.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;

    return this.renderBulletinDocument(
      `Bulletin Trimestriel - ${student.firstName} ${student.lastName}`,
      styles,
      watermark,
      [body],
      fileName
    );
  }

  /**
   * Bulletins de tous les élèves d'une classe pour un trimestre, dans un seul
   * PDF (un bulletin par page), prêt à imprimer. Un seul Chrome est lancé pour
   * l'ensemble : c'est ce qui rend la génération d'une classe entière tenable.
   */
  static async generateClassBulletinsPDF(
    classId: string,
    semesterId: string,
    academicYearId: string,
    generatedAt?: Date
  ): Promise<{ path: string; count: number }> {
    const students = await prisma.student.findMany({
      where: { classId },
      select: { id: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    if (students.length === 0) {
      throw new Error('Aucun élève dans cette classe');
    }

    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: classId },
      select: { name: true },
    });

    const bulletins = [];
    for (const s of students) {
      // Séquentiel et non `Promise.all` : chaque bulletin fait une dizaine de
      // requêtes, et une classe entière en parallèle sature le pool Prisma.
      bulletins.push(
        await this.buildStudentBulletin(s.id, classId, semesterId, academicYearId, generatedAt)
      );
    }

    const { styles, watermark, semester } = bulletins[0];
    const slug = (v: string) => v.replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `bulletins-${slug(schoolClass?.name || 'classe')}-${slug(semester.name)}-${Date.now()}.pdf`;

    const pdfPath = await this.renderBulletinDocument(
      `Bulletins ${schoolClass?.name || ''} - ${semester.name}`,
      styles,
      watermark,
      bulletins.map((b) => b.body),
      fileName
    );

    return { path: pdfPath, count: bulletins.length };
  }
}
