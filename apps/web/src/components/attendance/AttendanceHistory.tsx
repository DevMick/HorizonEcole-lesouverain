import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Select } from 'antd';
import { Eye, Hash } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, Card, Skeleton } from '../ds';
import { AttendanceSessionDetailModal } from './AttendanceSessionDetailModal';

interface Props {
  years: any[];
  currentYearId?: string;
}

/** Historique des présences par année / classe / matière / séance. */
export function AttendanceHistory({ years, currentYearId }: Props) {
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sessionNumber, setSessionNumber] = useState<number | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!yearId && currentYearId) setYearId(currentYearId);
  }, [currentYearId, yearId]);

  // Classes / matières de l'enseignant (dérivées de l'emploi du temps).
  const { data: timetable } = useQuery({
    queryKey: ['teacher-timetable', yearId],
    queryFn: async () => (await api.get(`/teachers/me/timetable?academicYearId=${yearId}`)).data.data || [],
    enabled: !!yearId,
  });

  const classes = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    (timetable || []).forEach((t: any) => t.class && m.set(t.class.id, t.class));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [timetable]);

  const subjects = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    (timetable || [])
      .filter((t: any) => !classId || t.class?.id === classId)
      .forEach((t: any) => t.subject && m.set(t.subject.id, t.subject));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [timetable, classId]);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['att-session-history', yearId, classId, subjectId],
    queryFn: async () =>
      (
        await api.get('/attendance-sessions', {
          params: { academicYearId: yearId, classId: classId || undefined, subjectId: subjectId || undefined, limit: 500 },
        })
      ).data.data || [],
    enabled: !!yearId,
  });

  const seanceOptions = useMemo(() => {
    const set = new Set<number>();
    (sessions || []).forEach((s: any) => set.add(s.session_number));
    return [...set].sort((a, b) => a - b);
  }, [sessions]);

  const filtered = useMemo(
    () => (sessionNumber ? (sessions || []).filter((s: any) => s.session_number === sessionNumber) : sessions || []),
    [sessions, sessionNumber],
  );

  return (
    <div>
      <Card className="mb-4" padded>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="ds-field">
            <span>Année scolaire</span>
            <Select
              placeholder="Sélectionner…"
              value={yearId || undefined}
              onChange={(v) => setYearId(v)}
              options={(years || []).map((y: any) => ({ value: y.id, label: y.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Classe</span>
            <Select
              placeholder="Toutes"
              allowClear
              value={classId || undefined}
              onChange={(v) => {
                setClassId(v || '');
                setSubjectId('');
              }}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Matière</span>
            <Select
              placeholder="Toutes"
              allowClear
              value={subjectId || undefined}
              onChange={(v) => setSubjectId(v || '')}
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Séance</span>
            <Select
              placeholder="Toutes"
              allowClear
              value={sessionNumber ?? undefined}
              onChange={(v) => setSessionNumber(v ?? undefined)}
              options={seanceOptions.map((n) => ({ value: n, label: `Séance ${n}` }))}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={52} className="rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center" accent="info">
          <p className="font-display font-bold text-ds-text">Aucune séance</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Aucun appel enregistré pour ces filtres. Faites l'appel depuis l'onglet « Faire l'appel ».
          </p>
        </Card>
      ) : (
        <div className="ds-table-wrap">
          <table className="ds-hist-table">
            <thead>
              <tr>
                <th>Séance</th>
                <th>Date</th>
                <th>Créneau</th>
                <th>Classe</th>
                <th>Matière</th>
                <th>Présents</th>
                <th>Retards</th>
                <th>Absents</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <span className="ds-seance-badge">
                      <Hash width={13} height={13} aria-hidden />
                      {s.session_number}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{dayjs(s.date).format('ddd D MMM YYYY')}</td>
                  <td className="whitespace-nowrap text-ds-text-secondary">
                    {s.start_time ? `${s.start_time}–${s.end_time || ''}` : '—'}
                  </td>
                  <td>{s.class?.name}</td>
                  <td>{s.subject?.name}</td>
                  <td className="ds-hist-count ds-c-present">{s.counts?.present ?? 0}</td>
                  <td className="ds-hist-count ds-c-late">{s.counts?.late ?? 0}</td>
                  <td className="ds-hist-count ds-c-absent">{(s.counts?.absent ?? 0) + (s.counts?.excused ?? 0)}</td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" icon={<Eye aria-hidden />} onClick={() => setDetailId(s.id)}>
                      Voir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AttendanceSessionDetailModal sessionId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
