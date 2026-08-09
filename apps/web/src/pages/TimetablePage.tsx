import { useEffect, useMemo, useState } from 'react';
import { Select as AntSelect, TimePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import { Plus, Save, Trash2, Crown, X, FileDown, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Card, Modal, toast } from '../components/ds';
import { TimetableGrid, deriveSlotsFromHoraires, type TTCell } from '../components/timetable/TimetableGrid';
import { downloadTimetablePdf } from '../lib/timetable-pdf';

/**
 * Emploi du temps (§9.4) — conteneur. Reste sur `/timetables` (table
 * class_timetables, donnée réelle, cohérente avec la vue enseignant).
 *
 * Refonte inspirée de « simple-schedule » : on choisit une classe puis on
 * ajoute plusieurs blocs « créneau » (Jour, Horaire, Matières, Enseignant,
 * Salle), chacun un formulaire éditable indépendant, empilés ; un seul bouton
 * final enregistre tous les blocs d'un coup. Les horaires viennent d'une
 * table dédiée (`GET/POST /horaires`) : le « + » à côté du champ Horaire
 * d'un bloc ouvre une modale (TimePicker) qui alimente la liste pour tous
 * les blocs. La grille en dessous n'affiche que le résultat (+ suppression).
 *
 * Le professeur principal de la classe (`class_main_teachers`) se gère aussi
 * ici désormais — l'ancienne page « Affectations Enseignants » a été retirée,
 * regroupant tout le pilotage d'une classe (créneaux + prof. principal) au
 * même endroit.
 */

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: 'Lundi' }, { value: 'TUESDAY', label: 'Mardi' }, { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY', label: 'Jeudi' }, { value: 'FRIDAY', label: 'Vendredi' },
];
const subjectIsEPS = (s?: any) =>
  !!(s?.code === 'EPS' || s?.name?.toUpperCase().includes('EPS') || s?.name?.toUpperCase().includes('ÉDUCATION PHYSIQUE'));

interface SlotBlock {
  tempId: string; day: string; horaireIds: string[];
  subjectId?: string; teacherId?: string; classroomId?: string;
  error?: string;
}
/** Une ligne prête à être envoyée à l'API — un bloc avec plusieurs horaires
 *  sélectionnés est éclaté en une ligne par horaire au moment de l'enregistrement. */
interface SubmitRow {
  tempId: string; day: string; horaireId: string;
  subjectId?: string; teacherId?: string; classroomId?: string;
}
const newBlock = (): SlotBlock => ({ tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, day: 'MONDAY', horaireIds: [] });

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState('');
  const [classId, setClassId] = useState('');
  const [blocks, setBlocks] = useState<SlotBlock[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TTCell | null>(null);
  const [horaireModalOpen, setHoraireModalOpen] = useState(false);
  const [horaireModalTarget, setHoraireModalTarget] = useState<string | null>(null);
  const [newStart, setNewStart] = useState<Dayjs | null>(null);
  const [newEnd, setNewEnd] = useState<Dayjs | null>(null);
  const [newType, setNewType] = useState<'COURS' | 'RECREATION' | 'PAUSE'>('COURS');

  const { data: years } = useQuery({ queryKey: ['academic-years-all'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  const { data: classes } = useQuery({ queryKey: ['school-classes-all'], queryFn: async () => (await api.get('/school-classes')).data.data || [] });
  const { data: subjects } = useQuery({ queryKey: ['subjects-all'], queryFn: async () => (await api.get('/subjects')).data.data || [] });
  const { data: classrooms } = useQuery({ queryKey: ['classrooms-all'], queryFn: async () => (await api.get('/classrooms?limit=1000')).data.data?.data || (await api.get('/classrooms?limit=1000')).data.data || [] });
  const { data: teachers } = useQuery({
    queryKey: ['teachers-all'],
    queryFn: async () => { const b = (await api.get('/teachers?limit=1000')).data; return b.data || b.teachers || []; },
  });
  const { data: timetables, isLoading } = useQuery({
    queryKey: ['timetables', year, classId],
    queryFn: async () => {
      const r = await api.get(`/timetables?academicYearId=${year}&classId=${classId}`);
      return Array.isArray(r.data.data) ? r.data.data : [];
    },
    enabled: !!year && !!classId,
  });
  // Table dédiée des créneaux horaires réutilisables — vide par défaut,
  // alimentée uniquement via le « + » du champ Horaire (aucune liste figée).
  const { data: horaires } = useQuery({
    queryKey: ['horaires'],
    queryFn: async () => (await api.get('/horaires')).data.data || [],
  });
  const { data: mainTeacher } = useQuery({
    queryKey: ['class-main-teacher', year, classId],
    queryFn: async () => (await api.get(`/class-main-teachers/class/${classId}/year/${year}`)).data.data || null,
    enabled: !!year && !!classId,
  });
  const [mainTeacherId, setMainTeacherId] = useState<string | undefined>(undefined);

  // Année courante par défaut
  useEffect(() => {
    if (years && !year) {
      const cur = years.find((y: any) => y.isCurrent);
      setYear(cur?.id || years[0]?.id || '');
    }
  }, [years, year]);

  // Réinitialise les blocs quand on change de classe/année — le premier bloc
  // s'affiche déjà par défaut, prêt à remplir.
  useEffect(() => { setBlocks(year && classId ? [newBlock()] : []); }, [year, classId]);

  // Synchronise le sélecteur de prof. principal avec la classe/année choisies.
  useEffect(() => { setMainTeacherId(mainTeacher?.teacher?.id); }, [mainTeacher]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['timetables'] });
  const invalidateMainTeacher = () => queryClient.invalidateQueries({ queryKey: ['class-main-teacher', year, classId] });

  const saveAllM = useMutation({
    mutationFn: async (rows: SubmitRow[]) => {
      const results = await Promise.allSettled(rows.map((r) => {
        const horaire = horaires?.find((h: any) => h.id === r.horaireId);
        return api.post('/timetables', {
          academicYearId: year, classId, dayOfWeek: r.day,
          startTime: horaire?.start_time, endTime: horaire?.end_time,
          subjectId: r.subjectId, teacherId: r.teacherId, classroomId: r.classroomId,
        });
      }));
      const failed = rows
        .map((r, i) => ({ row: r, result: results[i] }))
        .filter((x) => x.result.status === 'rejected')
        .map(({ row, result }): SlotBlock => ({
          tempId: row.tempId, day: row.day, horaireIds: [row.horaireId],
          subjectId: row.subjectId, teacherId: row.teacherId, classroomId: row.classroomId,
          error: (result as PromiseRejectedResult).reason?.response?.data?.error || 'Échec',
        }));
      return { succeeded: results.length - failed.length, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      if (succeeded > 0) toast.success(`${succeeded} créneau${succeeded > 1 ? 'x' : ''} enregistré${succeeded > 1 ? 's' : ''}.`);
      if (failed.length > 0) toast.error(`${failed.length} créneau${failed.length > 1 ? 'x' : ''} en échec — corrigez et réessayez.`);
      setBlocks(failed);
      invalidate();
    },
    onError: () => toast.error("Erreur lors de l'enregistrement des créneaux."),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/timetables/${id}`)).data,
    onSuccess: () => { toast.success('Créneau supprimé.'); setDeleteTarget(null); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la suppression du créneau.'),
  });
  const createHoraireM = useMutation({
    mutationFn: async (d: { startTime: string; endTime: string; type: string }) => (await api.post('/horaires', d)).data,
    onSuccess: (res: any, variables) => {
      toast.success(
        variables.type === 'RECREATION' ? 'Récréation ajoutée.'
          : variables.type === 'PAUSE' ? 'Pause après-midi ajoutée.'
          : 'Créneau horaire ajouté.'
      );
      queryClient.invalidateQueries({ queryKey: ['horaires'] });
      // On ne rattache au bloc « cours » que les créneaux de type COURS.
      if (horaireModalTarget && variables.type === 'COURS') updateBlock(horaireModalTarget, { horaireIds: [res?.data?.id] });
      setHoraireModalOpen(false);
      setHoraireModalTarget(null);
      setNewStart(null);
      setNewEnd(null);
      setNewType('COURS');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de l'ajout du créneau horaire."),
  });
  const setMainTeacherM = useMutation({
    mutationFn: async (teacherId: string) =>
      (await api.post('/class-main-teachers', { academicYearId: year, teacherId, classId })).data,
    onSuccess: () => { toast.success('Professeur principal enregistré.'); invalidateMainTeacher(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de l'affectation du professeur principal."),
  });
  const removeMainTeacherM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/class-main-teachers/${id}`)).data,
    onSuccess: () => { toast.success('Professeur principal retiré.'); setMainTeacherId(undefined); invalidateMainTeacher(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors du retrait.'),
  });

  const cellFor = (day: string, start: string, end: string): TTCell | null =>
    (timetables || []).find((x: any) => x.day_of_week === day && x.start_time === start && x.end_time === end) || null;

  // Les lignes de la grille viennent de la table `horaires` (structure de la
  // journée, y compris récréation / après-midi), pas des seules entrées saisies.
  const slots = useMemo(() => deriveSlotsFromHoraires(horaires || []), [horaires]);
  // Le sélecteur d'horaire d'un bloc « cours » n'offre que les créneaux de type
  // COURS (on ne planifie pas un cours pendant la récréation / l'après-midi).
  const horaireOptions = useMemo(
    () => (horaires || [])
      .filter((h: any) => (h.type ?? 'COURS') === 'COURS')
      .map((h: any) => ({ value: h.id, label: `${h.start_time} - ${h.end_time}` })),
    [horaires],
  );

  const updateBlock = (tempId: string, patch: Partial<SlotBlock>) =>
    setBlocks((prev) => prev.map((b) => (b.tempId === tempId ? { ...b, ...patch, error: undefined } : b)));
  const removeBlock = (tempId: string) => setBlocks((prev) => prev.filter((b) => b.tempId !== tempId));
  const addBlock = () => setBlocks((prev) => [...prev, newBlock()]);

  const openHoraireModal = (tempId: string | null) => { setHoraireModalTarget(tempId); setNewType('COURS'); setHoraireModalOpen(true); };
  const submitHoraire = () => {
    if (!newStart || !newEnd) { toast.warning('Veuillez sélectionner une heure de début et de fin.'); return; }
    const startTime = newStart.format('HH:mm');
    const endTime = newEnd.format('HH:mm');
    if (endTime <= startTime) { toast.warning("L'heure de fin doit être après l'heure de début."); return; }
    createHoraireM.mutate({ startTime, endTime, type: newType });
  };

  const saveAll = () => {
    const complete: SubmitRow[] = [];
    let missing = false;
    for (const b of blocks) {
      // La salle n'est pas obligatoire à la saisie : si aucune n'est choisie,
      // on affecte la première salle disponible (le champ reste modifiable
      // par la suite si besoin).
      let classroomId = b.classroomId;
      if (!classroomId && classrooms?.length) classroomId = classrooms[0].id;
      if (!b.horaireIds?.length || !b.subjectId || !b.teacherId || !classroomId) { missing = true; continue; }
      // Un bloc avec plusieurs horaires sélectionnés donne une entrée par
      // horaire — la même matière/enseignant/salle est affectée à chacun.
      for (const horaireId of b.horaireIds) {
        complete.push({ tempId: `${b.tempId}-${horaireId}`, day: b.day, horaireId, subjectId: b.subjectId, teacherId: b.teacherId, classroomId });
      }
    }
    if (missing) toast.warning('Certains créneaux incomplets ont été ignorés — vérifiez horaire(s), matière et enseignant.');
    if (complete.length === 0) return;
    saveAllM.mutate(complete);
  };

  const exportPdf = async () => {
    if (slots.length === 0) { toast.warning('Aucun créneau horaire défini à exporter.'); return; }
    try {
      await downloadTimetablePdf({
        className: classes?.find((c: any) => c.id === classId)?.name || '',
        yearName: years?.find((y: any) => y.id === year)?.name || '',
        mainTeacherName: mainTeacher ? `${mainTeacher.teacher.first_name} ${mainTeacher.teacher.last_name}` : '',
        days: DAYS_OF_WEEK,
        slots,
        entries: timetables || [],
      });
    } catch {
      toast.error("Erreur lors de la génération du PDF.");
    }
  };

  return (
    <div className="animate-fade-in mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Emploi du temps</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">Générez l'emploi du temps d'une classe en ajoutant ses créneaux.</p>
      </div>

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="ds-field"><span>Année scolaire</span>
            <AntSelect
              placeholder="Sélectionner…"
              value={year || undefined}
              onChange={(value) => { setYear(value); setClassId(''); }}
              options={(years || []).map((y: any) => ({ value: y.id, label: y.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field"><span>Classe</span>
            <AntSelect
              placeholder="Sélectionner…"
              value={classId || undefined}
              disabled={!year}
              onChange={(value) => setClassId(value)}
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </Card>

      {year && classId && (
        <Card className="mb-4">
          <p className="mb-3 font-display text-[.96rem] font-bold text-ds-text">Professeur principal</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="ds-field min-w-[240px] flex-1"><span>Enseignant</span>
              <AntSelect
                placeholder="Sélectionner…" showSearch optionFilterProp="label" style={{ width: '100%' }}
                value={mainTeacherId}
                onChange={(v) => setMainTeacherId(v)}
                options={(teachers || []).map((t: any) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
              />
            </label>
            <Button
              icon={<Crown aria-hidden />}
              loading={setMainTeacherM.isPending}
              disabled={!mainTeacherId || mainTeacherId === mainTeacher?.teacher?.id}
              onClick={() => mainTeacherId && setMainTeacherM.mutate(mainTeacherId)}
            >
              Enregistrer
            </Button>
            {mainTeacher && (
              <Button
                variant="secondary" icon={<X aria-hidden />}
                loading={removeMainTeacherM.isPending}
                onClick={() => removeMainTeacherM.mutate(mainTeacher.id)}
              >
                Retirer
              </Button>
            )}
          </div>
          {mainTeacher && (
            <p className="mt-2 text-[.8rem] text-ds-text-tertiary">
              Actuellement : <strong className="text-ds-text">{mainTeacher.teacher.first_name} {mainTeacher.teacher.last_name}</strong>
            </p>
          )}
        </Card>
      )}

      {year && classId && (
        <Card className="mb-4">
          <p className="mb-3 font-display text-[.96rem] font-bold text-ds-text">Créneaux à créer ({blocks.length})</p>

          {blocks.length > 0 && (
            <div className="flex flex-col gap-3">
              {blocks.map((b) => {
                const subject = subjects?.find((s: any) => s.id === b.subjectId);
                const eps = subjectIsEPS(subject);
                // Seuls les enseignants habilités pour la matière choisie (fiche
                // enseignant) sont proposés — évite d'affecter un cours à
                // quelqu'un qui n'enseigne pas cette matière.
                const teachersForSubject = b.subjectId
                  ? (teachers || []).filter((t: any) => (t.subjects || []).some((s: any) => s.id === b.subjectId))
                  : (teachers || []);
                return (
                  <div key={b.tempId} className="relative rounded-xl border border-ds-border p-3">
                    <button
                      type="button" className="ds-tt-del" aria-label="Retirer ce créneau"
                      onClick={() => removeBlock(b.tempId)}
                    >
                      <Trash2 width={13} height={13} aria-hidden />
                    </button>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <label className="ds-field"><span>Jour</span>
                        <AntSelect value={b.day} onChange={(v) => updateBlock(b.tempId, { day: v })} options={DAYS_OF_WEEK} style={{ width: '100%' }} />
                      </label>
                      <label className="ds-field"><span>Horaire(s)</span>
                        <div className="flex gap-2">
                          <AntSelect
                            mode="multiple"
                            placeholder="Sélectionner un ou plusieurs horaires…" showSearch optionFilterProp="label" style={{ width: '100%' }}
                            value={b.horaireIds}
                            onChange={(v) => updateBlock(b.tempId, { horaireIds: v })}
                            options={horaireOptions}
                            notFoundContent="Aucun créneau horaire — utilisez le +"
                          />
                          <Button variant="secondary" iconOnly icon={<Plus aria-hidden />} aria-label="Ajouter un créneau horaire" onClick={() => openHoraireModal(b.tempId)} />
                        </div>
                      </label>
                      <label className="ds-field"><span>Matières</span>
                        <AntSelect
                          placeholder="Sélectionner…" showSearch optionFilterProp="label" style={{ width: '100%' }}
                          value={b.subjectId}
                          onChange={(v) => updateBlock(b.tempId, { subjectId: v, teacherId: undefined, classroomId: undefined })}
                          options={(subjects || []).map((s: any) => ({ value: s.id, label: s.name }))}
                        />
                      </label>
                      <label className="ds-field"><span>Enseignant</span>
                        <AntSelect
                          placeholder={b.subjectId ? 'Sélectionner…' : 'Choisissez d\'abord une matière'} showSearch optionFilterProp="label" style={{ width: '100%' }}
                          value={b.teacherId}
                          onChange={(v) => updateBlock(b.tempId, { teacherId: v })}
                          options={teachersForSubject.map((t: any) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
                          notFoundContent={b.subjectId ? 'Aucun enseignant habilité pour cette matière' : 'Choisissez d\'abord une matière'}
                        />
                      </label>
                      {!eps && (
                        <label className="ds-field"><span>Salle <span className="text-ds-text-tertiary font-normal">(optionnel)</span></span>
                          <AntSelect
                            allowClear
                            placeholder="Sélectionner…" style={{ width: '100%' }}
                            value={b.classroomId}
                            onChange={(v) => updateBlock(b.tempId, { classroomId: v })}
                            options={(classrooms || []).map((c: any) => ({ value: c.id, label: c.name }))}
                          />
                        </label>
                      )}
                    </div>
                    {b.error && <p className="mt-2 text-[.78rem] text-danger-600">{b.error}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Plus aria-hidden />} onClick={addBlock}>Ajouter un créneau</Button>
            {blocks.length > 0 && (
              <Button icon={<Save aria-hidden />} loading={saveAllM.isPending} onClick={saveAll}>
                Enregistrer les {blocks.length} créneaux
              </Button>
            )}
          </div>
        </Card>
      )}

      {year && classId ? (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-[.96rem] font-bold text-ds-text">Emploi du temps de la classe</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<Clock aria-hidden />} onClick={() => openHoraireModal(null)}>
                Définir un créneau (récréation / pause)
              </Button>
              <Button size="sm" icon={<FileDown aria-hidden />} onClick={exportPdf}>Exporter en PDF</Button>
            </div>
          </div>
          <TimetableGrid slots={slots} days={DAYS_OF_WEEK} cellFor={cellFor} onDelete={(c) => setDeleteTarget(c)} loading={isLoading} />
        </>
      ) : (
        <Card className="text-center" accent="info">
          <p className="font-display font-bold text-ds-text">Sélectionnez une année et une classe</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez une année scolaire et une classe pour générer son emploi du temps.</p>
        </Card>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer ce créneau ?" width={420}
        footer={<>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button variant="danger" loading={deleteM.isPending} onClick={() => deleteTarget && deleteM.mutate(deleteTarget.id)}>Supprimer</Button>
        </>}>
        <p className="text-sm text-ds-text-secondary">La matière <strong className="text-ds-text">{deleteTarget?.subject?.name}</strong> sera retirée de la grille.</p>
      </Modal>

      <Modal
        open={horaireModalOpen}
        onClose={() => { setHoraireModalOpen(false); setHoraireModalTarget(null); setNewStart(null); setNewEnd(null); setNewType('COURS'); }}
        title="Nouveau créneau horaire"
        width={460}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setHoraireModalOpen(false); setHoraireModalTarget(null); setNewStart(null); setNewEnd(null); setNewType('COURS'); }}>Annuler</Button>
            <Button loading={createHoraireM.isPending} onClick={submitHoraire}>Ajouter</Button>
          </>
        }
      >
        <label className="ds-field mb-4 block"><span>Type de créneau</span>
          <AntSelect
            value={newType}
            onChange={(v) => setNewType(v)}
            style={{ width: '100%' }}
            options={[
              { value: 'COURS', label: 'Cours' },
              { value: 'RECREATION', label: 'Récréation' },
              { value: 'PAUSE', label: 'Pause / Après-midi' },
            ]}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="ds-field"><span>Heure de début</span>
            <TimePicker value={newStart} onChange={setNewStart} format="HH:mm" showNow={false} style={{ width: '100%' }} />
          </label>
          <label className="ds-field"><span>Heure de fin</span>
            <TimePicker value={newEnd} onChange={setNewEnd} format="HH:mm" showNow={false} style={{ width: '100%' }} />
          </label>
        </div>
        {newType !== 'COURS' && (
          <p className="mt-3 text-[.78rem] text-ds-text-tertiary">
            Ce créneau s'affichera en bande pleine largeur ({newType === 'RECREATION' ? 'Récréation' : 'Après-midi'}) dans la grille et le PDF, sans matière ni enseignant.
          </p>
        )}
      </Modal>
    </div>
  );
}
