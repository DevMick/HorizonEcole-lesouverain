import { Fragment, useEffect, useMemo, useState } from 'react';
import { InputNumber, Select } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  Calculator,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Gauge,
  Paperclip,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { api, FILE_BASE } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { searchable, studentName } from '../lib/utils';
import { Button, Card, Modal, SearchInput, Skeleton, toast } from '../components/ds';

/**
 * Conduite (§9.7) — note de comportement par trimestre.
 *
 * La note part de 20/20 et perd 1 point par tranche pleine de 2 heures d'absence
 * non justifiée (paramétrable) — moins de 2 h ⇒ aucune pénalité. Tout est
 * automatique : les heures sont cumulées en
 * direct depuis les séances d'appel (« Liste de présence ») et la note est
 * recalculée à chaque lecture — il n'y a ni calcul manuel, ni validation.
 *
 * Le seul geste de l'administration est la correction des « heures retenues »
 * d'une matière lorsqu'un justificatif est fourni (PDF/image joint à la ligne) :
 * la note finale, les « Moyennes complètes » et les bulletins suivent aussitôt.
 */

interface SubjectBreakdown {
  subjectId: string;
  subjectName: string;
  sessionHours: number;
  legacyHours: number;
  overrideHours: number | null;
  hours: number;
  justificatifUrl: string | null;
  justificatifFilename: string | null;
}

interface ConductRow {
  id: string | null;
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  baseNote: number;
  absenceHours: number;
  penalty: number;
  computedNote: number;
  finalNote: number;
  bySubject: SubjectBreakdown[];
}

interface Settings {
  academicYearId: string;
  baseNote: number;
  hoursPerPoint: number;
  defaultSessionHours: number;
  /** Durée d'un créneau de l'emploi du temps, en minutes (= 1 heure de cours). */
  periodMinutes: number;
  coefficient: number;
}

const sexe = (g: string) =>
  ['M', 'MALE', 'Masculin'].includes(g) ? 'M' : ['F', 'FEMALE', 'Féminin'].includes(g) ? 'F' : g || '-';

const noteClass = (n: number) => (n >= 10 ? 'ds-avg-pass' : 'ds-avg-fail');

const fmtNote = (n: number) => String(Math.round(n * 100) / 100);

function Stat({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="ds-stat">
        <div className="ds-stat-body">
          <span className="ds-stat-label">{label}</span>
          <span className="ds-stat-value">{value}</span>
          {hint && <span className="text-xs text-ds-text-tertiary">{hint}</span>}
        </div>
        <span className="ds-stat-medallion">{icon}</span>
      </div>
    </Card>
  );
}

export default function ConductPage() {
  const { user } = useAuthStore();
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';
  const qc = useQueryClient();

  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [classId, setClassId] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null);
  const [search, setSearch] = useState('');

  const { data: years } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  useEffect(() => {
    if (years?.length && !year) setYear((years.find((y: any) => y.isCurrent) || years[0]).id);
  }, [years, year]);

  const { data: semesters } = useQuery({
    queryKey: ['semesters', year],
    queryFn: async () => (year ? (await api.get(`/semesters?academicYearId=${year}`)).data.data || [] : []),
    enabled: !!year,
  });
  const activeSemester = useMemo(() => {
    if (!semesters?.length) return null;
    const now = dayjs();
    const sorted = [...semesters].sort((a: any, b: any) => (dayjs(a.start_date).isBefore(dayjs(b.start_date)) ? -1 : 1));
    return (
      sorted.find(
        (s: any) =>
          (now.isAfter(dayjs(s.start_date)) || now.isSame(dayjs(s.start_date), 'day')) &&
          (now.isBefore(dayjs(s.end_date)) || now.isSame(dayjs(s.end_date), 'day')),
      ) ||
      sorted[0] ||
      null
    );
  }, [semesters]);
  useEffect(() => {
    if (activeSemester && !semester) setSemester(activeSemester.id);
  }, [activeSemester, semester]);

  const { data: classes } = useQuery({
    queryKey: ['school-classes-all'],
    queryFn: async () => (await api.get('/school-classes')).data.data || [],
  });

  const ready = !!(year && semester && classId);

  const { data: preview, isLoading } = useQuery({
    queryKey: ['conduct-preview', year, semester, classId],
    queryFn: async () =>
      (
        await api.get('/conduct/preview', {
          params: { academicYearId: year, semesterId: semester, classId },
        })
      ).data.data as { rows: ConductRow[]; settings: Settings },
    enabled: ready && isAdmin,
  });

  const rows = preview?.rows || [];
  const settings = preview?.settings;

  // Recherche par nom, prénoms ou matricule : insensible à la casse et aux
  // accents (« kone » trouve « Koné »), et les mots peuvent être donnés dans
  // n'importe quel ordre (« yannick coulibaly » trouve Coulibaly Yannick).
  const visibleRows = useMemo(() => {
    const query = searchable(search);
    if (!query) return rows;
    const terms = query.split(' ');
    return rows.filter((r) => {
      const target = searchable(`${r.lastName} ${r.firstName} ${r.studentNumber || ''}`);
      return terms.every((t) => target.includes(t));
    });
  }, [rows, search]);

  // `conduct-grades` alimente « Moyennes complètes » : on l'invalide aussi pour
  // que la moyenne générale reparte du nouveau calcul.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['conduct-preview'] });
    qc.invalidateQueries({ queryKey: ['conduct-grades'] });
  };

  /**
   * Correction des heures retenues d'une matière, avec justificatif optionnel.
   * `hours: null` ⇒ retour au calcul automatique (et suppression du justificatif).
   */
  const overrideMutation = useMutation({
    mutationFn: async (payload: {
      studentId: string;
      subjectId: string;
      hours: number | null;
      file?: File;
      removeJustificatif?: boolean;
    }) => {
      const fd = new FormData();
      fd.append('academicYearId', year);
      fd.append('semesterId', semester);
      fd.append('classId', classId);
      fd.append('studentId', payload.studentId);
      fd.append('subjectId', payload.subjectId);
      fd.append('hours', payload.hours === null ? '' : String(payload.hours));
      if (payload.removeJustificatif) fd.append('removeJustificatif', 'true');
      if (payload.file) fd.append('justificatif', payload.file);
      return (
        await api.put('/conduct/absence-override', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      ).data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Heures d'absence mises à jour.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la correction des heures.'),
  });

  const settingsMutation = useMutation({
    mutationFn: async (payload: Settings) => (await api.put('/conduct/settings', payload)).data,
    onSuccess: (res) => {
      toast.success(res.message || 'Paramètres enregistrés.');
      setSettingsOpen(false);
      refresh();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de l’enregistrement.'),
  });

  const totals = useMemo(() => {
    if (!rows.length) return null;
    const hours = rows.reduce((a, r) => a + r.absenceHours, 0);
    const avg = rows.reduce((a, r) => a + r.finalNote, 0) / rows.length;
    return { hours: Math.round(hours * 10) / 10, avg: Math.round(avg * 100) / 100 };
  }, [rows]);

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md text-center" accent="info">
        <ShieldCheck className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
        <p className="font-display text-base font-bold text-ds-text">Conduite</p>
        <p className="mt-1 text-sm text-ds-text-secondary">
          La gestion de la note de conduite est réservée à l'administration.
        </p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Conduite</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Note calculée automatiquement à partir des appels. Corrigez les heures d'une matière sur
            présentation d'un justificatif.
          </p>
        </div>
        <Button
          variant="ghost"
          icon={<Settings2 aria-hidden />}
          onClick={() => {
            setSettingsDraft(settings ? { ...settings } : null);
            setSettingsOpen(true);
          }}
          disabled={!settings}
        >
          Paramètres du calcul
        </Button>
      </div>

      {settings && (
        <Card className="mb-4" accent="info">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Calculator width={16} height={16} aria-hidden className="text-ds-text-secondary" />
            <strong className="text-ds-text">Règle de calcul :</strong>
            <span className="text-ds-text-secondary">
              chaque élève part de <strong className="text-ds-text">{settings.baseNote}/20</strong> et perd{' '}
              <strong className="text-ds-text">1 point</strong> par tranche pleine de{' '}
              <strong className="text-ds-text">{settings.hoursPerPoint} heures de cours</strong> manquées sans
              justification — en dessous de {settings.hoursPerPoint} h, aucune pénalité. Un créneau de l'emploi
              du temps ({settings.periodMinutes} min) = 1 heure de cours ;
              une séance à cheval sur deux créneaux en compte 2. Coefficient {settings.coefficient} dans la
              moyenne générale.
            </span>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="ds-field">
            <span>Année scolaire</span>
            <Select
              placeholder="Sélectionner…"
              value={year || undefined}
              onChange={(v) => {
                setYear(v);
                setSemester('');
              }}
              options={(years || []).map((y: any) => ({ value: y.id, label: `${y.name}${y.isCurrent ? ' (En cours)' : ''}` }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
          <label className="ds-field">
            <span>Trimestre</span>
            <Select
              placeholder="Sélectionner…"
              value={semester || undefined}
              disabled={!year}
              onChange={setSemester}
              options={(semesters || []).map((s: any) => ({
                value: s.id,
                label: `${s.name}${s.id === activeSemester?.id ? ' (Actif)' : ''}`,
              }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
          <label className="ds-field">
            <span>Classe</span>
            <Select
              placeholder="Sélectionner…"
              value={classId || undefined}
              onChange={(v) => {
                setClassId(v);
                setSearch('');
              }}
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
              size="middle"
            />
          </label>
        </div>
      </Card>

      {!ready ? (
        <Card className="text-center" accent="info">
          <Gauge className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Sélectionnez les filtres</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez une année, un trimestre et une classe.</p>
        </Card>
      ) : isLoading ? (
        <Skeleton height={280} />
      ) : (
        <>
          {totals && (
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Élèves" value={rows.length} icon={<Users aria-hidden />} />
              <Stat
                label="Heures d'absence"
                value={`${totals.hours} h`}
                hint="Cumul de la classe sur le trimestre"
                icon={<Clock aria-hidden />}
              />
              <Stat label="Moyenne de conduite" value={totals.avg.toFixed(2)} hint="/ 20" icon={<Gauge aria-hidden />} />
            </div>
          )}

          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border px-4 py-3">
              <strong className="font-display text-ds-text">
                {classes?.find((c: any) => c.id === classId)?.name} — {semesters?.find((s: any) => s.id === semester)?.name}
              </strong>
              <span className="text-[.8rem] text-ds-text-tertiary">
                Mise à jour automatique à chaque appel
              </span>
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
                  <span className="font-mono">{visibleRows.length}</span> élève
                  {visibleRows.length > 1 ? 's' : ''}
                  {search ? ` sur ${rows.length}` : ''}
                </span>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-ds-text-tertiary">Aucun élève actif dans cette classe.</p>
            ) : visibleRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-ds-text-tertiary">
                Aucun élève ne correspond à « {search} ».
              </p>
            ) : (
              <div className="ds-grades-wrap">
                <table className="ds-grades-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }} aria-label="Détail" />
                      <th className="ds-gt-name">Élève</th>
                      <th>Sexe</th>
                      <th>Heures abs.</th>
                      <th>Pénalité</th>
                      <th className="ds-gt-avg">Note finale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => {
                      const isOpen = expanded === r.studentId;
                      const nom = studentName(r.lastName, r.firstName);
                      return (
                        <Fragment key={r.studentId}>
                          <tr>
                            <td>
                              <button
                                type="button"
                                className="text-ds-text-tertiary hover:text-ds-text"
                                onClick={() => setExpanded(isOpen ? null : r.studentId)}
                                aria-label={isOpen ? 'Masquer le détail' : 'Voir le détail par matière'}
                              >
                                {isOpen ? <ChevronDown width={16} height={16} /> : <ChevronRight width={16} height={16} />}
                              </button>
                            </td>
                            <td className="ds-gt-name">
                              <strong className="text-[.84rem] font-bold uppercase tracking-wide text-ds-text">
                                {nom}
                              </strong>
                            </td>
                            <td className="font-mono">{sexe(r.gender)}</td>
                            <td className="font-mono">{r.absenceHours > 0 ? `${r.absenceHours} h` : <span className="text-ds-text-tertiary">–</span>}</td>
                            <td className="font-mono">
                              {r.penalty > 0 ? (
                                <span className="font-bold text-danger-600">-{r.penalty}</span>
                              ) : (
                                <span className="text-ds-text-tertiary">0</span>
                              )}
                            </td>
                            <td className="ds-gt-avg">
                              <span className={`ds-grade-avg ${noteClass(r.finalNote)}`}>{fmtNote(r.finalNote)}</span>
                            </td>
                          </tr>

                          {isOpen && (
                            <tr>
                              <td colSpan={6} className="bg-ds-subtle p-0">
                                <div className="px-6 py-4">
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ds-text-tertiary">
                                    Heures de cours manquées, par matière
                                  </p>
                                  <p className="mb-3 text-xs text-ds-text-tertiary">
                                    « Appels » = heures déduites des séances où l'élève était absent sans
                                    justification. Joignez le justificatif (PDF ou image) puis ajustez les
                                    « Heures retenues » : la note finale et les moyennes se mettent à jour
                                    immédiatement.
                                  </p>
                                  {r.bySubject.length === 0 ? (
                                    <p className="text-sm text-ds-text-tertiary">
                                      Aucune absence enregistrée sur ce trimestre.
                                    </p>
                                  ) : (
                                    <table className="ds-grades-table">
                                      <thead>
                                        <tr>
                                          <th className="ds-gt-name">Matière</th>
                                          <th>Appels</th>
                                          <th>Heures retenues</th>
                                          <th>Justificatif</th>
                                          <th aria-label="Actions" />
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.bySubject.map((s) => (
                                          <tr key={s.subjectId}>
                                            <td className="ds-gt-name">{s.subjectName}</td>
                                            <td className="font-mono">{s.sessionHours} h</td>
                                            <td>
                                              <InputNumber
                                                min={0}
                                                max={999}
                                                step={0.5}
                                                formatter={(v) => (v === undefined ? '' : String(Number(v)))}
                                                size="small"
                                                value={s.hours}
                                                disabled={overrideMutation.isPending}
                                                onBlur={(e) => {
                                                  const v = Number((e.target as HTMLInputElement).value?.replace(',', '.'));
                                                  if (!Number.isFinite(v) || v === s.hours) return;
                                                  overrideMutation.mutate({
                                                    studentId: r.studentId,
                                                    subjectId: s.subjectId,
                                                    hours: v,
                                                  });
                                                }}
                                                style={{ width: 90 }}
                                              />
                                              {s.overrideHours !== null && (
                                                <span className="ml-2 text-xs text-ds-text-tertiary">corrigé</span>
                                              )}
                                            </td>
                                            <td>
                                              <div className="flex flex-wrap items-center gap-2">
                                                {s.justificatifUrl && (
                                                  <a
                                                    href={`${FILE_BASE}${s.justificatifUrl}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                                                    title={s.justificatifFilename || 'Justificatif'}
                                                  >
                                                    <Eye width={14} height={14} aria-hidden />
                                                    Voir
                                                  </a>
                                                )}
                                                <label
                                                  className={`inline-flex cursor-pointer items-center gap-1 text-xs text-ds-text-secondary hover:text-ds-text ${
                                                    overrideMutation.isPending ? 'pointer-events-none opacity-50' : ''
                                                  }`}
                                                >
                                                  <Paperclip width={14} height={14} aria-hidden />
                                                  {s.justificatifUrl ? 'Remplacer' : 'Joindre'}
                                                  <input
                                                    type="file"
                                                    hidden
                                                    accept="application/pdf,image/*"
                                                    onChange={(e) => {
                                                      const file = e.target.files?.[0];
                                                      e.target.value = '';
                                                      if (!file) return;
                                                      overrideMutation.mutate({
                                                        studentId: r.studentId,
                                                        subjectId: s.subjectId,
                                                        hours: s.hours,
                                                        file,
                                                      });
                                                    }}
                                                  />
                                                </label>
                                              </div>
                                            </td>
                                            <td>
                                              {s.overrideHours !== null && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  icon={<RotateCcw aria-hidden />}
                                                  onClick={() =>
                                                    overrideMutation.mutate({
                                                      studentId: r.studentId,
                                                      subjectId: s.subjectId,
                                                      hours: null,
                                                    })
                                                  }
                                                >
                                                  Rétablir
                                                </Button>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Paramètres du calcul */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Paramètres du calcul de la conduite"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
              Annuler
            </Button>
            <Button
              loading={settingsMutation.isPending}
              onClick={() => settingsDraft && settingsMutation.mutate(settingsDraft)}
            >
              Enregistrer
            </Button>
          </div>
        }
      >
        {settingsDraft && (
          <div className="space-y-4">
            <label className="ds-field">
              <span>Note de départ</span>
              <InputNumber
                min={0}
                max={20}
                step={0.5}
                value={settingsDraft.baseNote}
                onChange={(v) => setSettingsDraft({ ...settingsDraft, baseNote: Number(v ?? 20) })}
                style={{ width: '100%' }}
              />
            </label>
            <label className="ds-field">
              <span>Heures de cours manquées coûtant 1 point</span>
              <InputNumber
                min={0.5}
                max={20}
                step={0.5}
                value={settingsDraft.hoursPerPoint}
                onChange={(v) => setSettingsDraft({ ...settingsDraft, hoursPerPoint: Number(v ?? 2) })}
                style={{ width: '100%' }}
              />
            </label>
            <label className="ds-field">
              <span>Durée d'un créneau (minutes)</span>
              <InputNumber
                min={20}
                max={120}
                step={5}
                value={settingsDraft.periodMinutes}
                onChange={(v) => setSettingsDraft({ ...settingsDraft, periodMinutes: Number(v ?? 50) })}
                style={{ width: '100%' }}
              />
              <span className="mt-1 text-xs text-ds-text-tertiary">
                Un créneau de l'emploi du temps = 1 heure de cours. Avec 50 min : 07:45–08:35 compte 1 h,
                08:35–10:15 compte 2 h.
              </span>
            </label>
            <label className="ds-field">
              <span>Heures retenues pour une séance sans horaire</span>
              <InputNumber
                min={0.5}
                max={12}
                step={0.5}
                value={settingsDraft.defaultSessionHours}
                onChange={(v) => setSettingsDraft({ ...settingsDraft, defaultSessionHours: Number(v ?? 1) })}
                style={{ width: '100%' }}
              />
              <span className="mt-1 text-xs text-ds-text-tertiary">
                Utilisée quand la séance d'appel n'a pas de créneau horaire renseigné.
              </span>
            </label>
            <label className="ds-field">
              <span>Coefficient dans la moyenne générale</span>
              <InputNumber
                min={0}
                max={20}
                step={1}
                value={settingsDraft.coefficient}
                onChange={(v) => setSettingsDraft({ ...settingsDraft, coefficient: Number(v ?? 1) })}
                style={{ width: '100%' }}
              />
            </label>
          </div>
        )}
      </Modal>

      {activeSemester && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ds-text-tertiary">
          <Calendar width={14} height={14} aria-hidden />
          Trimestre actif : {activeSemester.name} ({dayjs(activeSemester.start_date).format('DD/MM/YYYY')} –{' '}
          {dayjs(activeSemester.end_date).format('DD/MM/YYYY')})
        </p>
      )}
    </div>
  );
}
