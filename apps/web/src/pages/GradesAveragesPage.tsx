import { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Card } from '../components/ds';

/**
 * Moyennes par trimestre (§10, enseignant) — full DS « Encre & Craie ».
 * Sélecteurs DS + tableau DS (notes en mono, moyenne pass/fail, rang).
 * Formule conservée : /10→coeff 0.5, /20→coeff du type d'éval (sinon 1),
 * type d'évaluation manquant compté 0 ; classement par moyenne décroissante.
 */

interface Row { studentId: string; studentName: string; grades: { note: number; maxNote: number }[]; average: number; rank: number }

export default function GradesAveragesPage() {
  const { user } = useAuthStore();
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [classId, setClassId] = useState('');

  const { data: years } = useQuery({ queryKey: ['academic-years-all'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  useEffect(() => { if (years && !year) setYear((years.find((y: any) => y.isCurrent) || years[0])?.id || ''); }, [years, year]);
  const { data: teacher } = useQuery({ queryKey: ['teacher-info'], queryFn: async () => (await api.get('/teachers/me/info')).data.data, enabled: user?.role === 'TEACHER' });
  const teacherId = teacher?.id;
  const { data: semesters } = useQuery({ queryKey: ['semesters', year], queryFn: async () => year ? (await api.get(`/semesters?academicYearId=${year}`)).data.data || [] : [], enabled: !!year });
  const activeSemester = useMemo(() => {
    if (!semesters?.length) return null;
    const now = dayjs(); const sorted = [...semesters].sort((a: any, b: any) => (dayjs(a.start_date).isBefore(dayjs(b.start_date)) ? -1 : 1));
    return sorted.find((s: any) => (now.isAfter(dayjs(s.start_date)) || now.isSame(dayjs(s.start_date), 'day')) && (now.isBefore(dayjs(s.end_date)) || now.isSame(dayjs(s.end_date), 'day'))) || sorted[0] || null;
  }, [semesters]);
  useEffect(() => { if (activeSemester && !semester) setSemester(activeSemester.id); }, [activeSemester, semester]);

  const { data: assignments } = useQuery({
    queryKey: ['teacher-assignments', teacherId, year],
    queryFn: async () => (teacherId && year) ? (await api.get(`/grades/teacher/${teacherId}/assignments?academicYearId=${year}`)).data.data || [] : [],
    enabled: !!teacherId && !!year,
  });
  const uniqueClasses = useMemo<any[]>(() => [...new Map((assignments || []).map((a: any) => [a.class?.id, a.class])).values()].filter(Boolean), [assignments]);
  // La classe pilote la matière : on ne propose que les matières que l'enseignant
  // enseigne dans la classe choisie.
  const filteredAssignments = useMemo(
    () => (assignments || []).filter((a: any) => (!classId || a.class?.id === classId)),
    [assignments, classId],
  );
  const subjects = useMemo(() => {
    const map = new Map<string, any>();
    filteredAssignments.forEach((a: any) => a.subject && map.set(a.subject.id, a.subject));
    return [...map.values()];
  }, [filteredAssignments]);

  const { data: students } = useQuery({ queryKey: ['students-by-class', classId], queryFn: async () => classId ? (await api.get(`/students?classId=${classId}&limit=1000`)).data.data || [] : [], enabled: !!classId });
  // Le périmètre est complet (classe comprise) avant tout appel : sans `classId`,
  // l'API renverrait les notes de toutes les classes de la matière, alors que le
  // tableau n'affiche que les élèves de la classe choisie.
  const { data: grades } = useQuery({
    queryKey: ['grades-averages', teacherId, year, semester, subject, classId],
    queryFn: async () => (await api.get(`/grades?teacherId=${teacherId}&academicYearId=${year}&semesterId=${semester}&subjectId=${subject}&classId=${classId}`)).data.data || [],
    enabled: !!teacherId && !!year && !!semester && !!subject && !!classId,
  });

  const rows: Row[] = useMemo(() => {
    if (!students?.length) return [];
    const evalTypes = new Map<string, { maxNote: number; coefficient: number | null }>();
    (grades || []).forEach((g: any) => { const id = g.evaluation_type_id || g.evaluationType?.id; if (id && !evalTypes.has(id)) evalTypes.set(id, { maxNote: g.max_note || 20, coefficient: g.evaluationType?.coefficient || null }); });
    const byStudent = new Map<string, Map<string, any>>();
    (grades || []).forEach((g: any) => { const sid = g.student_id; const id = g.evaluation_type_id || g.evaluationType?.id || 'unknown'; if (!byStudent.has(sid)) byStudent.set(sid, new Map()); const m = byStudent.get(sid)!; if (!m.has(id)) m.set(id, { note: Number(g.note), maxNote: g.max_note || 20, coeff: g.evaluationType?.coefficient || null }); });
    const out: Row[] = students.map((st: any) => {
      const m = byStudent.get(st.id) || new Map();
      let tw = 0, tc = 0; const gl: { note: number; maxNote: number }[] = [];
      evalTypes.forEach((et, id) => {
        const g = m.get(id);
        let nn: number, c: number;
        if (g) { if (g.maxNote === 10) { nn = (g.note / 10) * 20; c = 0.5; } else { nn = g.note; c = g.coeff || 1; } gl.push({ note: g.note, maxNote: g.maxNote }); }
        else { if (et.maxNote === 10) { nn = 0; c = 0.5; } else { nn = 0; c = et.coefficient || 1; } gl.push({ note: 0, maxNote: et.maxNote }); }
        tw += nn * c; tc += c;
      });
      return { studentId: st.id, studentName: `${st.firstName || ''} ${st.lastName || ''}`.trim(), grades: gl, average: tc > 0 ? Math.round((tw / tc) * 100) / 100 : 0, rank: 0 };
    });
    const sorted = [...out].sort((a, b) => b.average - a.average);
    sorted.forEach((s, i) => { s.rank = i + 1; });
    return sorted;
  }, [students, grades]);

  const ready = teacherId && year && semester && subject && classId;

  return (
    <div className="animate-fade-in mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Moyennes par trimestre</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">Classement de vos élèves par matière et trimestre.</p>
      </div>

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="ds-field"><span>Trimestre</span>
            <Select
              placeholder="Sélectionner…"
              value={semester || undefined}
              onChange={setSemester}
              options={(semesters || []).map((s: any) => ({ value: s.id, label: `${s.name}${s.id === activeSemester?.id ? ' (Actif)' : ''}` }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
          <label className="ds-field"><span>Classe</span>
            <Select
              placeholder="Sélectionner…"
              value={classId || undefined}
              onChange={(value) => { setClassId(value); setSubject(''); }}
              disabled={!uniqueClasses.length}
              options={uniqueClasses.map((c: any) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
          <label className="ds-field"><span>Matière</span>
            <Select
              placeholder="Sélectionner…"
              value={subject || undefined}
              onChange={setSubject}
              disabled={!classId}
              options={subjects.map((s: any) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
        </div>
      </Card>

      {ready ? (
        <Card padded={false}>
          <div className="border-b border-ds-border px-4 py-3">
            <strong className="font-display text-ds-text">{subjects.find((s: any) => s.id === subject)?.name} — {semesters?.find((s: any) => s.id === semester)?.name}</strong>
          </div>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-ds-text-tertiary">Aucun élève.</p>
          ) : (
            <div className="ds-grades-wrap">
              <table className="ds-grades-table">
                <thead>
                  <tr><th className="ds-gt-num">Rang</th><th className="ds-gt-name">Élève</th><th>Notes</th><th className="ds-gt-avg">Moy.</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.studentId}>
                      <td className="ds-gt-num font-mono">{r.rank}</td>
                      <td className="ds-gt-name"><strong className="text-[.84rem] text-ds-text">{r.studentName}</strong></td>
                      <td>
                        <span className="flex flex-wrap justify-center gap-1">
                          {r.grades.length ? r.grades.map((g, i) => <span key={i} className="ds-note-chip"><span className="ds-note-val">{g.note}</span><span className="ds-note-max">/{g.maxNote}</span></span>)
                            : <span className="text-ds-text-tertiary">–</span>}
                        </span>
                      </td>
                      <td className="ds-gt-avg"><span className={`ds-grade-avg ${r.average >= 10 ? 'ds-avg-pass' : 'ds-avg-fail'}`}>{r.average.toFixed(2)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="text-center" accent="info">
          <Trophy className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Sélectionnez les filtres</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez un trimestre, une classe et une matière.</p>
        </Card>
      )}
    </div>
  );
}
