import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Modal, toast } from '../components/ds';
import { StudentsBoard, type StudentRow } from '../components/students/StudentsBoard';
import { StudentFormPage } from '../components/students/StudentFormPage';

dayjs.extend(customParseFormat);

/** Liste des élèves + fiche détail (§9.3) — conteneur. Routeur legacy `/students`
 *  conservé (garde tout : pièces jointes + « Affecté État », absents de school-students).
 *  Liste en DS ; fiche détail en page dédiée (`/people/students/:id`) ; formulaire
 *  de création/édition en page pleine largeur (au lieu d'une popup) — même
 *  logique de formulaire Ant Design (§12.2). */
export default function StudentsListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filtres liste
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['students', debounced, classId, academicYearId, page, pageSize],
    queryFn: async () => (await api.get('/students', {
      params: { search: debounced || undefined, classId: classId || undefined, academicYearId: academicYearId || undefined, page, limit: pageSize },
    })).data,
  });
  const students: StudentRow[] = data?.data || [];
  const total = data?.pagination?.total ?? students.length;

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  const currentYear = useMemo(() => (academicYears || []).find((y: any) => y.isCurrent), [academicYears]);
  // Sélectionne l'année en cours par défaut à l'arrivée sur la page (une seule fois).
  const defaultYearApplied = useRef(false);
  useEffect(() => {
    if (!defaultYearApplied.current && currentYear?.id) {
      defaultYearApplied.current = true;
      setAcademicYearId(currentYear.id);
    }
  }, [currentYear]);
  // Classe filtrée par année (année sélectionnée, sinon année en cours) via les inscriptions.
  const scopeYearId = academicYearId || currentYear?.id || '';
  const { data: scopedInscriptions } = useQuery({
    queryKey: ['inscriptions-by-year', scopeYearId],
    queryFn: async () => (await api.get('/inscriptions', { params: { academicYearId: scopeYearId } })).data.data || [],
    enabled: !!scopeYearId,
  });
  const classesForYear = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    (scopedInscriptions || []).forEach((i: any) => { if (i.class?.id && !seen.has(i.class.id)) seen.set(i.class.id, { id: i.class.id, name: i.class.name }); });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [scopedInscriptions]);

  // Stat-cards : total élèves + classes actives — par défaut global (toutes
  // années), scopé à l'année sélectionnée si un filtre Année scolaire est actif.
  const { data: statsStudentsData, isLoading: statsStudentsLoading } = useQuery({
    queryKey: ['students-stat-total', academicYearId],
    queryFn: async () => (await api.get('/students', { params: { limit: 1, page: 1, academicYearId: academicYearId || undefined } })).data,
  });
  const totalStudentsStat = statsStudentsData?.pagination?.total ?? 0;

  const { data: allSchoolClasses, isLoading: statsClassesLoading } = useQuery({
    queryKey: ['school-classes-with-count'],
    queryFn: async () => (await api.get('/school-classes')).data.data || [],
    enabled: !academicYearId,
  });
  const activeClassesStat = academicYearId
    ? classesForYear.length
    : (allSchoolClasses || []).filter((c: any) => (c._count?.students ?? 0) > 0).length;
  const statsLoading = statsStudentsLoading || (academicYearId ? !scopedInscriptions && !!scopeYearId : statsClassesLoading);

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/students/${id}`)).data,
    onSuccess: () => { toast.success('Élève supprimé.'); queryClient.invalidateQueries({ queryKey: ['students'] }); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer cet élève.'),
  });

  // Formulaire création / édition (Ant Design, §12.2)
  const [form] = Form.useForm();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [attachmentsToRemove, setAttachmentsToRemove] = useState<string[]>([]);
  const closeForm = () => { setIsFormOpen(false); setEditing(null); setFileList([]); setAttachmentsToRemove([]); form.resetFields(); };
  const openNew = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ isStateAssigned: false }); setFileList([]); setAttachmentsToRemove([]); setIsFormOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setFileList([]); setAttachmentsToRemove([]); setIsFormOpen(true); };

  useEffect(() => {
    if (isFormOpen && editing) {
      const t = setTimeout(() => form.setFieldsValue({
        firstName: editing.firstName, lastName: editing.lastName, gender: editing.gender,
        studentNumber: editing.studentNumber, email: editing.email || '', address: editing.address || '',
        dateOfBirth: editing.dateOfBirth ? dayjs(editing.dateOfBirth).format('DD/MM/YYYY') : '',
        placeOfBirth: editing.placeOfBirth || '', phone: editing.phone || '', isStateAssigned: !!editing.isStateAssigned,
      }), 50);
      return () => clearTimeout(t);
    }
  }, [isFormOpen, editing, form]);

  const createMutation = useMutation({
    mutationFn: async (fd: FormData) => (await api.post('/students', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    onSuccess: () => { toast.success('Élève enregistré.'); queryClient.invalidateQueries({ queryKey: ['students'] }); closeForm(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.response?.data?.error || "Erreur lors de l'enregistrement."),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, fd }: { id: string; fd: FormData }) => (await api.put(`/students/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    onSuccess: () => { toast.success('Élève mis à jour.'); queryClient.invalidateQueries({ queryKey: ['students'] }); queryClient.invalidateQueries({ queryKey: ['student-detail', editing?.id] }); closeForm(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Erreur lors de la mise à jour.'),
  });

  const submitForm = async () => {
    try {
      const values = await form.validateFields();
      const fd = new FormData();
      fd.append('firstName', values.firstName.trim());
      fd.append('lastName', values.lastName.trim());
      fd.append('gender', values.gender);
      fd.append('studentNumber', values.studentNumber.trim());
      if (values.email) fd.append('email', values.email.trim());
      if (values.address) fd.append('address', values.address.trim());
      fd.append('dateOfBirth', dayjs(values.dateOfBirth, 'DD/MM/YYYY', true).format('YYYY-MM-DD'));
      fd.append('placeOfBirth', values.placeOfBirth.trim());
      if (values.phone) fd.append('phone', values.phone);
      fd.append('isStateAssigned', values.isStateAssigned ? 'true' : 'false');
      fileList.forEach((f) => { if (f.originFileObj) fd.append('attachments', f.originFileObj); });
      if (editing && attachmentsToRemove.length > 0) fd.append('attachmentsToRemove', JSON.stringify(attachmentsToRemove));
      if (editing) updateMutation.mutate({ id: editing.id, fd }); else createMutation.mutate(fd);
    } catch { /* validation surfaced inline */ }
  };

  if (isFormOpen) {
    return (
      <div className="animate-fade-in">
        <StudentFormPage
          form={form}
          editing={editing}
          fileList={fileList}
          onFileListChange={setFileList}
          attachmentsToRemove={attachmentsToRemove}
          onRemoveAttachment={(a) => setAttachmentsToRemove((prev) => [...prev, a])}
          onCancel={closeForm}
          onSubmit={submitForm}
          submitting={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <StudentsBoard
        students={students}
        total={total}
        loading={isLoading}
        statsLoading={statsLoading}
        totalStudentsStat={totalStudentsStat}
        activeClassesStat={activeClassesStat}
        search={search}
        onSearchChange={setSearch}
        classId={classId}
        onClassChange={(v) => { setClassId(v); setPage(1); }}
        academicYearId={academicYearId}
        onAcademicYearChange={(v) => { setAcademicYearId(v); setClassId(''); setPage(1); }}
        academicYears={academicYears || []}
        classes={classesForYear}
        view={view}
        onViewChange={setView}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        onNew={openNew}
        onView={(s) => navigate(`/people/students/${s.id}`)}
        onEdit={openEdit}
        onDelete={(s) => setDeleteTarget(s)}
      />

      {/* Confirmation de suppression (DS) */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer cet élève ?"
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
