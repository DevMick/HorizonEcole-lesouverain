import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select } from 'antd';
import {
  ArrowLeft, FileImage, FileOutput, FileText, FileType,
  KeyRound, Copy, Check, Eye, EyeOff, RefreshCw, UserPlus, ShieldCheck,
} from 'lucide-react';
import { api, FILE_BASE } from '../lib/api';
import { Button, Card, Skeleton, Tabs, toast } from '../components/ds';

const MONTHS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
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
 * Fiche détail enseignant — page pleine largeur, même style que StudentProfilePage :
 * onglets Profil / Compte / Classes & Matières (filtrable par année scolaire) / Pièces jointes.
 */
export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('profil');
  const [selectedYearId, setSelectedYearId] = useState('');

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher-detail', id],
    queryFn: async () => (await api.get(`/teachers/${id}`)).data.data || (await api.get(`/teachers/${id}`)).data,
    enabled: !!id,
  });

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  const currentYear = useMemo(() => (academicYears || []).find((y: any) => y.isCurrent), [academicYears]);
  const effectiveYearId = selectedYearId || currentYear?.id || '';

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments', id, effectiveYearId],
    queryFn: async () => (await api.get(`/teachers/${id}/assignments`, { params: { academicYearId: effectiveYearId } })).data.data || [],
    enabled: !!id && !!effectiveYearId && tab === 'assignments',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['teacher-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['teachers'] });
  };

  const createAccountM = useMutation({
    mutationFn: async () => (await api.post(`/teachers/${id}/create-account`)).data,
    onSuccess: (res) => { toast.success(res?.message || 'Compte créé — identifiants disponibles ci-dessous.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de créer le compte.'),
  });

  const resetPasswordM = useMutation({
    mutationFn: async () => (await api.post(`/teachers/${id}/reset-password`)).data,
    onSuccess: (res) => { toast.success(res?.message || 'Mot de passe réinitialisé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de réinitialiser le mot de passe.'),
  });

  if (!id) return null;

  const name = teacher ? `${teacher.last_name ?? ''} ${teacher.first_name ?? ''}`.trim() : '';
  const attachments: { name: string; url: string }[] = (teacher?.attachments || []).map((a: string) => ({ name: a.split('/').pop() || 'document', url: `${FILE_BASE}${a}` }));
  const hasAccount = !!teacher?.user_id;

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={() => navigate('/people/teachers')} />
        {isLoading ? (
          <Skeleton height={40} width={220} className="rounded-lg" />
        ) : (
          <>
            <span className="ds-avatar" style={{ background: colorFor(teacher?.last_name || id) }} aria-hidden>{initials(teacher?.first_name, teacher?.last_name)}</span>
            <div>
              <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">{name || 'Enseignant'}</h1>
              <p className="mt-1 font-mono text-sm text-ds-text-tertiary">{teacher?.email || '—'}</p>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <Card><Skeleton height={200} className="rounded-lg" /></Card>
      ) : !teacher ? (
        <Card className="text-center" accent="danger"><p className="text-ds-text-secondary">Enseignant introuvable.</p></Card>
      ) : (
        <Card>
          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            aria-label="Détail enseignant"
            items={[
              { key: 'profil', label: 'Profil' },
              { key: 'compte', label: 'Compte' },
              { key: 'assignments', label: 'Classes & Matières' },
              { key: 'pieces', label: `Pièces jointes${attachments.length ? ` (${attachments.length})` : ''}` },
            ]}
          />

          {tab === 'profil' && (
            <div className="ds-detail-list">
              <Row label="Nom" value={teacher.last_name} />
              <Row label="Prénom" value={teacher.first_name} />
              <Row label="Email" value={teacher.email} />
              <Row label="Contact" value={teacher.phone} />
              <Row label="Type de contrat" value={teacher.contract_type} />
              <Row label="Date d'embauche" value={frDate(teacher.hire_date)} />
              <Row
                label="Matières"
                value={
                  (teacher.subjects || []).length === 0 ? undefined : (
                    <span className="flex flex-wrap gap-1.5">
                      {teacher.subjects.map((s: any) => (
                        <span key={s.id} className="ds-badge ds-badge-role">{s.name}</span>
                      ))}
                    </span>
                  )
                }
              />
            </div>
          )}

          {tab === 'compte' && (
            hasAccount ? (
              <div className="ds-detail-list">
                <Row
                  label="Statut"
                  value={
                    <span className="inline-flex items-center gap-1.5 text-success-600">
                      <ShieldCheck width={16} height={16} aria-hidden /> Compte actif · Enseignant
                    </span>
                  }
                />
                <CredentialRow label="Login" value={teacher.email} />
                {teacher.generated_password ? (
                  <CredentialRow label="Mot de passe" value={teacher.generated_password} secret />
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
                    L'enseignant se connecte avec son email et ce mot de passe.
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
                  <p className="font-medium text-ds-text">Aucun compte pour cet enseignant</p>
                  <p className="mt-1 text-sm text-ds-text-tertiary">
                    Créez un compte : le login sera son email et un mot de passe sera généré automatiquement.
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

          {tab === 'assignments' && (
            <div>
              <label className="ds-field mb-4 w-64">
                <span>Année scolaire</span>
                <Select
                  value={effectiveYearId || undefined}
                  placeholder="Sélectionner une année"
                  onChange={(v) => setSelectedYearId(v || '')}
                  options={(academicYears || []).map((y: any) => ({
                    value: y.id,
                    label: y.isCurrent ? `${y.name} (en cours)` : y.name,
                  }))}
                  style={{ width: '100%' }}
                />
              </label>

              {!effectiveYearId ? (
                <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucune année scolaire disponible.</p>
              ) : assignmentsLoading ? (
                <Skeleton height={140} className="rounded-lg" />
              ) : !assignments || assignments.length === 0 ? (
                <p className="py-4 text-center text-sm text-ds-text-tertiary">
                  Aucune classe assignée pour cette année scolaire.
                </p>
              ) : (
                <ul className="ds-detail-list">
                  {assignments.map((a: any) => (
                    <li key={`${a.academicYear?.id}-${a.class?.id}`} className="ds-parent-row items-start">
                      <span className="min-w-0 flex-1">
                        <strong className="block text-[.9rem] text-ds-text">{a.class?.name || '—'}</strong>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {(a.subjects || []).length === 0 ? (
                            <span className="text-xs text-ds-text-tertiary">Aucune matière</span>
                          ) : (
                            a.subjects.map((s: any, i: number) => (
                              <span key={s?.id || i} className="ds-badge ds-badge-role">{s?.name}</span>
                            ))
                          )}
                        </span>
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
