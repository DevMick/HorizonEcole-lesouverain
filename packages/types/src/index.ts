/**
 * Catalogue canonique des clés de menu affectables à un rôle personnalisé.
 * Source de vérité utilisée par le backend pour maintenir automatiquement à
 * jour le rôle protégé « Administrateur » (voir apps/api/src/routes/roles.ts
 * et apps/api/src/routes/auth.ts). Reflète exactement les entrées de
 * `apps/web/src/lib/navigation/menu-catalog.ts` — toute nouvelle entrée de
 * menu doit être ajoutée aux deux endroits.
 */
export const ALL_MENU_KEYS: string[] = [
  '/dashboard',
  '/people/students',
  '/people/parents',
  '/people/teachers',
  '/people/roles',
  '/people/users',
  '/academic/years',
  '/academic/inscriptions',
  '/people/classrooms',
  '/academic/timetable',
  '/academic/attendance',
  '/academic/uncalled-sessions',
  '/academic/classes',
  '/academic/subjects',
  '/academic/assignments',
  '/academic/coefficients',
  '/academic/class-grades',
  '/academic/conduct',
  '/academic/complete-averages',
];

/** Nom du rôle système protégé, créé automatiquement et affecté à tous les menus. */
export const PROTECTED_ADMIN_ROLE_NAME = 'Administrateur';

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  SECRETARY = 'SECRETARY',
  ACCOUNTANT = 'ACCOUNTANT',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT',
  STAFF = 'STAFF'
}

// Student types
export interface Student {
  id: string;
  userId?: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  placeOfBirth?: string;
  gender: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  bloodType?: string;
  allergies?: string;
  medicalNotes?: string;
  classId?: string;
  enrollmentDate: Date;
  status: StudentStatus;
  birthCertificateUrl?: string;
  vaccinationCardUrl?: string;
  previousSchoolReportUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  class?: SchoolClass;
  studentParents?: StudentParent[];
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  GRADUATED = 'GRADUATED',
  TRANSFERRED = 'TRANSFERRED',
  EXPELLED = 'EXPELLED'
}

export enum ParentRelation {
  PERE = 'PERE',
  MERE = 'MERE',
  TUTEUR = 'TUTEUR',
  AUTRE = 'AUTRE'
}

export interface Parent {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  relation: ParentRelation;
  phone: string;
  email?: string;
  address?: string;
  profession?: string;
  workplace?: string;
  isPrimaryContact: boolean;
  isFinancialResponsible: boolean;
  createdAt: Date;
  studentParents?: StudentParent[];
}

export interface StudentParent {
  id: string;
  studentId: string;
  parentId: string;
  student?: Student;
  parent?: Parent;
}

// Class types
export interface Class {
  id: string;
  name: string;
  level: string;
  academicYear: string;
  teacherId?: string;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Academic Year types
export interface AcademicYear {
  id: string;
  year: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Subject types
export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  credits: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Grade types - Using new comprehensive grade system
// See full Grade interface in Grades section below

// Financial types
export interface Fee {
  id: string;
  name: string;
  amount: number;
  type: FeeType;
  academicYearId: string;
  dueDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum FeeType {
  TUITION = 'TUITION',
  REGISTRATION = 'REGISTRATION',
  EXAM = 'EXAM',
  TRANSPORT = 'TRANSPORT',
  UNIFORM = 'UNIFORM',
  OTHER = 'OTHER'
}

export interface Payment {
  id: string;
  studentId: string;
  feeId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
  MOBILE_MONEY = 'MOBILE_MONEY'
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

// Form types - keeping for compatibility, use new Student request types below

// Dashboard types
export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

// Search and filter types
export interface SearchFilters {
  query?: string;
  status?: string;
  classId?: string;
  academicYearId?: string;
  page?: number;
  limit?: number;
}

// Staff types
export interface Staff {
  id: string;
  userId?: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  nationality?: string;
  idCardNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  function: StaffFunction;
  specialization?: string;
  contractType: ContractType;
  hireDate: Date;
  endDate?: Date;
  baseSalary: number;
  cvUrl?: string;
  diplomaUrl?: string;
  contractUrl?: string;
  idCardUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ContractType {
  CDI = 'CDI',
  CDD = 'CDD',
  VACATAIRE = 'VACATAIRE',
  BENEVOLAT = 'BENEVOLAT'
}

export enum StaffFunction {
  ENSEIGNANT = 'ENSEIGNANT',
  DIRECTEUR = 'DIRECTEUR',
  SURVEILLANT = 'SURVEILLANT',
  SECRETAIRE = 'SECRETAIRE',
  COMPTABLE = 'COMPTABLE',
  MAINTENANCE = 'MAINTENANCE'
}

export interface StaffSalary {
  id: string;
  staffId: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  overtimeHours: number;
  overtimeRate: number;
  bonuses: number;
  deductions: number;
  cnpsEmployee: number;
  cnpsEmployer: number;
  incomeTax: number;
  grossSalary: number;
  netSalary: number;
  paymentDate?: Date;
  status: SalaryStatus;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  staff?: Staff;
}

export enum SalaryStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PAID = 'PAID'
}

export interface CreateStaffRequest {
  userId?: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality?: string;
  idCardNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  function: StaffFunction;
  specialization?: string;
  contractType: ContractType;
  hireDate: string;
  endDate?: string;
  baseSalary: number;
}

export interface UpdateStaffRequest extends Partial<CreateStaffRequest> {
  id: string;
  isActive?: boolean;
}

export interface CreateStaffSalaryRequest {
  staffId: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  bonuses?: number;
  deductions?: number;
  cnpsEmployee?: number;
  cnpsEmployer?: number;
  incomeTax?: number;
  notes?: string;
}

export interface UpdateStaffSalaryRequest extends Partial<CreateStaffSalaryRequest> {
  id: string;
  status?: SalaryStatus;
  paymentDate?: string;
}

export interface StaffFilters extends SearchFilters {
  function?: StaffFunction;
  contractType?: ContractType;
  isActive?: boolean;
}

export interface SalaryFilters extends SearchFilters {
  staffId?: string;
  month?: number;
  year?: number;
  status?: SalaryStatus;
}

// Academic types
export interface AcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  createdAt: Date;
}

export enum AcademicLevel {
  SIXIEME = 'SIXIEME',
  CINQUIEME = 'CINQUIEME',
  QUATRIEME = 'QUATRIEME',
  TROISIEME = 'TROISIEME'
}

export interface SchoolClass {
  id: string;
  academicYearId: string;
  name: string;
  level: AcademicLevel;
  maxStudents: number;
  mainTeacherId?: string;
  createdAt: Date;
  academicYear?: AcademicYear;
  mainTeacher?: Staff;
  classSubjects?: ClassSubject[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  description?: string;
  createdAt: Date;
}

export interface ClassSubject {
  id: string;
  classId: string;
  subjectId: string;
  teacherId?: string;
  hoursPerWeek: number;
  class?: SchoolClass;
  subject?: Subject;
  teacher?: Staff;
}

// Request types for Academic entities
export interface CreateAcademicYearRequest {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

export interface UpdateAcademicYearRequest extends Partial<CreateAcademicYearRequest> {
  id: string;
}

export interface CreateClassRequest {
  academicYearId: string;
  name: string;
  level: AcademicLevel;
  maxStudents?: number;
  mainTeacherId?: string;
}

export interface UpdateClassRequest extends Partial<CreateClassRequest> {
  id: string;
}

export interface CreateSubjectRequest {
  name: string;
  code: string;
  coefficient?: number;
  description?: string;
}

export interface UpdateSubjectRequest extends Partial<CreateSubjectRequest> {
  id: string;
}

export interface CreateClassSubjectRequest {
  classId: string;
  subjectId: string;
  teacherId?: string;
  hoursPerWeek?: number;
}

export interface UpdateClassSubjectRequest extends Partial<CreateClassSubjectRequest> {
  id: string;
}

// Filter types
export interface AcademicYearFilters extends SearchFilters {
  isCurrent?: boolean;
}

export interface ClassFilters extends SearchFilters {
  academicYearId?: string;
  level?: AcademicLevel;
  mainTeacherId?: string;
}

export interface SubjectFilters extends SearchFilters {
  code?: string;
}

export interface ClassSubjectFilters extends SearchFilters {
  classId?: string;
  subjectId?: string;
  teacherId?: string;
}

// Request types for Students
export interface CreateStudentRequest {
  userId?: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  gender: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodType?: string;
  allergies?: string;
  medicalNotes?: string;
  classId?: string;
  enrollmentDate: string;
  parents?: CreateParentRequest[];
}

export interface UpdateStudentRequest extends Partial<CreateStudentRequest> {
  id: string;
  status?: StudentStatus;
}

export interface CreateParentRequest {
  id?: string; // If existing parent
  userId?: string;
  firstName: string;
  lastName: string;
  relation: ParentRelation;
  phone: string;
  email?: string;
  address?: string;
  profession?: string;
  workplace?: string;
  isPrimaryContact?: boolean;
  isFinancialResponsible?: boolean;
}

export interface UpdateParentRequest extends Partial<CreateParentRequest> {
  id: string;
}

// Filter types
export interface StudentFilters extends SearchFilters {
  classId?: string;
  status?: StudentStatus;
  gender?: string;
  academicYearId?: string;
}

export interface ParentFilters extends SearchFilters {
  relation?: ParentRelation;
  isPrimaryContact?: boolean;
  isFinancialResponsible?: boolean;
}

// Schedule types
export interface Schedule {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number; // 1=Monday, 5=Friday
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  room?: string;
  academicYearId: string;
  isActive: boolean;
  createdAt: Date;
  class?: SchoolClass;
  subject?: Subject;
  teacher?: Staff;
  academicYear?: AcademicYear;
  exceptions?: ScheduleException[];
}

export interface ScheduleException {
  id: string;
  scheduleId: string;
  date: Date;
  replacementTeacherId?: string;
  isCancelled: boolean;
  reason?: string;
  createdBy?: string;
  createdAt: Date;
  schedule?: Schedule;
  replacementTeacher?: Staff;
}

export interface CreateScheduleRequest {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  academicYearId: string;
}

export interface UpdateScheduleRequest extends Partial<CreateScheduleRequest> {
  id: string;
  isActive?: boolean;
}

export interface CreateScheduleExceptionRequest {
  scheduleId: string;
  date: string;
  replacementTeacherId?: string;
  isCancelled?: boolean;
  reason?: string;
}

export interface UpdateScheduleExceptionRequest extends Partial<CreateScheduleExceptionRequest> {
  id: string;
}

export interface ScheduleFilters extends SearchFilters {
  classId?: string;
  teacherId?: string;
  subjectId?: string;
  dayOfWeek?: number;
  academicYearId?: string;
  isActive?: boolean;
}

export interface ScheduleExceptionFilters extends SearchFilters {
  scheduleId?: string;
  date?: string;
  isCancelled?: boolean;
}

export interface ScheduleConflict {
  hasConflict: boolean;
  conflictType?: 'TEACHER' | 'ROOM' | 'CLASS';
  conflictingSchedule?: Schedule;
  message?: string;
}

// Grades and Report Cards types
export enum GradeType {
  DEVOIR = 'DEVOIR',
  COMPOSITION = 'COMPOSITION',
  INTERROGATION = 'INTERROGATION',
  ORAL = 'ORAL',
  PRATIQUE = 'PRATIQUE'
}

export enum Trimester {
  PREMIER = 'PREMIER',
  DEUXIEME = 'DEUXIEME',
  TROISIEME = 'TROISIEME'
}

export enum Mention {
  EXCELLENT = 'EXCELLENT',
  TRES_BIEN = 'TRES_BIEN',
  BIEN = 'BIEN',
  ASSEZ_BIEN = 'ASSEZ_BIEN',
  PASSABLE = 'PASSABLE',
  INSUFFISANT = 'INSUFFISANT'
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  teacherId?: string;
  classId: string;
  gradeType: GradeType;
  value: number;
  maxValue: number;
  coefficient: number;
  date: Date;
  trimester: Trimester;
  academicYearId: string;
  title?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  student?: Student;
  subject?: Subject;
  teacher?: Staff;
  class?: SchoolClass;
  academicYear?: AcademicYear;
}

export interface ReportCard {
  id: string;
  studentId: string;
  classId: string;
  trimester: Trimester;
  academicYearId: string;
  generalAverage?: number;
  classRank?: number;
  totalStudents?: number;
  mention?: Mention;
  teacherComment?: string;
  principalComment?: string;
  absencesCount: number;
  lateCount: number;
  generatedAt: Date;
  generatedBy?: string;
  student?: Student;
  class?: SchoolClass;
  academicYear?: AcademicYear;
  subjects?: ReportCardSubject[];
}

export interface ReportCardSubject {
  id: string;
  reportCardId: string;
  subjectId: string;
  average?: number;
  coefficient?: number;
  weightedAverage?: number;
  teacherComment?: string;
  reportCard?: ReportCard;
  subject?: Subject;
}

// Request types
export interface CreateGradeRequest {
  studentId: string;
  subjectId: string;
  teacherId?: string;
  classId: string;
  gradeType: GradeType;
  value: number;
  maxValue?: number;
  coefficient?: number;
  date: string;
  trimester: Trimester;
  academicYearId: string;
  title?: string;
  notes?: string;
}

export interface UpdateGradeRequest extends Partial<CreateGradeRequest> {
  id: string;
}

export interface CreateReportCardRequest {
  studentId: string;
  classId: string;
  trimester: Trimester;
  academicYearId: string;
  teacherComment?: string;
  principalComment?: string;
  absencesCount?: number;
  lateCount?: number;
}

export interface UpdateReportCardRequest extends Partial<CreateReportCardRequest> {
  id: string;
  generalAverage?: number;
  classRank?: number;
  mention?: Mention;
}

// Filter types
export interface GradeFilters extends SearchFilters {
  studentId?: string;
  subjectId?: string;
  teacherId?: string;
  classId?: string;
  gradeType?: GradeType;
  trimester?: Trimester;
  academicYearId?: string;
}

export interface ReportCardFilters extends SearchFilters {
  studentId?: string;
  classId?: string;
  trimester?: Trimester;
  academicYearId?: string;
  mention?: Mention;
}

// Attendance types
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED'
}

export enum TimePeriod {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON'
}

export interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: Date;
  period: TimePeriod;
  status: AttendanceStatus;
  excuse?: string;
  isJustified: boolean;
  justificationDocumentUrl?: string;
  recordedBy?: string;
  recordedAt: Date;
  student?: Student;
  class?: SchoolClass;
}

export interface AttendanceSummary {
  id: string;
  studentId: string;
  month: number;
  year: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendanceRate?: number;
  createdAt: Date;
  student?: Student;
}

export interface CreateAttendanceRequest {
  studentId: string;
  classId: string;
  date: string;
  period: TimePeriod;
  status: AttendanceStatus;
  excuse?: string;
  isJustified?: boolean;
  justificationDocumentUrl?: string;
}

export interface UpdateAttendanceRequest extends Partial<CreateAttendanceRequest> {
  id: string;
}

export interface BulkAttendanceRequest {
  classId: string;
  date: string;
  period: TimePeriod;
  attendances: Array<{
    studentId: string;
    status: AttendanceStatus;
    excuse?: string;
  }>;
}

export interface AttendanceFilters extends SearchFilters {
  studentId?: string;
  classId?: string;
  date?: string;
  period?: TimePeriod;
  status?: AttendanceStatus;
  startDate?: string;
  endDate?: string;
}

export interface AttendanceSummaryFilters extends SearchFilters {
  studentId?: string;
  month?: number;
  year?: number;
}

// Discipline types
export enum IncidentSeverity {
  MINEUR = 'MINEUR',
  MOYEN = 'MOYEN',
  GRAVE = 'GRAVE',
  TRES_GRAVE = 'TRES_GRAVE'
}

export enum SanctionType {
  AVERTISSEMENT = 'AVERTISSEMENT',
  BLAME = 'BLAME',
  EXCLUSION_TEMPORAIRE = 'EXCLUSION_TEMPORAIRE',
  EXCLUSION_DEFINITIVE = 'EXCLUSION_DEFINITIVE',
  CONVOCATION_PARENTS = 'CONVOCATION_PARENTS',
  TRAVAUX_INTERET_GENERAL = 'TRAVAUX_INTERET_GENERAL'
}

export interface DisciplinaryIncident {
  id: string;
  studentId: string;
  date: Date;
  time?: string;
  location?: string;
  description: string;
  severity: IncidentSeverity;
  reportedBy?: string;
  witnesses?: string;
  createdAt: Date;
  student?: Student;
  reporter?: Staff;
  sanctions?: Sanction[];
}

export interface Sanction {
  id: string;
  incidentId: string;
  studentId: string;
  sanctionType: SanctionType;
  description: string;
  startDate: Date;
  endDate?: Date;
  isExecuted: boolean;
  executionNotes?: string;
  decidedBy?: string;
  createdAt: Date;
  incident?: DisciplinaryIncident;
  student?: Student;
}

export interface CreateDisciplinaryIncidentRequest {
  studentId: string;
  date: string;
  time?: string;
  location?: string;
  description: string;
  severity: IncidentSeverity;
  witnesses?: string;
}

export interface UpdateDisciplinaryIncidentRequest extends Partial<CreateDisciplinaryIncidentRequest> {
  id: string;
}

export interface CreateSanctionRequest {
  incidentId: string;
  studentId: string;
  sanctionType: SanctionType;
  description: string;
  startDate: string;
  endDate?: string;
}

export interface UpdateSanctionRequest extends Partial<CreateSanctionRequest> {
  id: string;
  isExecuted?: boolean;
  executionNotes?: string;
}

export interface DisciplinaryIncidentFilters extends SearchFilters {
  studentId?: string;
  severity?: IncidentSeverity;
  reportedBy?: string;
  startDate?: string;
  endDate?: string;
}

export interface SanctionFilters extends SearchFilters {
  studentId?: string;
  incidentId?: string;
  sanctionType?: SanctionType;
  isExecuted?: boolean;
  startDate?: string;
  endDate?: string;
}

// Document Management types
export enum DocumentType {
  CONTRAT = 'CONTRAT',
  DIPLOME = 'DIPLOME',
  CV = 'CV',
  PIECE_IDENTITE = 'PIECE_IDENTITE',
  ACTE_NAISSANCE = 'ACTE_NAISSANCE',
  CARNET_VACCINATION = 'CARNET_VACCINATION',
  BULLETIN = 'BULLETIN',
  RECU_PAIEMENT = 'RECU_PAIEMENT',
  FACTURE = 'FACTURE',
  AUTRE = 'AUTRE'
}

export type EntityType = 'student' | 'staff' | 'payment' | 'expense' | 'parent' | 'class' | 'other';

export interface Document {
  id: string;
  entityType: string;
  entityId: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  uploadedBy?: string;
  uploadedAt: Date;
}

export interface CreateDocumentRequest {
  entityType: EntityType;
  entityId: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
}

export interface UpdateDocumentRequest extends Partial<CreateDocumentRequest> {
  id: string;
}

export interface DocumentFilters extends SearchFilters {
  entityType?: string;
  entityId?: string;
  documentType?: DocumentType;
  uploadedBy?: string;
  startDate?: string;
  endDate?: string;
}

// Audit Log types
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'APPROVE' | 'REJECT' | 'OTHER';

export type ResourceType = 'student' | 'staff' | 'payment' | 'grade' | 'attendance' | 'schedule' | 'class' | 'subject' | 'user' | 'document' | 'other';

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
  user?: User;
}

export interface CreateAuditLogRequest {
  userId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

export interface AuditLogFilters extends SearchFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
}

// Notification types
export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ALERT = 'ALERT',
  SUCCESS = 'SUCCESS',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  link?: string;
  createdAt: Date;
  user?: User;
}

export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  link?: string;
}

export interface UpdateNotificationRequest extends Partial<CreateNotificationRequest> {
  id: string;
  isRead?: boolean;
  readAt?: Date;
}

export interface NotificationFilters extends SearchFilters {
  userId?: string;
  type?: NotificationType;
  channel?: NotificationChannel;
  isRead?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface BulkMarkReadRequest {
  notificationIds: string[];
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byChannel: Record<NotificationChannel, number>;
}