import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  CalendarDays,
  Cake,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Hash,
  Users,
} from 'lucide-react';
import { Button, Card, Skeleton, StatusBadge } from '../components/ds';
import {
  useActiveChild,
  fullName,
  initialsOf,
  type ParentChild,
} from '../lib/hooks/useParentSpace';

/**
 * Mes enfants (§10) — la fiche d'identité scolaire de chaque enfant rattaché.
 *
 * Une carte par enfant plutôt qu'une liste : le parent en a un à trois, la
 * densité n'est pas l'enjeu — la lisibilité et l'accès direct aux trois écrans
 * de suivi le sont. Chaque carte porte donc ses propres actions, ce qui évite
 * l'aller-retour « choisir l'enfant, puis choisir l'écran ».
 */

const STATUS_BADGE: Record<string, { label: string; kind: 'success' | 'warning' | 'neutral' }> = {
  ACTIVE: { label: 'Inscrit', kind: 'success' },
  SUSPENDED: { label: 'Suspendu', kind: 'warning' },
  GRADUATED: { label: 'Diplômé', kind: 'neutral' },
  TRANSFERRED: { label: 'Transféré', kind: 'neutral' },
  INACTIVE: { label: 'Inactif', kind: 'neutral' },
};

const RELATION_LABEL: Record<string, string> = {
  PERE: 'Père',
  MERE: 'Mère',
  TUTEUR: 'Tuteur',
  AUTRE: 'Autre',
};

function ageOf(dateOfBirth?: string) {
  if (!dateOfBirth) return null;
  const years = dayjs().diff(dayjs(dateOfBirth), 'year');
  return Number.isFinite(years) ? years : null;
}

function ChildCard({
  child,
  onOpen,
}: {
  child: ParentChild;
  onOpen: (path: string, childId: string) => void;
}) {
  const status = STATUS_BADGE[String(child.status)] ?? { label: String(child.status ?? '—'), kind: 'neutral' as const };
  const age = ageOf(child.dateOfBirth);

  return (
    <Card accent className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[.95rem] font-bold text-white"
          style={{ background: 'var(--role-accent)' }}
          aria-hidden
        >
          {child.avatarUrl ? (
            <img src={child.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            initialsOf(child)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate font-display text-[1rem] text-ds-text">
            {fullName(child)}
          </strong>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[.8rem] text-ds-text-tertiary">
            <span className="inline-flex items-center gap-1">
              <GraduationCap width={12} height={12} aria-hidden />
              {child.class?.name ?? 'Sans classe'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash width={12} height={12} aria-hidden />
              <span className="font-mono">{child.studentNumber}</span>
            </span>
          </span>
        </div>
        <StatusBadge status={status.kind}>{status.label}</StatusBadge>
      </div>

      <dl className="ds-detail-list">
        <div className="ds-detail-row">
          <dt className="ds-detail-label">
            <span className="inline-flex items-center gap-1.5">
              <Cake width={13} height={13} aria-hidden />
              Date de naissance
            </span>
          </dt>
          <dd className="ds-detail-value font-mono">
            {child.dateOfBirth ? dayjs(child.dateOfBirth).format('DD/MM/YYYY') : '—'}
            {age !== null ? (
              <span className="ml-1.5 font-sans text-ds-text-tertiary">({age} ans)</span>
            ) : null}
          </dd>
        </div>
        <div className="ds-detail-row">
          <dt className="ds-detail-label">Lien de parenté</dt>
          <dd className="ds-detail-value">
            {RELATION_LABEL[String(child.relation)] ?? child.relation ?? '—'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<CalendarDays aria-hidden />}
          onClick={() => onOpen('/parent/timetable', child.id)}
        >
          Emploi du temps
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<ClipboardCheck aria-hidden />}
          onClick={() => onOpen('/parent/attendance', child.id)}
        >
          Présences
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<FileText aria-hidden />}
          onClick={() => onOpen('/parent/bulletins', child.id)}
        >
          Bulletins
        </Button>
      </div>
    </Card>
  );
}

export default function ParentChildrenPage() {
  const navigate = useNavigate();
  const { children, setChildId, isLoading } = useActiveChild();

  const open = (path: string, childId: string) => {
    setChildId(childId);
    navigate(path);
  };

  return (
    <div className="animate-fade-in mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
          Mes enfants
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Les élèves rattachés à votre compte, et l'accès direct à leur suivi.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} height={240} className="rounded-lg" />
          ))}
        </div>
      ) : children.length === 0 ? (
        <Card className="text-center" accent="info">
          <Users className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun enfant rattaché</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ds-text-secondary">
            Votre compte n'est encore rattaché à aucun élève. Contactez le secrétariat de
            l'établissement pour effectuer le rattachement.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((c) => (
            <ChildCard key={c.id} child={c} onOpen={open} />
          ))}
        </div>
      )}
    </div>
  );
}
