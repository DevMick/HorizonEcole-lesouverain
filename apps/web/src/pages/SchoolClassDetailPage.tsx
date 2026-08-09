import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Skeleton, Tabs } from '../components/ds';

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (s?: string) => s?.substring(0, 2).toUpperCase() || 'CL';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-detail-row">
      <span className="ds-detail-label">{label}</span>
      <span className="ds-detail-value">{value ?? '—'}</span>
    </div>
  );
}

/**
 * Fiche détail classe — page pleine largeur, même style que StudentProfilePage :
 * onglets Informations / Matières.
 */
export default function SchoolClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profil');

  const { data: schoolClass, isLoading } = useQuery({
    queryKey: ['school-class-detail', id],
    queryFn: async () => (await api.get(`/school-classes/${id}`)).data.data || (await api.get(`/school-classes/${id}`)).data,
    enabled: !!id,
  });

  const { data: classSubjects } = useQuery({
    queryKey: ['class-subjects'],
    queryFn: async () => (await api.get('/class-subjects')).data.data || [],
  });
  const classSubjectsForClass = (classSubjects || []).filter((cs: any) => cs.school_class_id === id);

  if (!id) return null;

  const name = schoolClass?.name || 'Classe';

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={() => navigate('/academic/classes')} />
        {isLoading ? (
          <Skeleton height={40} width={220} className="rounded-lg" />
        ) : (
          <>
            <span className="ds-avatar" style={{ background: colorFor(schoolClass?.name || id) }} aria-hidden>{initials(schoolClass?.name)}</span>
            <div>
              <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">{name}</h1>
              <p className="mt-1 font-mono text-sm text-ds-text-tertiary">{schoolClass?._count?.classSubjects ?? 0} matière{(schoolClass?._count?.classSubjects ?? 0) > 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <Card><Skeleton height={200} className="rounded-lg" /></Card>
      ) : !schoolClass ? (
        <Card className="text-center" accent="danger"><p className="text-ds-text-secondary">Classe introuvable.</p></Card>
      ) : (
        <Card>
          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            aria-label="Détail classe"
            items={[
              { key: 'profil', label: 'Informations' },
              { key: 'matieres', label: `Matières${classSubjectsForClass.length ? ` (${classSubjectsForClass.length})` : ''}` },
            ]}
          />

          {tab === 'profil' && (
            <div className="ds-detail-list">
              <Row label="Nom" value={schoolClass.name} />
            </div>
          )}

          {tab === 'matieres' && (
            classSubjectsForClass.length === 0 ? (
              <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucune matière assignée pour cette classe.</p>
            ) : (
              <ul className="ds-detail-list">
                {classSubjectsForClass.map((cs: any) => (
                  <li key={cs.id} className="ds-parent-row">
                    <span className="min-w-0">
                      <strong className="block text-[.86rem] text-ds-text">{cs.subject?.name || 'Matière'}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}
        </Card>
      )}
    </div>
  );
}
