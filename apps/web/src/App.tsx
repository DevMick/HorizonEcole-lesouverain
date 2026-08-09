import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import { roleHome, isParentRole, isStudentRole } from './lib/navigation/role-home';
import { useEffect } from 'react';
import { App as AntApp } from 'antd';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import ClassesPage from './pages/ClassesPage';
import SubjectsPage from './pages/SubjectsPage';
import AcademicYearsPage from './pages/AcademicYearsPage';
import AcademicYearDetailPage from './pages/AcademicYearDetailPage';
import SchoolClassesPage from './pages/SchoolClassesPage';
import SchoolClassDetailPage from './pages/SchoolClassDetailPage';
import SchoolSubjectsPage from './pages/SchoolSubjectsPage';
import InscriptionsPage from './pages/InscriptionsPage';
import CoefficientsPage from './pages/CoefficientsPage';
import SubjectAssignmentPage from './pages/SubjectAssignmentPage';
import TeachersPage from './pages/TeachersPage';
import RolesPage from './pages/RolesPage';
import PersonnelUsersPage from './pages/PersonnelUsersPage';
import TeacherDetailPage from './pages/TeacherDetailPage';
import ClassroomsPage from './pages/ClassroomsPage';
import TimetablePage from './pages/TimetablePage';
import StudentsListPage from './pages/StudentsListPage';
import StudentProfilePage from './pages/StudentProfilePage';
import ParentsListPage from './pages/ParentsListPage';
import ParentProfilePage from './pages/ParentProfilePage';
import TeacherClassesPage from './pages/TeacherClassesPage';
import TeacherTimetablePage from './pages/TeacherTimetablePage';
import TeacherAttendancePage from './pages/TeacherAttendancePage';
import TeacherMakeupPage from './pages/TeacherMakeupPage';
import AdminAttendancePage from './pages/AdminAttendancePage';
import AdminUncalledSessionsPage from './pages/AdminUncalledSessionsPage';
import GradesPage from './pages/GradesPage';
import EvaluationTypesPage from './pages/EvaluationTypesPage';
import GradesAveragesPage from './pages/GradesAveragesPage';
import CompleteAveragesPage from './pages/CompleteAveragesPage';
import ClassGradesPage from './pages/ClassGradesPage';
import ConductPage from './pages/ConductPage';
import DesignSystemPreviewPage from './pages/DesignSystemPreviewPage';
import DesignSystemGalleryPage from './pages/DesignSystemGalleryPage';
import DesignSystemNavPreviewPage from './pages/DesignSystemNavPreviewPage';
import DesignSystemAttendancePreviewPage from './pages/DesignSystemAttendancePreviewPage';
import DesignSystemGradesPreviewPage from './pages/DesignSystemGradesPreviewPage';
import DesignSystemDashboardPreviewPage from './pages/DesignSystemDashboardPreviewPage';
import DesignSystemStudentsPreviewPage from './pages/DesignSystemStudentsPreviewPage';
import DesignSystemTimetablePreviewPage from './pages/DesignSystemTimetablePreviewPage';
import DesignSystemInscriptionsPreviewPage from './pages/DesignSystemInscriptionsPreviewPage';
import DesignSystemEntityPreviewPage from './pages/DesignSystemEntityPreviewPage';
import DesignSystemRelationalPreviewPage from './pages/DesignSystemRelationalPreviewPage';
import ParentHomePage from './pages/ParentHomePage';
import ParentChildrenPage from './pages/ParentChildrenPage';
import ParentTimetablePage from './pages/ParentTimetablePage';
import ParentAttendancePage from './pages/ParentAttendancePage';
import ParentGradesPage from './pages/ParentGradesPage';
import ParentBulletinsPage from './pages/ParentBulletinsPage';
import StudentHomePage from './pages/StudentHomePage';
import StudentTimetablePage from './pages/StudentTimetablePage';
import StudentAttendancePage from './pages/StudentAttendancePage';
import StudentGradesPage from './pages/StudentGradesPage';
import StudentBulletinsPage from './pages/StudentBulletinsPage';

function App() {
  const { isAuthenticated, token, user } = useAuthStore();

  // Verify token exists in localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken && isAuthenticated) {
      // Token missing but state says authenticated - fix inconsistency
      useAuthStore.getState().logout();
    }
  }, [isAuthenticated]);

  // Check if token and isAuthenticated are in sync
  const hasValidAuth = isAuthenticated && (token || localStorage.getItem('token'));

  if (!hasValidAuth) {
    return (
      <AntApp>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Galerie DS — accessible sans auth en développement uniquement (§ Étape 2). */}
        {import.meta.env.DEV && (
          <Route path="/ds" element={<DesignSystemGalleryPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-nav" element={<DesignSystemNavPreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-attendance" element={<DesignSystemAttendancePreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-grades" element={<DesignSystemGradesPreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-dashboard" element={<DesignSystemDashboardPreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-students" element={<DesignSystemStudentsPreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-timetable" element={<DesignSystemTimetablePreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-inscriptions" element={<DesignSystemInscriptionsPreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-entity" element={<DesignSystemEntityPreviewPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ds-relational" element={<DesignSystemRelationalPreviewPage />} />
        )}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </AntApp>
    );
  }

  // Espace Famille : jeu de routes propre au parent. Aucune page d'administration
  // n'est montée ici — une route inconnue le ramène à son espace, jamais vers le
  // tableau de bord d'administration.
  if (isParentRole(user?.role)) {
    return (
      <AntApp>
        <Layout>
          <Routes>
            <Route path="/parent" element={<ParentHomePage />} />
            <Route path="/parent/children" element={<ParentChildrenPage />} />
            <Route path="/parent/timetable" element={<ParentTimetablePage />} />
            <Route path="/parent/attendance" element={<ParentAttendancePage />} />
            <Route path="/parent/grades" element={<ParentGradesPage />} />
            <Route path="/parent/bulletins" element={<ParentBulletinsPage />} />
            <Route path="*" element={<Navigate to="/parent" replace />} />
          </Routes>
        </Layout>
      </AntApp>
    );
  }

  // Ma Scolarité : jeu de routes propre à l'élève. Comme pour le parent, aucune
  // page d'administration n'est montée ici.
  if (isStudentRole(user?.role)) {
    return (
      <AntApp>
        <Layout>
          <Routes>
            <Route path="/student" element={<StudentHomePage />} />
            <Route path="/student/timetable" element={<StudentTimetablePage />} />
            <Route path="/student/attendance" element={<StudentAttendancePage />} />
            <Route path="/student/grades" element={<StudentGradesPage />} />
            <Route path="/student/bulletins" element={<StudentBulletinsPage />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </Layout>
      </AntApp>
    );
  }

  return (
    <AntApp>
      <Layout>
        <Routes>
        <Route path="/" element={<Navigate to={roleHome(user?.role)} replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/design-system-preview" element={<DesignSystemPreviewPage />} />
        
        {/* Academic Management */}
        <Route path="/academic/years" element={<AcademicYearsPage />} />
        <Route path="/academic/years/:id" element={<AcademicYearDetailPage />} />
        <Route path="/academic/classes" element={<SchoolClassesPage />} />
        <Route path="/academic/classes/:id" element={<SchoolClassDetailPage />} />
        <Route path="/academic/subjects" element={<SchoolSubjectsPage />} />
        <Route path="/academic/assignments" element={<SubjectAssignmentPage />} />
        <Route path="/academic/inscriptions" element={<InscriptionsPage />} />
        <Route path="/academic/coefficients" element={<CoefficientsPage />} />
        <Route path="/academic/timetable" element={<TimetablePage />} />
        <Route path="/academic/attendance" element={<AdminAttendancePage />} />
        <Route path="/academic/uncalled-sessions" element={<AdminUncalledSessionsPage />} />
        <Route path="/evaluations/types" element={<EvaluationTypesPage />} />
        <Route path="/evaluations/grades" element={<GradesPage />} />
        <Route path="/evaluations/averages" element={<GradesAveragesPage />} />
        <Route path="/academic/complete-averages" element={<CompleteAveragesPage />} />
        <Route path="/academic/class-grades" element={<ClassGradesPage />} />
        <Route path="/academic/conduct" element={<ConductPage />} />
        
        {/* Students */}
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        
        {/* People Management */}
        <Route path="/people/students" element={<StudentsListPage />} />
        <Route path="/people/students/:id" element={<StudentProfilePage />} />
        <Route path="/people/parents" element={<ParentsListPage />} />
        <Route path="/people/parents/:id" element={<ParentProfilePage />} />
        <Route path="/people/teachers" element={<TeachersPage />} />
        <Route path="/people/teachers/:id" element={<TeacherDetailPage />} />
        <Route path="/people/roles" element={<RolesPage />} />
        <Route path="/people/users" element={<PersonnelUsersPage />} />
        <Route path="/people/classrooms" element={<ClassroomsPage />} />
        
        {/* Teacher Pages */}
        <Route path="/teacher/my-classes" element={<TeacherClassesPage />} />
        <Route path="/teacher/my-timetable" element={<TeacherTimetablePage />} />
        <Route path="/teacher/attendance" element={<TeacherAttendancePage />} />
        <Route path="/teacher/makeup" element={<TeacherMakeupPage />} />

        {/* Old routes (legacy) */}
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </AntApp>
  );
}

export default App;
