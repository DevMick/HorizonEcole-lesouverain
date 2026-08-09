import { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { BookOpen, Link2, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Card, Skeleton, toast } from '../components/ds';
import { cn } from '../lib/utils';

/**
 * Affectation des matières (§10) — full DS « Encre & Craie ».
 * Classe → cases à cocher des matières (état `isAssigned`) → enregistrement en lot
 * (`POST /subject-assignments/class/:classId { subjectIds }`).
 */

export default function SubjectAssignmentPage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [alsoApplyTo, setAlsoApplyTo] = useState<string[]>([]);

  const { data: classes } = useQuery({
    queryKey: ['assignment-classes'],
    queryFn: async () => (await api.get('/subject-assignments/classes')).data.data || [],
  });
  const { data: subjects, isLoading } = useQuery({
    queryKey: ['assignment-subjects', classId],
    queryFn: async () => classId ? (await api.get(`/subject-assignments/class/${classId}`)).data.data || [] : [],
    enabled: !!classId,
  });
  useEffect(() => { setSelected((subjects || []).filter((s: any) => s.isAssigned).map((s: any) => s.id)); }, [subjects]);

  const saveM = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/subject-assignments/class/${classId}`, { subjectIds: selected });
      if (alsoApplyTo.length > 0) {
        await Promise.all(alsoApplyTo.map((id) =>
          api.post(`/subject-assignments/class/${id}`, { subjectIds: selected }).catch(() => {
            toast.error(`Échec de l'application à une classe.`);
          })));
      }
      return res.data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.message || (alsoApplyTo.length > 0 ? `Affectations appliquées à ${1 + alsoApplyTo.length} classes.` : 'Affectations enregistrées.'));
      queryClient.invalidateQueries({ queryKey: ['assignment-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-classes'] });
      setAlsoApplyTo([]);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de l'enregistrement."),
  });

  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const className = useMemo(() => classes?.find((c: any) => c.id === classId)?.name, [classes, classId]);
  const otherClassOptions = useMemo(() => (classes || []).filter((c: any) => c.id !== classId).map((c: any) => ({ value: c.id, label: c.name })), [classes, classId]);

  return (
    <div className="animate-fade-in mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Affectation des matières</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">Matières enseignées dans chaque classe.</p>
        </div>
        {classId && <Button icon={<Save aria-hidden />} loading={saveM.isPending} onClick={() => saveM.mutate()}>Enregistrer</Button>}
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="ds-field min-w-[240px] flex-1">
            <span>Classe</span>
            <Select
              placeholder="Choisissez une classe…"
              value={classId || undefined}
              onChange={(value) => { setClassId(value); setSelected([]); setAlsoApplyTo([]); }}
              options={(classes || []).map((c: any) => ({
                value: c.id,
                label: `${c.name} (${c._count?.classSubjects ?? 0} matière${(c._count?.classSubjects ?? 0) > 1 ? 's' : ''})`,
              }))}
              style={{ width: '100%' }}
            />
          </label>
          {classId && <span className="ds-badge ds-badge-role mb-2">{selected.length} / {subjects?.length ?? 0} sélectionnées</span>}
        </div>
        {classId && otherClassOptions.length > 0 && (
          <label className="ds-field mt-3">
            <span>Appliquer aussi ces matières à d'autres classes (optionnel)</span>
            <Select
              mode="multiple"
              placeholder="Ex. autres divisions du même niveau…"
              showSearch
              optionFilterProp="label"
              value={alsoApplyTo}
              onChange={(ids) => setAlsoApplyTo(ids)}
              options={otherClassOptions}
              style={{ width: '100%' }}
            />
          </label>
        )}
      </Card>

      {!classId ? (
        <Card className="text-center" accent="info">
          <Link2 className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Sélectionnez une classe</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez une classe pour affecter ses matières.</p>
        </Card>
      ) : isLoading ? (
        <div className="ds-check-grid">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={44} className="rounded-lg" />)}</div>
      ) : (subjects || []).length === 0 ? (
        <Card className="text-center" accent="warning"><p className="text-sm text-ds-text-secondary">Aucune matière trouvée.</p></Card>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <strong className="font-display text-ds-text">Matières — {className}</strong>
            <span className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected((subjects || []).map((s: any) => s.id))}>Tout</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Aucune</Button>
            </span>
          </div>
          <div className="ds-check-grid">
            {(subjects || []).map((s: any) => {
              const on = selected.includes(s.id);
              return (
                <label key={s.id} className={cn('ds-check', on && 'ds-check-on')}>
                  <input type="checkbox" checked={on} onChange={() => toggle(s.id)} />
                  <BookOpen width={16} height={16} aria-hidden />
                  <span className="min-w-0 truncate">{s.name}{s.code ? <span className="text-ds-text-tertiary"> · {s.code}</span> : null}</span>
                </label>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
