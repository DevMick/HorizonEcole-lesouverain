import { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { BookOpen, Hash, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button, Card, Skeleton, toast } from '../components/ds';

/**
 * Coefficients par classe (§10, cas particulier) — full DS « Encre & Craie ».
 * Grille éditable matière × coefficient + mise à jour en lot
 * (`POST /coefficients/class/:classId/batch`). Coefficients en police mono.
 */

export default function CoefficientsPage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [coeffs, setCoeffs] = useState<Record<string, number>>({});
  const [alsoApplyTo, setAlsoApplyTo] = useState<string[]>([]);

  const { data: classes } = useQuery({
    queryKey: ['coefficients-classes'],
    queryFn: async () => (await api.get('/coefficients/classes')).data.data || [],
  });
  const { data: subjects, isLoading } = useQuery({
    queryKey: ['coefficients-class', classId],
    queryFn: async () => classId ? (await api.get(`/coefficients/class/${classId}`)).data.data || [] : [],
    enabled: !!classId,
  });

  useEffect(() => {
    const next: Record<string, number> = {};
    (subjects || []).forEach((cs: any) => { next[cs.subject.id] = cs.coefficient || 1; });
    setCoeffs(next);
  }, [subjects]);

  const saveM = useMutation({
    mutationFn: async () => {
      const coefficients = Object.entries(coeffs).map(([subjectId, coefficient]) => ({ subjectId, coefficient }));
      const res = await api.post(`/coefficients/class/${classId}/batch`, { coefficients });
      if (alsoApplyTo.length > 0) {
        await Promise.all(alsoApplyTo.map((id) =>
          api.post(`/coefficients/class/${id}/batch`, { coefficients }).catch(() => {
            toast.error(`Échec de l'application à une classe (matières pas encore affectées ?).`);
          })));
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success(alsoApplyTo.length > 0 ? `Coefficients appliqués à ${1 + alsoApplyTo.length} classes.` : 'Coefficients enregistrés.');
      queryClient.invalidateQueries({ queryKey: ['coefficients-class'] });
      setAlsoApplyTo([]);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de l'enregistrement."),
  });

  const rows = useMemo(() => (subjects || []).map((cs: any) => ({ id: cs.subject.id, name: cs.subject.name })), [subjects]);
  const className = classes?.find((c: any) => c.id === classId)?.name;
  const otherClassOptions = useMemo(() => (classes || []).filter((c: any) => c.id !== classId).map((c: any) => ({ value: c.id, label: c.name })), [classes, classId]);

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Coefficients</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">Attribution des coefficients des matières par classe.</p>
        </div>
        {classId && rows.length > 0 && (
          <Button icon={<Save aria-hidden />} loading={saveM.isPending} onClick={() => saveM.mutate()}>Enregistrer</Button>
        )}
      </div>

      <Card className="mb-4">
        <label className="ds-field max-w-sm">
          <span>Classe</span>
          <Select
            placeholder="Choisissez une classe…"
            value={classId || undefined}
            onChange={(value) => { setClassId(value); setCoeffs({}); setAlsoApplyTo([]); }}
            options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
            style={{ width: '100%' }}
          />
        </label>
        {classId && otherClassOptions.length > 0 && (
          <label className="ds-field mt-3">
            <span>Appliquer aussi ces coefficients à d'autres classes (optionnel)</span>
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
          <Hash className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Sélectionnez une classe</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez une classe pour définir les coefficients des matières.</p>
        </Card>
      ) : isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={48} className="rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="text-center" accent="warning">
          <BookOpen className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucune matière affectée</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Affectez d'abord des matières à cette classe via la page « Affectations ».</p>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="ds-coeff-head"><span>Matière — {className}</span><span>Coefficient</span></div>
          <ul className="ds-coeff-list">
            {rows.map((r: any) => (
              <li key={r.id} className="ds-coeff-row">
                <span className="ds-coeff-name"><BookOpen width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} /><strong>{r.name}</strong></span>
                <input
                  type="number" min={1} max={20} className="ds-input font-mono ds-coeff-input"
                  value={coeffs[r.id] ?? 1}
                  onChange={(e) => setCoeffs((prev) => ({ ...prev, [r.id]: e.target.value === '' ? 1 : Number(e.target.value) }))}
                  aria-label={`Coefficient de ${r.name}`}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
