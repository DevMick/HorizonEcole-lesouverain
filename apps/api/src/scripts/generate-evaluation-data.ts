import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@school/database';
import { EvaluationTypeService } from '../services/evaluationType.service';
import { GradeService } from '../services/grade.service';
import crypto from 'crypto';

// Charger les variables d'environnement
// Essayer plusieurs chemins possibles
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envPath of possibleEnvPaths) {
  dotenv.config({ path: envPath });
  if (process.env.DATABASE_URL) {
    console.log(`✅ Variables d'environnement chargées depuis: ${envPath}`);
    break;
  }
}

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL non trouvé. Le script peut échouer.');
}

/**
 * Script pour générer des types d'évaluation et des notes pour tous les enseignants
 * 
 * Étapes :
 * 1. Récupérer tous les enseignants
 * 2. Créer des types d'évaluation pour chaque enseignant (2-5 types, au moins un devoir)
 * 3. Créer des notes pour chaque enseignant en fonction de leurs types d'évaluation
 *    - Pour le trimestre actif (Premier Trimestre : 08/09/2025 - 28/11/2025)
 */

// Types d'évaluation possibles
const EVALUATION_TYPES = [
  { name: 'Devoir N1', maxNote: 20 },
  { name: 'Devoir N2', maxNote: 20 },
  { name: 'Interrogation 1', maxNote: 10 },
  { name: 'Interrogation 2', maxNote: 10 },
  { name: 'Interrogation 3', maxNote: 10 },
];

// Fonction pour générer un nombre aléatoire entre min et max (inclus)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fonction pour générer une note aléatoire entre 0 et maxNote
function randomNote(maxNote: number): number {
  // Générer une note entre 5 et maxNote (pour avoir des notes réalistes)
  const minNote = 5;
  const max = maxNote;
  return Math.round((Math.random() * (max - minNote) + minNote) * 100) / 100;
}

// Fonction pour sélectionner aléatoirement des types d'évaluation (au moins un devoir)
function selectEvaluationTypes(): Array<{ name: string; maxNote: number }> {
  // Toujours inclure au moins un devoir
  const devoirs = [
    { name: 'Devoir N1', maxNote: 20 },
    { name: 'Devoir N2', maxNote: 20 },
  ];
  
  // Sélectionner aléatoirement 1 ou 2 devoirs
  const selectedDevoirs: Array<{ name: string; maxNote: number }> = [];
  const numDevoirs = randomInt(1, 2);
  
  if (numDevoirs === 1) {
    selectedDevoirs.push(devoirs[randomInt(0, 1)]);
  } else {
    selectedDevoirs.push(...devoirs);
  }
  
  // Sélectionner 0 à 3 interrogations
  const interrogations = [
    { name: 'Interrogation 1', maxNote: 10 },
    { name: 'Interrogation 2', maxNote: 10 },
    { name: 'Interrogation 3', maxNote: 10 },
  ];
  
  const numInterrogations = randomInt(0, 3);
  const selectedInterrogations = [];
  
  if (numInterrogations > 0) {
    const shuffled = [...interrogations].sort(() => Math.random() - 0.5);
    selectedInterrogations.push(...shuffled.slice(0, numInterrogations));
  }
  
  return [...selectedDevoirs, ...selectedInterrogations];
}

async function generateEvaluationData() {
  console.log('🚀 Début de la génération des données d\'évaluation...\n');
  
  try {
    // Étape 1: Récupérer l'année académique actuelle
    console.log('📅 Étape 1: Récupération de l\'année académique actuelle...');
    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    });
    
    if (!currentAcademicYear) {
      throw new Error('Aucune année académique actuelle trouvée');
    }
    
    console.log(`✅ Année académique trouvée: ${currentAcademicYear.name} (${currentAcademicYear.id})\n`);
    
    // Étape 2: Récupérer le trimestre actif (Premier Trimestre)
    console.log('📅 Étape 2: Récupération du trimestre actif...');
    const activeSemester = await prisma.semesters.findFirst({
      where: {
        academic_year_id: currentAcademicYear.id,
        name: {
          contains: 'Premier',
          mode: 'insensitive',
        },
      },
    });
    
    if (!activeSemester) {
      throw new Error('Trimestre actif (Premier Trimestre) non trouvé');
    }
    
    console.log(`✅ Trimestre actif trouvé: ${activeSemester.name} (${activeSemester.id})`);
    console.log(`   Dates: ${activeSemester.start_date.toISOString().split('T')[0]} - ${activeSemester.end_date.toISOString().split('T')[0]}\n`);
    
    // Étape 3: Récupérer tous les enseignants
    console.log('👨‍🏫 Étape 3: Récupération de tous les enseignants...');
    const teachers = await prisma.teachers.findMany({
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });
    
    if (teachers.length === 0) {
      throw new Error('Aucun enseignant trouvé dans la base de données');
    }
    
    console.log(`✅ ${teachers.length} enseignant(s) trouvé(s)\n`);
    
    let totalEvaluationTypesCreated = 0;
    let totalGradesCreated = 0;
    
    // Étape 4: Pour chaque enseignant
    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`👨‍🏫 Enseignant ${i + 1}/${teachers.length}: ${teacher.first_name} ${teacher.last_name}`);
      console.log(`${'='.repeat(80)}`);
      
      // 4.1: Créer les types d'évaluation pour cet enseignant
      console.log(`\n📝 Étape 4.1: Création des types d'évaluation...`);
      const selectedTypes = selectEvaluationTypes();
      const createdEvaluationTypes: Array<{ id: string; name: string; maxNote: number }> = [];
      
      for (const type of selectedTypes) {
        try {
          // Vérifier si le type existe déjà pour cet enseignant
          const existing = await prisma.evaluation_types.findFirst({
            where: {
              teacher_id: teacher.id,
              name: type.name,
            },
          });
          
          if (existing) {
            console.log(`   ⏭️  Type "${type.name}" existe déjà, ignoré`);
            createdEvaluationTypes.push({ id: existing.id, name: type.name, maxNote: type.maxNote });
          } else {
            const evaluationType = await EvaluationTypeService.create({
              name: type.name,
              teacherId: teacher.id,
            });
            console.log(`   ✅ Type "${type.name}" créé (${evaluationType.id})`);
            createdEvaluationTypes.push({ id: evaluationType.id, name: type.name, maxNote: type.maxNote });
            totalEvaluationTypesCreated++;
          }
        } catch (error: any) {
          console.error(`   ❌ Erreur lors de la création du type "${type.name}":`, error.message);
        }
      }
      
      console.log(`   📊 Total types d'évaluation pour ${teacher.first_name} ${teacher.last_name}: ${createdEvaluationTypes.length}`);
      
      // 4.2: Récupérer les assignments (classes/matières) de l'enseignant
      console.log(`\n📚 Étape 4.2: Récupération des assignments (classes/matières)...`);
      const assignments = await GradeService.getTeacherAssignments(teacher.id, currentAcademicYear.id);
      
      if (assignments.length === 0) {
        console.log(`   ⚠️  Aucun assignment trouvé pour ${teacher.first_name} ${teacher.last_name}, passage au suivant...`);
        continue;
      }
      
      console.log(`   ✅ ${assignments.length} assignment(s) trouvé(s)`);
      
      // 4.3: Pour chaque assignment (classe/matière)
      for (const assignment of assignments) {
        // Les assignments ont class_id et subject_id directement
        const assignmentData = assignment as any;
        const classId = assignmentData.class_id;
        const subjectId = assignmentData.subject_id;
        
        if (!classId || !subjectId) {
          console.log(`   ⚠️  Assignment invalide (classId ou subjectId manquant), passage au suivant...`);
          continue;
        }
        
        console.log(`\n   📖 Classe: ${assignment.class?.name || 'N/A'}, Matière: ${assignment.subject?.name || 'N/A'}`);
        
        // Récupérer les étudiants de cette classe
        const students = await prisma.student.findMany({
          where: {
            classId: classId,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true,
            classId: true,
          },
        });
        
        if (students.length === 0) {
          console.log(`      ⚠️  Aucun étudiant trouvé dans cette classe, passage au suivant...`);
          continue;
        }
        
        console.log(`      👥 ${students.length} étudiant(s) trouvé(s)`);
        
        // 4.4: Créer des notes pour chaque étudiant avec chaque type d'évaluation
        console.log(`      📝 Création des notes...`);
        let gradesCreatedForAssignment = 0;
        
        for (const student of students) {
          for (const evaluationType of createdEvaluationTypes) {
            try {
              // Vérifier si une note existe déjà pour cette combinaison
              const existingGrade = await prisma.grades.findFirst({
                where: {
                  academic_year_id: currentAcademicYear.id,
                  teacher_id: teacher.id,
                  subject_id: subjectId,
                  semester_id: activeSemester.id,
                  student_id: student.id,
                  class_id: classId,
                  evaluation_type_id: evaluationType.id,
                },
              });
              
              if (existingGrade) {
                // Note existe déjà, on la passe
                continue;
              }
              
              // Générer une note aléatoire
              const note = randomNote(evaluationType.maxNote);
              
              // Créer la note
              await GradeService.create({
                academicYearId: currentAcademicYear.id,
                teacherId: teacher.id,
                subjectId: subjectId,
                semesterId: activeSemester.id,
                studentId: student.id,
                classId: classId,
                evaluationTypeId: evaluationType.id,
                note: note,
                maxNote: evaluationType.maxNote,
              });
              
              gradesCreatedForAssignment++;
              totalGradesCreated++;
            } catch (error: any) {
              console.error(`         ❌ Erreur lors de la création de la note pour ${student.firstName} ${student.lastName} (${evaluationType.name}):`, error.message);
            }
          }
        }
        
        console.log(`      ✅ ${gradesCreatedForAssignment} note(s) créée(s) pour cette classe/matière`);
      }
    }
    
    // Résumé final
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RÉSUMÉ FINAL');
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ Types d'évaluation créés: ${totalEvaluationTypesCreated}`);
    console.log(`✅ Notes créées: ${totalGradesCreated}`);
    console.log(`✅ Enseignants traités: ${teachers.length}`);
    console.log(`${'='.repeat(80)}\n`);
    
    console.log('🎉 Génération terminée avec succès !\n');
    
  } catch (error: any) {
    console.error('\n❌ Erreur lors de la génération:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  generateEvaluationData()
    .then(() => {
      console.log('✅ Script terminé');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
}

export { generateEvaluationData };

