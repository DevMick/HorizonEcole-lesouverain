import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Card, Tabs } from '../components/ds';
import { AttendanceSessionBoard } from '../components/attendance/AttendanceSessionBoard';
import { AttendanceHistory } from '../components/attendance/AttendanceHistory';

/**
 * Présence enseignant (§9.6) — appel par séance de cours (matière) synchronisé à
 * l'emploi du temps, avec numéro de séance auto-incrémenté, et onglet Historique.
 */
export default function TeacherAttendancePage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'call' | 'history'>('call');

  const { data: years } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  const currentYear = useMemo(() => years?.find((y: any) => y.isCurrent) ?? years?.[0], [years]);

  if (user?.role !== 'TEACHER') {
    return (
      <Card className="mx-auto max-w-md text-center" accent="info">
        <Users className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
        <p className="font-display text-base font-bold text-ds-text">Espace enseignant</p>
        <p className="mt-1 text-sm text-ds-text-secondary">La prise de présence est réservée aux comptes enseignant.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Présence</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Appel par séance de cours, synchronisé à votre emploi du temps.
        </p>
      </div>

      <Tabs
        className="mb-4"
        aria-label="Vues présence"
        value={tab}
        onChange={(k) => setTab(k as 'call' | 'history')}
        items={[
          { key: 'call', label: "Faire l'appel" },
          { key: 'history', label: 'Historique' },
        ]}
      />

      {tab === 'call' ? (
        <AttendanceSessionBoard academicYearId={currentYear?.id} />
      ) : (
        <AttendanceHistory years={years || []} currentYearId={currentYear?.id} />
      )}
    </div>
  );
}
