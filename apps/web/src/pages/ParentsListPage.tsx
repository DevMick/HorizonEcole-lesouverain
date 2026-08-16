import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Modal, toast } from '../components/ds';
import { ParentsBoard, type ParentRow } from '../components/parents/ParentsBoard';
import { ParentFormPage } from '../components/parents/ParentFormPage';

/** Liste des parents + fiche détail — conteneur. Liste en DS ; fiche détail en page dédiée (`/people/parents/:id`) ; formulaire
 *  de création/édition en page pleine largeur (au lieu d'une popup) — même
 *  logique de formulaire Ant Design. */
export default function ParentsListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filtres liste
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['parents', debounced, page, pageSize],
    queryFn: async () => (await api.get('/parents', {
      params: { search: debounced || undefined, page, limit: pageSize },
    })).data,
  });
  const parents: ParentRow[] = data?.data || [];
  const total = data?.pagination?.total ?? parents.length;

  // Stat-cards
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['parents-stat-total'],
    queryFn: async () => (await api.get('/parents', { params: { limit: 1, page: 1 } })).data,
  });
  const totalParentsStat = statsData?.pagination?.total ?? 0;

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState<ParentRow | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/parents/${id}`)).data,
    onSuccess: () => { toast.success('Parent supprimé.'); queryClient.invalidateQueries({ queryKey: ['parents'] }); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer ce parent.'),
  });

  // Formulaire création / édition (Ant Design)
  const [form] = Form.useForm();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const closeForm = () => { setIsFormOpen(false); setEditing(null); setSelectedStudentIds([]); form.resetFields(); };
  const openNew = () => { setEditing(null); setSelectedStudentIds([]); form.resetFields(); setIsFormOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setSelectedStudentIds([]); setIsFormOpen(true); };

  useEffect(() => {
    if (isFormOpen && editing) {
      const t = setTimeout(() => form.setFieldsValue({
        firstName: editing.firstName, lastName: editing.lastName,
        phone: editing.phone, email: editing.email || '', relation: editing.relation,
      }), 50);
      return () => clearTimeout(t);
    }
  }, [isFormOpen, editing, form]);

  // Élèves déjà rattachés au parent en édition (pour affichage + exclusion du sélecteur d'ajout).
  const linkedStudents = useMemo(
    () => (editing?.studentParents || []).map((sp: any) => ({
      studentId: sp.student?.id,
      name: `${sp.student?.lastName ?? ''} ${sp.student?.firstName ?? ''}`.trim(),
      studentNumber: sp.student?.studentNumber,
      className: sp.student?.class?.name,
      relation: sp.relation,
    })),
    [editing],
  );
  const linkedIds = useMemo(() => new Set(linkedStudents.map((s: any) => s.studentId)), [linkedStudents]);

  // Élèves disponibles pour le rattachement (création ou ajout en édition).
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-for-parent-link'],
    queryFn: async () => (await api.get('/students', { params: { limit: 1000, page: 1 } })).data,
    enabled: isFormOpen,
  });
  // Un élève déjà rattaché à un parent — celui en cours d'édition ou un autre —
  // n'est plus proposé au rattachement.
  const studentOptions = useMemo(
    () => (studentsData?.data || [])
      .filter((s: any) => !linkedIds.has(s.id) && !(s.studentParents?.length > 0))
      .map((s: any) => ({
        id: s.id,
        label: `${s.lastName ?? ''} ${s.firstName ?? ''}`.trim(),
      })),
    [studentsData, linkedIds],
  );

  const linkStudents = async (parentId: string, relation: string, studentIds: string[]) => {
    if (studentIds.length === 0) return;
    await Promise.all(studentIds.map((studentId) =>
      api.post(`/students/${studentId}/parents`, { parentId, relation }).catch((e) => {
        toast.error(e?.response?.data?.error || `Échec du rattachement d'un élève.`);
      })));
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const dissociateMutation = useMutation({
    mutationFn: async (studentId: string) => (await api.delete(`/students/${studentId}/parents/${editing?.id}`)).data,
    onSuccess: (_res, studentId) => {
      toast.success('Élève dissocié.');
      setEditing((e: any) => (e ? { ...e, studentParents: (e.studentParents || []).filter((sp: any) => sp.student?.id !== studentId) } : e));
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Échec de la dissociation.'),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post('/parents', payload)).data,
    onSuccess: async (res, payload) => {
      toast.success('Parent enregistré.');
      const newParentId = res?.data?.id;
      if (newParentId && selectedStudentIds.length > 0) {
        await linkStudents(newParentId, payload.relation, selectedStudentIds);
        toast.success(`${selectedStudentIds.length} élève${selectedStudentIds.length > 1 ? 's' : ''} rattaché${selectedStudentIds.length > 1 ? 's' : ''}.`);
      }
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      closeForm();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.response?.data?.error || "Erreur lors de l'enregistrement."),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => (await api.put(`/parents/${id}`, payload)).data,
    onSuccess: async (_res, variables) => {
      toast.success('Parent mis à jour.');
      if (selectedStudentIds.length > 0) {
        await linkStudents(variables.id, variables.relation, selectedStudentIds);
        toast.success(`${selectedStudentIds.length} élève${selectedStudentIds.length > 1 ? 's' : ''} rattaché${selectedStudentIds.length > 1 ? 's' : ''}.`);
      }
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['parent-detail', editing?.id] });
      closeForm();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Erreur lors de la mise à jour.'),
  });

  const submitForm = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone,
        relation: values.relation,
        email: values.email ? values.email.trim() : undefined,
      };
      if (editing) updateMutation.mutate({ id: editing.id, ...payload }); else createMutation.mutate(payload);
    } catch { /* validation surfaced inline */ }
  };

  if (isFormOpen) {
    return (
      <div className="animate-fade-in">
        <ParentFormPage
          form={form}
          editing={editing}
          fileList={[]}
          onFileListChange={() => {}}
          attachmentsToRemove={[]}
          onRemoveAttachment={() => {}}
          onCancel={closeForm}
          onSubmit={submitForm}
          submitting={createMutation.isPending || updateMutation.isPending}
          studentOptions={studentOptions}
          studentsLoading={studentsLoading}
          selectedStudentIds={selectedStudentIds}
          onSelectedStudentsChange={setSelectedStudentIds}
          linkedStudents={linkedStudents}
          onDissociate={(studentId) => dissociateMutation.mutate(studentId)}
          dissociatingId={dissociateMutation.isPending ? (dissociateMutation.variables as string) : null}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <ParentsBoard
        parents={parents}
        total={total}
        loading={isLoading}
        statsLoading={statsLoading}
        totalParentsStat={totalParentsStat}
        search={search}
        onSearchChange={setSearch}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(n: number) => { setPageSize(n); setPage(1); }}
        onNew={openNew}
        onView={(p: ParentRow) => navigate(`/people/parents/${p.id}`)}
        onEdit={openEdit}
        onDelete={(p: ParentRow) => setDeleteTarget(p)}
      />

      {/* Confirmation de suppression (DS) */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer ce parent ?"
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Supprimer</Button>
          </>
        }
      >
        <p className="text-sm text-ds-text-secondary">
          <strong className="text-ds-text">{deleteTarget?.lastName} {deleteTarget?.firstName}</strong> sera définitivement supprimé. Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
}
