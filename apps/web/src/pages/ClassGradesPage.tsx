import { Fragment, useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { BookOpen, Calendar, FileDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { studentName } from '../lib/utils';
import { Button, Card, toast } from '../components/ds';

/**
 * Notes par matière (§9.5/§10) — full DS « Encre & Craie ».
 * Sélecteurs DS + tableau DS (notes individuelles + moyenne par matière, en mono).
 * Calcul conservé (formule bulletin) ; export PDF par matière (`grades`).
 */

interface SubjectGrades { grades: { note: number; maxNote: number }[]; average: number }
interface Row { studentId: string; studentName: string; gender: string; subjectGrades: Map<string, SubjectGrades> }

async function downloadPdf(url: string) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.ok) { window.open(window.URL.createObjectURL(await res.blob()), '_blank'); toast.success('PDF généré.'); }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Erreur lors de la génération du PDF.'); }
  } catch { toast.error('Erreur lors de la génération du PDF.'); }
}
const sexe = (g: string) => (['M', 'MALE', 'Masculin'].includes(g) ? 'M' : ['F', 'FEMALE', 'Féminin'].includes(g) ? 'F' : (g || '-'));

export default function ClassGradesPage() {
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const { data: years } = useQuery({ queryKey: ['academic-years-all'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  useEffect(() => { if (years && !year) setYear((years.find((y: any) => y.isCurrent) || years[0])?.id || ''); }, [years, year]);
  const { data: semesters } = useQuery({ queryKey: ['semesters', year], queryFn: async () => year ? (await api.get(`/semesters?academicYearId=${year}`)).data.data || [] : [], enabled: !!year });
  const activeSemester = useMemo(() => {
    if (!semesters?.length) return null;
    const now = dayjs(); const sorted = [...semesters].sort((a: any, b: any) => (dayjs(a.start_date).isBefore(dayjs(b.start_date)) ? -1 : 1));
    return sorted.find((s: any) => (now.isAfter(dayjs(s.start_date)) || now.isSame(dayjs(s.start_date), 'day')) && (now.isBefore(dayjs(s.end_date)) || now.isSame(dayjs(s.end_date), 'day'))) || sorted[0] || null;
  }, [semesters]);
  useEffect(() => { if (activeSemester && !semester) setSemester(activeSemester.id); }, [activeSemester, semester]);
  const { data: classes } = useQuery({ queryKey: ['school-classes-all'], queryFn: async () => (await api.get('/school-classes')).data.data || [] });
  const { data: classSubjects } = useQuery({ queryKey: ['coeff-class', classId], queryFn: async () => classId ? (await api.get(`/coefficients/class/${classId}`)).data.data || [] : [], enabled: !!classId });
  // `limit` explicite : /students pagine à 10 par défaut, la classe serait tronquée.
  const { data: students } = useQuery({ queryKey: ['students-class', classId], queryFn: async () => classId ? (await api.get(`/students?classId=${classId}&limit=1000`)).data.data || [] : [], enabled: !!classId });
  const { data: grades } = useQuery({
    queryKey: ['class-grades', classId, semester, year],
    queryFn: async () => (classId && semester && year) ? (await api.get(`/grades?classId=${classId}&semesterId=${semester}&academicYearId=${year}`)).data.data || [] : [],
    enabled: !!classId && !!semester && !!year,
  });
  // Conduite : uniquement les trimestres validés (cf. page « Conduite »).
  const { data: conduct } = useQuery({
    queryKey: ['conduct-grades', classId, semester, year],
    queryFn: async () => (classId && semester && year)
      ? (await api.get('/conduct', { params: { academicYearId: year, semesterId: semester, classId } })).data.data || []
      : [],
    enabled: !!classId && !!semester && !!year,
  });
  const conductByStudent = useMemo(() => new Map<string, any>((conduct || []).map((c: any) => [c.studentId, c])), [conduct]);
  const hasConduct = conductByStudent.size > 0;

  const rows: Row[] = useMemo(() => {
    if (!students?.length || !grades || !classSubjects) return [];
    const out: Row[] = students.map((st: any) => {
      const map = new Map<string, SubjectGrades>();
      (classSubjects || []).forEach((cs: any) => {
        const sid = cs.subject.id;
        const sg = grades.filter((g: any) => g.student_id === st.id && g.subject_id === sid)
          .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
          .map((g: any) => ({ note: Number(g.note), maxNote: g.max_note || 20 }));
        let tw = 0, tc = 0;
        sg.forEach((g: { note: number; maxNote: number }) => { const [nn, c] = g.maxNote === 10 ? [(g.note / 10) * 20, 0.5] : [g.note, 1]; tw += nn * c; tc += c; });
        map.set(sid, { grades: sg, average: tc > 0 ? Math.round((tw / tc) * 100) / 100 : 0 });
      });
      return { studentId: st.id, studentName: studentName(st.lastName, st.firstName), gender: st.gender || '', subjectGrades: map };
    });
    // Ordre alphabétique : la numérotation N° ne veut rien dire sur une liste
    // rendue dans l'ordre de création des fiches élèves.
    return out.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
  }, [students, grades, classSubjects]);

  const subjectCols = useMemo<{ id: string; name: string; maxNotes: number }[]>(() => (classSubjects || []).map((cs: any) => {
    const sid = cs.subject.id;
    const maxNotes = Math.max(0, ...rows.map((r) => r.subjectGrades.get(sid)?.grades.length || 0));
    return { id: sid, name: cs.subject.name, maxNotes };
  }), [classSubjects, rows]);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';
  const ready = classId && semester && year;

  return (
    <div className="animate-fade-in mx-auto max-w-7xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Notes par matière</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">Toutes les notes et moyennes des élèves, par matière.</p>
      </div>

      {activeSemester && (
        <Card className="mb-4" accent="info">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Calendar width={16} height={16} aria-hidden className="text-ds-text-secondary" />
            <strong className="text-ds-text">Trimestre actif : {activeSemester.name}</strong>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="ds-field"><span>Année scolaire</span>
            <Select
              placeholder="Sélectionner…"
              value={year || undefined}
              onChange={(value) => { setYear(value); setSemester(''); }}
              options={(years || []).map((y: any) => ({ value: y.id, label: `${y.name}${y.isCurrent ? ' (En cours)' : ''}` }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
          <label className="ds-field"><span>Classe</span>
            <Select
              placeholder="Sélectionner…"
              value={classId || undefined}
              onChange={(value) => { setClassId(value); setSubjectId(''); }}
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
          <label className="ds-field"><span>Trimestre</span>
            <Select
              placeholder="Sélectionner…"
              value={semester || undefined}
              disabled={!year}
              onChange={setSemester}
              options={(semesters || []).map((s: any) => ({ value: s.id, label: `${s.name}${s.id === activeSemester?.id ? ' (Actif)' : ''}` }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
          <label className="ds-field"><span>Matière (export PDF)</span>
            <Select
              placeholder="Toutes"
              value={subjectId || undefined}
              disabled={!classId}
              onChange={setSubjectId}
              options={[{ value: '', label: 'Toutes' }, ...(classSubjects || []).map((cs: any) => ({ value: cs.subject.id, label: cs.subject.name }))]}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
        </div>
      </Card>

      {ready ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border px-4 py-3">
            <strong className="font-display text-ds-text">{classes?.find((c: any) => c.id === classId)?.name} — {semesters?.find((s: any) => s.id === semester)?.name}</strong>
            <Button icon={<FileDown aria-hidden />} disabled={!subjectId}
              onClick={() => downloadPdf(`${apiBase}/grades/class-grades-by-subject/pdf?classId=${classId}&semesterId=${semester}&academicYearId=${year}&subjectId=${subjectId}`)}>
              Exporter{subjectId ? '' : ' (choisir une matière)'}
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-ds-text-tertiary">Aucun élève dans cette classe.</p>
          ) : (
            <div className="ds-grades-wrap">
              <table className="ds-grades-table">
                <thead>
                  <tr>
                    <th className="ds-gt-num" rowSpan={2}>N°</th>
                    <th className="ds-gt-name" rowSpan={2}>Élève</th>
                    <th rowSpan={2}>Sexe</th>
                    {subjectCols.map((s) => <th key={s.id} colSpan={s.maxNotes + 1}>{s.name}</th>)}
                    {hasConduct && <th colSpan={2}>CONDUITE</th>}
                  </tr>
                  <tr>
                    {subjectCols.map((s) => (
                      <Fragment key={s.id}>
                        {Array.from({ length: s.maxNotes }).map((_, i) => <th key={`${s.id}-n${i}`} className="ds-gt-sub">N{i + 1}</th>)}
                        <th className="ds-gt-sub">Moy.</th>
                      </Fragment>
                    ))}
                    {hasConduct && (
                      <>
                        <th className="ds-gt-sub">Abs.</th>
                        <th className="ds-gt-sub">Note</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.studentId}>
                      <td className="ds-gt-num font-mono">{idx + 1}</td>
                      <td className="ds-gt-name"><strong className="text-[.84rem] font-bold uppercase tracking-wide text-ds-text">{r.studentName}</strong></td>
                      <td className="font-mono">{sexe(r.gender)}</td>
                      {subjectCols.map((s) => {
                        const sg = r.subjectGrades.get(s.id);
                        return (
                          <Fragment key={s.id}>
                            {Array.from({ length: s.maxNotes }).map((_, i) => {
                              const g = sg?.grades[i];
                              return <td key={`${r.studentId}-${s.id}-n${i}`} className="font-mono">{g ? `${g.note}/${g.maxNote}` : <span className="text-ds-text-tertiary">–</span>}</td>;
                            })}
                            <td>
                              {sg && sg.average ? <span className={`ds-grade-avg ${sg.average >= 10 ? 'ds-avg-pass' : 'ds-avg-fail'}`}>{sg.average.toFixed(2)}</span> : <span className="text-ds-text-tertiary">–</span>}
                            </td>
                          </Fragment>
                        );
                      })}
                      {hasConduct && (() => {
                        const c = conductByStudent.get(r.studentId);
                        return (
                          <>
                            <td className="font-mono">{c ? `${c.absenceHours} h` : <span className="text-ds-text-tertiary">–</span>}</td>
                            <td>
                              {c
                                ? <span className={`ds-grade-avg ${c.finalNote >= 10 ? 'ds-avg-pass' : 'ds-avg-fail'}`}>{Number(c.finalNote).toFixed(2)}</span>
                                : <span className="text-ds-text-tertiary">–</span>}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="text-center" accent="info">
          <BookOpen className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Sélectionnez les filtres</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez une année, une classe et un trimestre.</p>
        </Card>
      )}
    </div>
  );
}
