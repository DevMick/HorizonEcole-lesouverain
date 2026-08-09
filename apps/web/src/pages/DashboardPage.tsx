import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { DashboardBoard } from '../components/dashboard/DashboardBoard';
import { TeacherDashboardBoard, type TeacherClassGroup, type TodayCourse } from '../components/dashboard/TeacherDashboardBoard';

/**
 * Tableau de bord (§9.1 admin / §9.2 enseignant) — conteneur de données.
 * Re-skin « Encre & Craie ». Branche par rôle : l'enseignant a un tableau de
 * bord orienté « action rapide » (cours du jour, raccourcis, classes), l'admin
 * la vue pédagogique d'ensemble. Module paiement retiré → aucune carte finance.
 * Endpoints inchangés.
 */

const DAY_ENUM = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function AdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get('/dashboard/stats')).data.data || {},
  });
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['dashboard-activities'],
    queryFn: async () => (await api.get('/dashboard/activities')).data.data || {},
  });

  return (
    <DashboardBoard
      stats={stats ?? null}
      recentStudents={activities?.recentStudents || []}
      recentGrades={activities?.recentGrades || []}
      loading={statsLoading || activitiesLoading}
      isAdmin
      onNavigate={(path) => navigate(path)}
    />
  );
}

function TeacherDashboard() {
  const navigate = useNavigate();

  const { data: years } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  const currentYear = years?.find((y: any) => y.isCurrent) ?? years?.[0];

  const { data: info } = useQuery({
    queryKey: ['teacher-info'],
    queryFn: async () => (await api.get('/teachers/me/info')).data.data,
  });

  const { data: timetable, isLoading: ttLoading } = useQuery({
    queryKey: ['teacher-timetable-dash', currentYear?.id],
    queryFn: async () =>
      (await api.get(`/teachers/me/timetable${currentYear?.id ? `?academicYearId=${currentYear.id}` : ''}`)).data.data || [],
  });

  const { data: assignments, isLoading: asLoading } = useQuery({
    queryKey: ['teacher-assignments-dash', currentYear?.id],
    queryFn: async () =>
      (await api.get(`/teachers/me/assignments${currentYear?.id ? `?academicYearId=${currentYear.id}` : ''}`)).data.data || [],
  });

  const today = DAY_ENUM[new Date().getDay()];
  const courses: TodayCourse[] = (timetable || [])
    .filter((t: any) => t.day_of_week === today)
    .map((t: any) => ({
      id: t.id,
      startTime: t.start_time,
      endTime: t.end_time,
      subjectName: t.subject?.name,
      className: t.class?.name,
      roomName: t.classroom?.name,
    }));
  const classes: TeacherClassGroup[] = (assignments || []).map((g: any) => ({
    classId: g.class?.id,
    className: g.class?.name,
    subjects: (g.subjects || []).map((s: any) => ({ id: s.id, name: s.name })),
  }));
  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const teacherName = info ? `${info.firstName ?? ''} ${info.lastName ?? ''}`.trim() : undefined;

  return (
    <TeacherDashboardBoard
      teacherName={teacherName}
      todayLabel={todayLabel}
      courses={courses}
      classes={classes}
      loading={ttLoading || asLoading}
      onNavigate={(path) => navigate(path)}
    />
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  return <div className="animate-fade-in">{user?.role === 'TEACHER' ? <TeacherDashboard /> : <AdminDashboard />}</div>;
}
