import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileImage, FileOutput, FileText, FileType,
  KeyRound, Copy, Check, Eye, EyeOff, RefreshCw, UserPlus, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Skeleton, Tabs, toast } from '../components/ds';

const API_BASE = 'http://localhost:4001';

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();
const frDate = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

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

type AttachmentKind = 'image' | 'pdf' | 'other';
function attachmentKind(filename: string): AttachmentKind {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}
function AttachmentIcon({ filename }: { filename: string }) {
  const kind = attachmentKind(filename);
  if (kind === 'image') return <FileImage aria-hidden />;
  if (kind === 'pdf') return <FileType aria-hidden />;
  return <FileText aria-hidden />;
}

/**
 * Fiche détail élève (§9.3) — page pleine largeur (remplace le tiroir) :
 * onglets Profil / Compte / Parents / Pièces jointes (avec
 * visionneuse intégrée pour images et PDF).
 */
export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('profil');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-detail', id],
    queryFn: async () => (await api.get(`/students/${id}`)).data.data,
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['student-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const createAccountM = useMutation({
    mutationFn: async () => (await api.post(`/students/${id}/create-account`)).data,
    onSuccess: (res) => { toast.success(res?.message || 'Compte créé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de créer le compte.'),
  });

  const resetPasswordM = useMutation({
    mutationFn: async () => (await api.post(`/students/${id}/reset-password`)).data,
    onSuccess: (res) => { toast.success(res?.message || 'Mot de passe réinitialisé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de réinitialiser le mot de passe.'),
  });
  if (!id) return null;

  const name = student ? `${student.lastName ?? ''} ${student.firstName ?? ''}`.trim() : '';
  const parents = student?.studentParents || [];
  const hasAccount = !!student?.userId;
  const accountActive = !!student?.user?.isActive;
  const accountLogin = student?.user?.email || '';
  const attachments: { name: string; url: string }[] = (student?.attachments || []).map((a: string) => ({ name: a.split('/').pop() || 'document', url: `${API_BASE}${a}` }));

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={() => navigate('/people/students')} />
        {isLoading ? (
          <Skeleton height={40} width={220} className="rounded-lg" />
        ) : (
          <>
            <span className="ds-avatar" style={{ background: colorFor(student?.lastName || id) }} aria-hidden>{initials(student?.firstName, student?.lastName)}</span>
            <div>
              <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">{name || 'Élève'}</h1>
              <p className="mt-1 font-mono text-sm text-ds-text-tertiary">{student?.studentNumber || '—'}</p>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <Card><Skeleton height={200} className="rounded-lg" /></Card>
      ) : !student ? (
        <Card className="text-center" accent="danger"><p className="text-ds-text-secondary">Élève introuvable.</p></Card>
      ) : (
        <Card>
          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            aria-label="Détail élève"
            items={[
              { key: 'profil', label: 'Profil' },
              { key: 'compte', label: 'Compte' },
              { key: 'parents', label: `Parents${parents.length ? ` (${parents.length})` : ''}` },
              { key: 'pieces', label: `Pièces jointes${attachments.length ? ` (${attachments.length})` : ''}` },
            ]}
          />

          {tab === 'profil' && (
            <div className="ds-detail-list">
              <Row label="Matricule" value={<span className="font-mono">{student.studentNumber}</span>} />
              <Row label="Nom" value={student.lastName} />
              <Row label="Prénom" value={student.firstName} />
              <Row label="Genre" value={student.gender === 'F' ? 'Féminin' : student.gender === 'M' ? 'Masculin' : student.gender} />
              <Row label="Né(e) le" value={frDate(student.dateOfBirth)} />
              <Row label="Lieu de naissance" value={student.placeOfBirth} />
              <Row label="Statut" value={student.status} />
              <Row label="Contact" value={student.phone} />
              <Row label="Email" value={student.email} />
              <Row label="Résidence" value={student.address} />
              <Row label="Affecté de l'État" value={student.isStateAssigned ? 'Oui' : 'Non'} />
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
                        <ShieldCheck width={16} height={16} aria-hidden /> Compte actif · Élève
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
                {student.generatedPassword ? (
                  <CredentialRow label="Mot de passe" value={student.generatedPassword} secret />
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
                      ? "L'élève se connecte avec son email et ce mot de passe."
                      : "Renseignez une adresse email dans l'onglet Profil pour activer ce compte."}
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
                  <p className="font-medium text-ds-text">Aucun compte pour cet élève</p>
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

          {tab === 'parents' && (
            <div>
              {parents.length === 0 ? (
                <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucun parent rattaché.</p>
              ) : (
                <ul className="ds-detail-list">
                  {parents.map((sp: any) => (
                    <li key={sp.id} className="ds-parent-row">
                      <span className="min-w-0">
                        <strong className="block truncate text-[.86rem] text-ds-text">{sp.parent?.firstName} {sp.parent?.lastName}</strong>
                        <span className="text-[.74rem] text-ds-text-tertiary">{sp.parent?.phone || '—'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'pieces' && (
            attachments.length === 0 ? (
              <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucune pièce jointe.</p>
            ) : (
              <ul className="ds-detail-list">
                {attachments.map((a) => (
                  <li key={a.url} className="ds-parent-row">
                    <span className="min-w-0 flex items-center gap-2">
                      <AttachmentIcon filename={a.name} />
                      <strong className="block truncate text-[.86rem] text-ds-text">{a.name}</strong>
                    </span>
                    <Button variant="ghost" size="sm" icon={<FileOutput aria-hidden />} onClick={() => window.open(a.url, '_blank')}>Ouvrir</Button>
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
