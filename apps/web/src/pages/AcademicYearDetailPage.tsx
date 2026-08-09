import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Skeleton } from '../components/ds';

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (s?: string) => s?.substring(0, 2).toUpperCase() || 'AN';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-detail-row">
      <span className="ds-detail-label">{label}</span>
      <span className="ds-detail-value">{value ?? '—'}</span>
    </div>
  );
}

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

/**
 * Fiche détail année scolaire — page pleine largeur, même style que StudentProfilePage :
 * affichage direct des informations et trimestres sans onglets.
 */
export default function AcademicYearDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: year, isLoading } = useQuery({
    queryKey: ['academic-year-detail', id],
    queryFn: async () => (await api.get(`/academic-years/${id}`)).data.data || (await api.get(`/academic-years/${id}`)).data,
    enabled: !!id,
  });

  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: async () => (await api.get('/semesters')).data.data || [],
  });
  const yearSemesters = (semesters || []).filter((s: any) => s.academic_year_id === id);

  if (!id) return null;

  const name = year?.name || 'Année scolaire';

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={() => navigate('/academic/years')} />
        {isLoading ? (
          <Skeleton height={40} width={220} className="rounded-lg" />
        ) : (
          <>
            <span className="ds-avatar" style={{ background: colorFor(year?.name || id) }} aria-hidden>{initials(year?.name)}</span>
            <div>
              <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">{name}</h1>
              <p className="mt-1 font-mono text-sm text-ds-text-tertiary">{year?.is_current ? 'Année en cours' : 'Année non active'}</p>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <Card><Skeleton height={200} className="rounded-lg" /></Card>
      ) : !year ? (
        <Card className="text-center" accent="danger"><p className="text-ds-text-secondary">Année scolaire introuvable.</p></Card>
      ) : (
        <Card>
          <div className="ds-detail-list">
            <Row label="Nom" value={year.name} />
            <Row label="Année de début" value={year.startYear} />
            <Row label="Année de fin" value={year.endYear} />
            <Row label="Statut" value={year.is_current ? 'En cours' : 'Non active'} />
          </div>

          <h3 className="mt-6 mb-4 font-semibold text-ds-text">Trimestres ({yearSemesters.length})</h3>
          {yearSemesters.length === 0 ? (
            <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucun trimestre pour cette année scolaire.</p>
          ) : (
            <ul className="ds-detail-list">
              {yearSemesters.map((s: any) => (
                <li key={s.id} className="ds-parent-row">
                  <span className="min-w-0">
                    <strong className="block text-[.86rem] text-ds-text">{s.name}</strong>
                    <span className="text-[.74rem] text-ds-text-tertiary">{fmt(s.start_date)} → {fmt(s.end_date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
