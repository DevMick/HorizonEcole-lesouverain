import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, KeyRound, Copy, Check, Eye, EyeOff, RefreshCw, UserPlus, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Skeleton, Tabs, toast } from '../components/ds';

const RELATION_LABEL: Record<string, string> = { PERE: 'Père', MERE: 'Mère', TUTEUR: 'Tuteur', AUTRE: 'Autre' };

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-detail-row">
      <span className="ds-detail-label">{label}</span>
      <span className="ds-detail-value">{value ?? '—'}</span>
    </div>
  );
}

/** Petit bouton « copier » avec retour visuel (coche) pendant ~1,5s. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copie impossible.');
    }
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      aria-label={copied ? 'Copié' : `Copier ${label}`}
      onClick={onCopy}
    />
  );
}

/** Ligne d'identifiant : libellé + valeur monospace + actions (copier, masquer). */
function CredentialRow({
  label, value, secret,
}: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(!secret);
  const display = secret && !revealed ? '•'.repeat(Math.max(value.length, 8)) : value;
  return (
    <div className="ds-detail-row items-center">
      <span className="ds-detail-label">{label}</span>
      <span className="ds-detail-value flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-black/[0.04] px-2 py-1 font-mono text-[.85rem] text-ds-text">
          {display}
        </code>
        {secret && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            aria-label={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            onClick={() => setRevealed((v) => !v)}
          />
        )}
        <CopyButton value={value} label={label.toLowerCase()} />
      </span>
    </div>
  );
}

/**
 * Fiche détail parent — page pleine largeur (miroir de StudentProfilePage) :
 * informations du parent + liste des élèves rattachés (lecture seule, le
 * rattachement se fait à la création du parent ou depuis la fiche élève).
 */
export default function ParentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('profil');

  const { data: parent, isLoading } = useQuery({
    queryKey: ['parent-detail', id],
    queryFn: async () => (await api.get(`/parents/${id}`)).data.data,
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['parent-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['parents'] });
  };

  const createAccountM = useMutation({
    mutationFn: async () => (await api.post(`/parents/${id}/create-account`)).data,
    onSuccess: (res) => { toast.success(res?.message || 'Compte créé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de créer le compte.'),
  });

  const resetPasswordM = useMutation({
    mutationFn: async () => (await api.post(`/parents/${id}/reset-password`)).data,
    onSuccess: (res) => { toast.success(res?.message || 'Mot de passe réinitialisé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de réinitialiser le mot de passe.'),
  });

  if (!id) return null;

  const name = parent ? `${parent.lastName ?? ''} ${parent.firstName ?? ''}`.trim() : '';
  const students = parent?.studentParents || [];
  const hasAccount = !!parent?.userId;
  const accountActive = !!parent?.user?.isActive;
  const accountLogin = parent?.user?.email || '';

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={() => navigate('/people/parents')} />
        {isLoading ? (
          <Skeleton height={40} width={220} className="rounded-lg" />
        ) : (
          <>
            <span className="ds-avatar" style={{ background: colorFor(parent?.lastName || id) }} aria-hidden>{initials(parent?.firstName, parent?.lastName)}</span>
            <div>
              <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">{name || 'Parent'}</h1>
              <p className="mt-1 text-sm text-ds-text-tertiary">{parent?.relation ? RELATION_LABEL[parent.relation] || parent.relation : '—'}</p>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <Card><Skeleton height={200} className="rounded-lg" /></Card>
      ) : !parent ? (
        <Card className="text-center" accent="danger"><p className="text-ds-text-secondary">Parent introuvable.</p></Card>
      ) : (
        <Card>
          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            aria-label="Détail parent"
            items={[
              { key: 'profil', label: 'Profil' },
              { key: 'compte', label: 'Compte' },
              { key: 'eleves', label: `Élèves rattachés${students.length ? ` (${students.length})` : ''}` },
            ]}
          />

          {tab === 'profil' && (
            <div className="ds-detail-list">
              <Row label="Nom" value={parent.lastName} />
              <Row label="Prénom" value={parent.firstName} />
              <Row label="Relation" value={RELATION_LABEL[parent.relation] || parent.relation} />
              <Row label="Contact" value={parent.phone} />
              <Row label="Email" value={parent.email} />
              {parent.address && <Row label="Adresse" value={parent.address} />}
              {parent.profession && <Row label="Profession" value={parent.profession} />}
              {parent.workplace && <Row label="Lieu de travail" value={parent.workplace} />}
            </div>
          )}

          {tab === 'compte' && (
            hasAccount ? (
              <div className="ds-detail-list">
                <Row
                  label="Statut"
                  value={
                    accountActive ? (
                      <span className="inline-flex items-center gap-1.5 text-success-600">
                        <ShieldCheck width={16} height={16} aria-hidden /> Compte actif · Parent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-warning-600">
                        <ShieldAlert width={16} height={16} aria-hidden /> Compte inactif · email manquant
                      </span>
                    )
                  }
                />
                {accountActive ? (
                  <CredentialRow label="Login" value={accountLogin} />
                ) : (
                  <Row
                    label="Login"
                    value={
                      <span className="text-ds-text-tertiary">
                        Indisponible tant qu'aucune adresse email n'est renseignée.
                      </span>
                    }
                  />
                )}
                {parent.generatedPassword ? (
                  <CredentialRow label="Mot de passe" value={parent.generatedPassword} secret />
                ) : (
                  <Row
                    label="Mot de passe"
                    value={
                      <span className="text-ds-text-tertiary">
                        Non disponible (compte antérieur) — réinitialisez-le pour en générer un nouveau.
                      </span>
                    }
                  />
                )}
                <div className="flex items-center justify-between gap-3 pt-3">
                  <p className="text-xs text-ds-text-tertiary">
                    {accountActive
                      ? 'Le parent se connecte avec son email et ce mot de passe.'
                      : 'Renseignez une adresse email dans le profil pour activer ce compte.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RefreshCw aria-hidden />}
                    loading={resetPasswordM.isPending}
                    onClick={() => resetPasswordM.mutate()}
                  >
                    Réinitialiser le mot de passe
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] text-ds-text-tertiary">
                  <KeyRound aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-ds-text">Aucun compte pour ce parent</p>
                  <p className="mt-1 text-sm text-ds-text-tertiary">
                    Créez un compte : avec une adresse email il sera actif, sinon il restera
                    inactif jusqu'à ce qu'une adresse soit renseignée.
                  </p>
                </div>
                <Button
                  icon={<UserPlus aria-hidden />}
                  loading={createAccountM.isPending}
                  onClick={() => createAccountM.mutate()}
                >
                  Créer le compte
                </Button>
              </div>
            )
          )}

          {tab === 'eleves' && (
            students.length === 0 ? (
              <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucun élève rattaché.</p>
            ) : (
              <ul className="ds-detail-list">
                {students.map((sp: any) => (
                  <li
                    key={sp.id}
                    className="ds-parent-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/people/students/${sp.student.id}`)}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-[.86rem] text-ds-text">{sp.student?.lastName} {sp.student?.firstName}</strong>
                    </span>
                    {sp.student?.class?.name && <span className="ds-badge ds-badge-role">{sp.student.class.name}</span>}
                    <span className="ds-badge ds-badge-neutral">{RELATION_LABEL[sp.relation] || sp.relation}</span>
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
