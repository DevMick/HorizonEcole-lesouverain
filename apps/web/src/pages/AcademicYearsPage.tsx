import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, CalendarClock, CheckCircle2, Eye, Pencil, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form } from 'antd';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { Button, Modal, toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { AcademicYearFormPage } from '../components/academic/AcademicYearFormPage';
import { SemesterFormPage } from '../components/academic/SemesterFormPage';

/** Années scolaires (§10) — re-skin. Liste + « définir en cours » + trimestres imbriqués. Routeurs `academic-years` + `semesters`. */

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

export default function AcademicYearsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [yearFormOpen, setYearFormOpen] = useState(false);
  const [form] = Form.useForm();
  const [detailsYear, setDetailsYear] = useState<any>(null);
  const [selectedYearForSem, setSelectedYearForSem] = useState<any>(null);
  const [semFormOpen, setSemFormOpen] = useState(false);
  const [editingSem, setEditingSem] = useState<any>(null);
  const [semesterForm] = Form.useForm();

  const { data: years, isLoading } = useQuery({ queryKey: ['academic-years'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  const { data: semesters } = useQuery({ queryKey: ['semesters'], queryFn: async () => (await api.get('/semesters')).data.data || [] });
  const semCount = (yid: string) => (semesters || []).filter((s: any) => s.academic_year_id === yid).length;
  const items = useMemo(() => (years || []).filter((y: any) => !search || y.name?.toLowerCase().includes(search.toLowerCase())), [years, search]);
  const currentYear = (years || []).find((y: any) => y.isCurrent);
  const detailsSemesters = (semesters || []).filter((s: any) => s.academic_year_id === detailsYear?.id);
  // Année cible du formulaire trimestre : l'année de la fiche en édition, sinon
  // l'année choisie pour la création (carte ou modale « Trimestres — Y »).
  const semFormYearId = editingSem?.academic_year_id || selectedYearForSem?.id;
  const usedSemNames = (semesters || [])
    .filter((s: any) => s.academic_year_id === semFormYearId && s.id !== editingSem?.id)
    .map((s: any) => s.name);

  const invalidateY = () => qc.invalidateQueries({ queryKey: ['academic-years'] });
  const invalidateS = () => qc.invalidateQueries({ queryKey: ['semesters'] });
  const createYear = useMutation({
    mutationFn: async (v: any) => (await api.post('/academic-years', {
      startYear: v.startYear.year(),
      endYear: v.endYear.year(),
    })).data,
    onSuccess: () => { toast.success('Année créée.'); setYearFormOpen(false); invalidateY(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création.'),
  });
  const setCurrent = useMutation({
    mutationFn: async (id: string) => (await api.post(`/academic-years/${id}/set-current`)).data,
    onSuccess: () => { toast.success('Année définie en cours.'); invalidateY(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur.'),
  });
  const deleteYear = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/academic-years/${id}`)).data,
    onSuccess: () => { toast.success('Année supprimée.'); invalidateY(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer.'),
  });
  const saveSem = useMutation({
    mutationFn: async (v: any) => {
      const payload = { name: v.name, startDate: v.startDate ? v.startDate.format('YYYY-MM-DD') : null, endDate: v.endDate ? v.endDate.format('YYYY-MM-DD') : null, academicYearId: semFormYearId };
      return editingSem ? (await api.patch(`/semesters/${editingSem.id}`, payload)).data : (await api.post('/semesters', payload)).data;
    },
    onSuccess: () => { toast.success(editingSem ? 'Trimestre modifié.' : 'Trimestre créé.'); setSemFormOpen(false); setEditingSem(null); semesterForm.resetFields(); setSelectedYearForSem(null); invalidateS(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur.'),
  });
  const deleteSem = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/semesters/${id}`)).data,
    onSuccess: () => { toast.success('Trimestre supprimé.'); invalidateS(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur.'),
  });

  const handleYearFormSubmit = () => {
    form.validateFields().then((values) => {
      createYear.mutate(values);
    });
  };

  const handleYearFormCancel = () => {
    form.resetFields();
    setYearFormOpen(false);
  };

  const handleOpenCreateYear = () => {
    form.resetFields();
    setYearFormOpen(true);
  };

  const handleViewDetail = (year: any) => {
    navigate(`/academic/years/${year.id}`);
  };

  const handleSemFormSubmit = () => {
    semesterForm.validateFields().then((values) => {
      saveSem.mutate(values);
    });
  };

  const handleSemFormCancel = () => {
    semesterForm.resetFields();
    setSemFormOpen(false);
    setEditingSem(null);
  };

  const handleOpenCreateSem = (year?: any) => {
    setEditingSem(null);
    semesterForm.resetFields();
    if (year) {
      setSelectedYearForSem(year);
    }
    setSemFormOpen(true);
    setDetailsYear(null); // Close the modal when opening the form
  };

  const handleOpenEditSem = (semester: any) => {
    setEditingSem(semester);
    semesterForm.resetFields();
    setSemFormOpen(true);
    setDetailsYear(null); // Ferme la modale « Trimestres — Y » derrière le formulaire.
  };

  // Le formulaire ne monte qu'après le re-render déclenché par setSemFormOpen(true) ;
  // appeler setFieldsValue avant que <Form> existe n'a aucun effet (champs pas
  // encore enregistrés). On attend donc le montage via useEffect + micro-délai.
  useEffect(() => {
    if (semFormOpen && editingSem) {
      const t = setTimeout(() => semesterForm.setFieldsValue({
        name: editingSem.name,
        startDate: editingSem.start_date ? dayjs(editingSem.start_date) : null,
        endDate: editingSem.end_date ? dayjs(editingSem.end_date) : null,
      }), 50);
      return () => clearTimeout(t);
    }
  }, [semFormOpen, editingSem, semesterForm]);

  return (
    <div className="animate-fade-in">
      {semFormOpen ? (
        <SemesterFormPage
          form={semesterForm}
          editing={editingSem}
          usedNames={usedSemNames}
          onCancel={handleSemFormCancel}
          onSubmit={handleSemFormSubmit}
          submitting={saveSem.isPending}
        />
      ) : !yearFormOpen ? (
        <EntityBoard
          title="Années scolaires"
          subtitle={currentYear ? `Année en cours : ${currentYear.name}.` : 'Aucune année définie « en cours ».'}
          icon={Calendar}
          primaryLabel="Nouvelle année"
          onPrimary={handleOpenCreateYear}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher par nom…"
          items={items}
          loading={isLoading}
          cardOf={(y) => ({
            key: y.id,
            title: y.name,
            badges: y.isCurrent ? [{ label: 'En cours', kind: 'warning' }] : undefined,
            meta: <span className="mt-1 text-[.74rem] text-ds-text-tertiary">{semCount(y.id)} trimestre{semCount(y.id) > 1 ? 's' : ''}</span>,
            onClick: () => handleViewDetail(y),
          })}
          cardActions={(y) => (
            <>
              {!y.isCurrent && <Button variant="ghost" size="sm" iconOnly icon={<CheckCircle2 aria-hidden />} aria-label="Définir en cours" title="Définir en cours" onClick={() => setCurrent.mutate(y.id)} />}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<Eye aria-hidden />}
                aria-label="Voir les trimestres"
                title="Voir les trimestres"
                onClick={() => setDetailsYear(y)}
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<CalendarClock aria-hidden />}
                aria-label="Nouveau trimestre"
                title={semCount(y.id) >= 3 ? 'Les 3 trimestres de cette année sont déjà créés' : 'Nouveau trimestre'}
                disabled={semCount(y.id) >= 3}
                onClick={() => handleOpenCreateSem(y)}
              />
            </>
          )}
          onDelete={(y) => deleteYear.mutate(y.id)}
          emptyTitle="Aucune année"
          emptyText="Créez une année scolaire pour commencer."
        />
      ) : (
        <AcademicYearFormPage
          form={form}
          editing={null}
          onCancel={handleYearFormCancel}
          onSubmit={handleYearFormSubmit}
          submitting={createYear.isPending}
        />
      )}


      <Modal open={!!detailsYear} onClose={() => setDetailsYear(null)} title={`Trimestres — ${detailsYear?.name || ''}`} width={560}
        footer={<>
          <Button variant="secondary" onClick={() => setDetailsYear(null)}>Fermer</Button>
          <Button
            disabled={detailsSemesters.length >= 3}
            title={detailsSemesters.length >= 3 ? 'Les 3 trimestres de cette année sont déjà créés' : undefined}
            onClick={() => handleOpenCreateSem(detailsYear)}
          >
            Nouveau trimestre
          </Button>
        </>}>
        {detailsSemesters.length === 0 ? (
          <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucun trimestre pour cette année.</p>
        ) : (
          <ul className="ds-detail-list">
            {detailsSemesters.map((s: any) => (
              <li key={s.id} className="ds-parent-row">
                <span className="min-w-0"><strong className="block text-[.86rem] text-ds-text">{s.name}</strong><span className="text-[.74rem] text-ds-text-tertiary">{fmt(s.start_date)} → {fmt(s.end_date)}</span></span>
                <Button variant="ghost" size="sm" iconOnly icon={<Pencil aria-hidden />} aria-label="Modifier" onClick={() => handleOpenEditSem(s)} />
                <Button variant="ghost" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label="Supprimer" onClick={() => deleteSem.mutate(s.id)} />
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
