import { Fragment, useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { Calendar, EyeOff, FileDown, FileText, Lock, Trophy, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { Button, Card, Modal, SearchInput, StatusBadge, toast } from '../components/ds';
import { useAuthStore } from '../lib/store';
import { searchable, studentName } from '../lib/utils';

/**
 * Moyennes complètes par classe (§9.5/§10) — re-skin « Encre & Craie ».
 * Chrome DS (en-tête, filtres, bannière, boutons) ; le tableau dense de moyennes
 * reste un Ant Design Table (base fonctionnelle, §12.2). Calcul des moyennes/rangs
 * conservé à l'identique (formule bulletin) + exports PDF (`grades`) inchangés.
 *
 * C'est aussi d'ici que l'administration *génère* les bulletins de la classe pour
 * le trimestre : l'acte est enregistré côté API et conditionne tout le reste —
 * tant qu'il n'a pas eu lieu, les espaces Parent et Élève ne voient pas le
 * bulletin, et c'est sa date qui est imprimée sur le document.
 */

/** Clé de la colonne « CONDUITE » — pseudo-matière, sans ligne dans `subjects`. */
const CONDUCT_COL = '__conduct__';

interface SubjectAverage { subjectId: string; subjectName: string; coefficient: number; average: number; rank: number }
interface StudentRow { studentId: string; lastName: string; firstName: string; matricule: string; gender: string; subjectAverages: Map<string, SubjectAverage>; generalAverage: number; finalRank: number }
interface Release { published: boolean; generatedAt: string | null; generatedBy: { firstName: string; lastName: string } | null }

async function downloadPdf(url: string, okMsg: string) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.ok) { window.open(window.URL.createObjectURL(await res.blob()), '_blank'); toast.success(okMsg); }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Erreur lors de la génération du PDF.'); }
  } catch { toast.error('Erreur lors de la génération du PDF.'); }
}

export default function CompleteAveragesPage() {
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

  const { data: years } = useQuery({ queryKey: ['academic-years-all'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  useEffect(() => { if (years && !year) setYear((years.find((y: any) => y.isCurrent) || years[0])?.id || ''); }, [years, year]);
  const { data: semesters } = useQuery({ queryKey: ['semesters', year], queryFn: async () => year ? (await api.get(`/semesters?academicYearId=${year}`)).data.data || [] : [], enabled: !!year });
  const activeSemester = useMemo(() => {
    if (!semesters?.length) return null;
    const now = dayjs();
    const sorted = [...semesters].sort((a: any, b: any) => (dayjs(a.start_date).isBefore(dayjs(b.start_date)) ? -1 : 1));
    return sorted.find((s: any) => (now.isAfter(dayjs(s.start_date)) || now.isSame(dayjs(s.start_date), 'day')) && (now.isBefore(dayjs(s.end_date)) || now.isSame(dayjs(s.end_date), 'day'))) || sorted[0] || null;
  }, [semesters]);
  useEffect(() => { if (activeSemester && !semester) setSemester(activeSemester.id); }, [activeSemester, semester]);
  const { data: classes } = useQuery({ queryKey: ['school-classes-all'], queryFn: async () => (await api.get('/school-classes')).data.data || [] });
  const { data: classSubjects } = useQuery({ queryKey: ['coeff-class', classId], queryFn: async () => classId ? (await api.get(`/coefficients/class/${classId}`)).data.data || [] : [], enabled: !!classId });
  // `limit` explicite : /students pagine à 10 par défaut. Sans lui, la page ne
  // voyait qu'un dixième de la classe — et les rangs, calculés ici, portaient sur
  // ce sous-ensemble alors que le PDF, calculé côté serveur, prenait tout l'effectif.
  const { data: students } = useQuery({ queryKey: ['students-class', classId], queryFn: async () => classId ? (await api.get(`/students?classId=${classId}&limit=1000`)).data.data || [] : [], enabled: !!classId });
  const { data: grades } = useQuery({
    queryKey: ['complete-averages-grades', classId, semester, year],
    queryFn: async () => (classId && semester && year) ? (await api.get(`/grades?classId=${classId}&semesterId=${semester}&academicYearId=${year}`)).data.data || [] : [],
    enabled: !!classId && !!semester && !!year,
  });

  // Statut de génération des bulletins pour (classe, trimestre, année).
  const releaseKey = ['bulletin-release', classId, semester, year];
  const { data: release } = useQuery<Release>({
    queryKey: releaseKey,
    queryFn: async () => (await api.get(`/grades/bulletins/release?classId=${classId}&semesterId=${semester}&academicYearId=${year}`)).data.data,
    enabled: !!classId && !!semester && !!year,
  });

  const generate = useMutation({
    mutationFn: async () => (await api.post('/grades/bulletins/generate', { classId, semesterId: semester, academicYearId: year })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(releaseKey, data.data);
      setConfirmRegenerate(false);
      toast.success('Bulletins générés : ils sont désormais visibles par les parents et les élèves.');
      // Le document de la classe porte la date qu'on vient d'enregistrer.
      downloadPdf(`${apiBase}/grades/class-bulletins/pdf?classId=${classId}&semesterId=${semester}&academicYearId=${year}`, 'Bulletins de la classe prêts.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la génération des bulletins.'),
  });

  const unpublish = useMutation({
    mutationFn: async () => (await api.delete(`/grades/bulletins/release?classId=${classId}&semesterId=${semester}&academicYearId=${year}`)).data,
    onSuccess: () => {
      queryClient.setQueryData(releaseKey, { published: false, generatedAt: null, generatedBy: null });
      toast.success('Publication annulée : les bulletins ne sont plus visibles par les familles.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de l\'annulation.'),
  });

  // Conduite : calculée en direct côté API (appels + corrections d'heures), elle
  // est une matière à part entière — colonne, rang, et poids dans la moyenne
  // générale. Toute correction faite sur la page « Conduite » se voit ici aussitôt.
  const { data: conduct } = useQuery({
    queryKey: ['conduct-grades', classId, semester, year],
    queryFn: async () => (classId && semester && year)
      ? (await api.get('/conduct', { params: { academicYearId: year, semesterId: semester, classId } })).data.data || []
      : [],
    enabled: !!classId && !!semester && !!year,
  });
  const { data: conductSettings } = useQuery({
    queryKey: ['conduct-settings', year],
    queryFn: async () => (await api.get('/conduct/settings', { params: { academicYearId: year } })).data.data,
    enabled: !!year,
  });
  const conductByStudent = useMemo(() => new Map<string, any>((conduct || []).map((c: any) => [c.studentId, c])), [conduct]);
  const hasConduct = conductByStudent.size > 0;
  const conductCoefficient = Number(conductSettings?.coefficient ?? 1);

  const rows: StudentRow[] = useMemo(() => {
    if (!students?.length || !grades || !classSubjects) return [];
    const out: StudentRow[] = students.map((student: any) => {
      const map = new Map<string, SubjectAverage>();
      (classSubjects || []).forEach((cs: any) => {
        const subjectId = cs.subject.id; const coefficient = cs.coefficient || 1;
        const sg = grades.filter((g: any) => g.student_id === student.id && g.subject_id === subjectId);
        let tw = 0, tc = 0;
        sg.forEach((g: any) => { const n = Number(g.note); const [nn, c] = (g.max_note === 10) ? [(n / 10) * 20, 0.5] : [n, 1]; tw += nn * c; tc += c; });
        const average = tc > 0 ? Math.round((tw / tc) * 100) / 100 : 0;
        map.set(subjectId, { subjectId, subjectName: cs.subject.name, coefficient, average, rank: 0 });
      });
      const cg = conductByStudent.get(student.id);
      if (cg) map.set(CONDUCT_COL, { subjectId: CONDUCT_COL, subjectName: 'CONDUITE', coefficient: conductCoefficient, average: Number(cg.finalNote) || 0, rank: 0 });
      let twMG = 0, tcMG = 0;
      map.forEach((s) => { if (s.average > 0) { twMG += s.average * s.coefficient; tcMG += s.coefficient; } });
      return { studentId: student.id, lastName: student.lastName || '', firstName: student.firstName || '', matricule: student.studentNumber || student.student_number || '', gender: student.gender || '', subjectAverages: map, generalAverage: tcMG > 0 ? Math.round((twMG / tcMG) * 100) / 100 : 0, finalRank: 0 };
    });
    const rankedIds = [...(classSubjects || []).map((cs: any) => cs.subject.id), ...(hasConduct ? [CONDUCT_COL] : [])];
    rankedIds.forEach((sid: string) => {
      [...out].sort((a, b) => (b.subjectAverages.get(sid)?.average || 0) - (a.subjectAverages.get(sid)?.average || 0)).forEach((st, i) => { const sa = st.subjectAverages.get(sid); if (sa) sa.rank = i + 1; });
    });
    const sorted = [...out].sort((a, b) => b.generalAverage - a.generalAverage);
    sorted.forEach((st, i) => { st.finalRank = i + 1; });
    return sorted;
  }, [students, grades, classSubjects, conductByStudent, conductCoefficient, hasConduct]);

  const subjectCols = useMemo<{ id: string; name: string }[]>(() => [
    ...(classSubjects || []).map((cs: any) => ({ id: cs.subject.id, name: cs.subject.name })),
    ...(hasConduct ? [{ id: CONDUCT_COL, name: 'CONDUITE' }] : []),
  ], [classSubjects, hasConduct]);
  const sexe = (g: string) => (['M', 'MALE', 'Masculin'].includes(g) ? 'M' : ['F', 'FEMALE', 'Féminin'].includes(g) ? 'F' : (g || '-'));

  // La recherche filtre l'affichage, jamais le calcul : rangs et moyennes restent
  // ceux de la classe entière, sinon un filtre changerait le classement.
  const visibleRows = useMemo(() => {
    const query = searchable(search);
    if (!query) return rows;
    const terms = query.split(' ');
    return rows.filter((r) => {
      const target = searchable(`${r.lastName} ${r.firstName} ${r.matricule}`);
      return terms.every((t) => target.includes(t));
    });
  }, [rows, search]);

  const ready = classId && semester && year;
  // Aucun PDF ne sort tant que les bulletins du trimestre n'ont pas été générés :
  // la génération est l'acte qui fige la date imprimée sur les documents.
  const published = !!release?.published;
  const pdfLock = published ? undefined : 'Générez d\'abord les bulletins du trimestre.';

  return (
    <div className="animate-fade-in mx-auto max-w-7xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Moyennes complètes</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">Moyennes par matière et moyenne générale, par classe.</p>
      </div>

      {activeSemester && (
        <Card className="mb-4" accent="info">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Calendar width={16} height={16} aria-hidden className="text-ds-text-secondary" />
            <strong className="text-ds-text">Trimestre actif : {activeSemester.name}</strong>
            <span className="text-ds-text-secondary">({dayjs(activeSemester.start_date).format('DD/MM/YYYY')} – {dayjs(activeSemester.end_date).format('DD/MM/YYYY')})</span>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-3">
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
              onChange={setClassId}
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
        </div>
      </Card>

      {ready && (
        <Card className="mb-4" accent={release?.published ? 'success' : 'warning'}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {release?.published ? (
                <Users width={18} height={18} aria-hidden className="mt-0.5 shrink-0 text-ds-text-secondary" />
              ) : (
                <Lock width={18} height={18} aria-hidden className="mt-0.5 shrink-0 text-ds-text-secondary" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="font-display text-ds-text">Bulletins du trimestre</strong>
                  {release?.published ? (
                    <StatusBadge status="success">Générés</StatusBadge>
                  ) : (
                    <StatusBadge status="warning" icon={<EyeOff aria-hidden />}>Non générés</StatusBadge>
                  )}
                </div>
                <p className="mt-1 text-sm text-ds-text-secondary">
                  {release?.published ? (
                    <>
                      Générés le{' '}
                      <strong className="text-ds-text">
                        {dayjs(release.generatedAt).format('DD/MM/YYYY à HH:mm')}
                      </strong>
                      {release.generatedBy ? ` par ${release.generatedBy.firstName} ${release.generatedBy.lastName}` : ''}
                      {' — '}cette date figure sur les documents. Les parents et les élèves y ont accès.
                    </>
                  ) : (
                    <>Les parents et les élèves ne voient pas encore ce bulletin. Ils y auront accès dès sa génération, dont la date sera imprimée sur les documents.</>
                  )}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                {release?.published && (
                  <>
                    <Button variant="ghost" icon={<FileDown aria-hidden />}
                      onClick={() => downloadPdf(`${apiBase}/grades/class-bulletins/pdf?classId=${classId}&semesterId=${semester}&academicYearId=${year}`, 'Bulletins de la classe prêts.')}>
                      Tous les bulletins (PDF)
                    </Button>
                    <Button variant="ghost" icon={<EyeOff aria-hidden />} loading={unpublish.isPending}
                      onClick={() => unpublish.mutate()}>
                      Dépublier
                    </Button>
                  </>
                )}
                <Button
                  icon={<FileText aria-hidden />}
                  loading={generate.isPending}
                  disabled={rows.length === 0}
                  onClick={() => (release?.published ? setConfirmRegenerate(true) : generate.mutate())}
                >
                  {release?.published ? 'Regénérer les bulletins' : 'Générer les bulletins'}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {ready ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border px-4 py-3">
            <strong className="font-display text-ds-text">{classes?.find((c: any) => c.id === classId)?.name} — {semesters?.find((s: any) => s.id === semester)?.name}</strong>
            <Button icon={<FileDown aria-hidden />} disabled={rows.length === 0 || !published} title={pdfLock}
              onClick={() => downloadPdf(`${apiBase}/grades/complete-averages/pdf?classId=${classId}&semesterId=${semester}&academicYearId=${year}`, 'PDF généré.')}>Exporter en PDF</Button>
          </div>

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border px-4 py-3">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un élève (nom, prénoms, matricule)…"
                aria-label="Rechercher un élève"
                wrapClassName="w-full max-w-sm"
              />
              <span className="text-[.8rem] text-ds-text-tertiary">
                <span className="font-mono">{visibleRows.length}</span> élève{visibleRows.length > 1 ? 's' : ''}
                {search ? ` sur ${rows.length}` : ''}
              </span>
            </div>
          )}

          {rows.length > 0 && visibleRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-ds-text-tertiary">Aucun élève ne correspond à « {search} ».</p>
          ) : rows.length > 0 ? (
            <div className="ds-grades-wrap">
              <table className="ds-grades-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Bulletin</th>
                    <th className="ds-gt-num" rowSpan={2}>Rang</th>
                    <th className="ds-gt-name" rowSpan={2}>Élève</th>
                    <th rowSpan={2}>Sexe</th>
                    {subjectCols.map((s) => <th key={s.id} colSpan={2}>{s.name}</th>)}
                    <th className="ds-gt-avg" rowSpan={2}>MG</th>
                  </tr>
                  <tr>
                    {subjectCols.map((s) => (
                      <Fragment key={s.id}>
                        <th className="ds-gt-sub">Moy.</th>
                        <th className="ds-gt-sub">Rang</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.studentId}>
                      <td><Button variant="ghost" size="sm" icon={<FileText aria-hidden />} disabled={!published} title={pdfLock} onClick={() => downloadPdf(`${apiBase}/grades/student-bulletin/pdf?studentId=${r.studentId}&classId=${classId}&semesterId=${semester}&academicYearId=${year}`, 'Bulletin généré.')}>PDF</Button></td>
                      <td className="ds-gt-num font-mono">{r.finalRank}</td>
                      <td className="ds-gt-name">
                        <strong className="text-[.84rem] font-bold uppercase tracking-wide text-ds-text">{studentName(r.lastName, r.firstName)}</strong>
                      </td>
                      <td className="font-mono">{sexe(r.gender)}</td>
                      {subjectCols.map((s) => {
                        const sa = r.subjectAverages.get(s.id);
                        return (
                          <Fragment key={s.id}>
                            <td>{sa && sa.average ? <span className={`ds-grade-avg ${sa.average >= 10 ? 'ds-avg-pass' : 'ds-avg-fail'}`}>{sa.average.toFixed(2)}</span> : <span className="text-ds-text-tertiary">–</span>}</td>
                            <td className="font-mono">{sa && sa.average ? sa.rank : <span className="text-ds-text-tertiary">–</span>}</td>
                          </Fragment>
                        );
                      })}
                      <td className="ds-gt-avg"><strong className="font-mono text-ds-text">{r.generalAverage.toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-ds-text-tertiary">Aucune moyenne pour cette classe et ce trimestre.</p>
          )}
        </Card>
      ) : (
        <Card className="text-center" accent="info">
          <Trophy className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Sélectionnez les filtres</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez une année, une classe et un trimestre.</p>
        </Card>
      )}

      {/* Regénérer redate le bulletin déjà remis aux familles : on le dit avant. */}
      <Modal
        open={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        title="Regénérer les bulletins ?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRegenerate(false)}>Annuler</Button>
            <Button loading={generate.isPending} onClick={() => generate.mutate()}>Regénérer</Button>
          </>
        }
      >
        <p className="text-sm text-ds-text-secondary">
          Les bulletins de cette classe ont déjà été générés
          {release?.generatedAt ? ` le ${dayjs(release.generatedAt).format('DD/MM/YYYY à HH:mm')}` : ''}.
          Les regénérer prend en compte les notes saisies depuis, et remplace la date imprimée sur les
          documents par celle d'aujourd'hui — y compris pour les bulletins déjà consultés par les familles.
        </p>
      </Modal>
    </div>
  );
}
