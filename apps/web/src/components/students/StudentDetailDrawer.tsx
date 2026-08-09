import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Button, Drawer, Skeleton, Tabs } from '../ds';

const RELATION_LABEL: Record<string, string> = { PERE: 'Père', MERE: 'Mère', TUTEUR: 'Tuteur', AUTRE: 'Autre' };
const RELATIONS = Object.keys(RELATION_LABEL);
const MONTHS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export interface StudentDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  student: any | null;
  grades: any[];
  gradesLoading?: boolean;
  attendance: any[];
  attendanceLoading?: boolean;
  attachments?: { name: string; url: string }[];
  availableParents: { id: string; name: string }[];
  onAddParent: (parentId: string, relation: string) => void;
  onRemoveParent: (studentParent: any) => void;
  parentPending?: boolean;
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();
const frDate = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const num = (n: number | string) => String(typeof n === 'number' ? n : parseFloat(n));

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-detail-row">
      <span className="ds-detail-label">{label}</span>
      <span className="ds-detail-value">{value ?? '—'}</span>
    </div>
  );
}

/** Fiche détail élève (§9.3) — tiroir à onglets Profil / Parents / Notes / Présences. */
export function StudentDetailDrawer(props: StudentDetailDrawerProps) {
  const { open, onClose, student, grades, gradesLoading, attendance, attendanceLoading, attachments = [], availableParents, onAddParent, onRemoveParent, parentPending } = props;
  const [tab, setTab] = useState('profil');
  const [newParent, setNewParent] = useState('');
  const [newRelation, setNewRelation] = useState('PERE');

  if (!student) return null;
  const name = `${student.lastName ?? ''} ${student.firstName ?? ''}`.trim();
  const parents = student.studentParents || [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      headerExtra={<span className="ds-avatar" style={{ background: colorFor(student.lastName || student.id) }} aria-hidden>{initials(student.firstName, student.lastName)}</span>}
      title={
        <span className="flex flex-col">
          <span>{name}</span>
          <span className="font-mono text-[.72rem] font-normal text-ds-text-tertiary">{student.studentNumber || '—'}</span>
        </span>
      }
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        aria-label="Détail élève"
        items={[
          { key: 'profil', label: 'Profil' },
          { key: 'parents', label: `Parents${parents.length ? ` (${parents.length})` : ''}` },
          { key: 'notes', label: 'Notes' },
          { key: 'presences', label: 'Présences' },
        ]}
      />

      {tab === 'profil' && (
        <div className="ds-detail-list">
          <Row label="Matricule" value={<span className="font-mono">{student.studentNumber}</span>} />
          <Row label="Genre" value={student.gender === 'F' ? 'Féminin' : student.gender === 'M' ? 'Masculin' : student.gender} />
          <Row label="Né(e) le" value={frDate(student.dateOfBirth)} />
          <Row label="Lieu de naissance" value={student.placeOfBirth} />
          <Row label="Classe" value={student.class?.name} />
          <Row label="Statut" value={student.status} />
          <Row label="Contact" value={student.phone} />
          <Row label="Email" value={student.email} />
          <Row label="Résidence" value={student.address} />
          <Row label="Affecté de l'État" value={student.isStateAssigned ? 'Oui' : 'Non'} />
          {attachments.length > 0 && (
            <div className="ds-detail-row" style={{ alignItems: 'flex-start' }}>
              <span className="ds-detail-label">Pièces jointes</span>
              <span className="ds-detail-value flex flex-col gap-1">
                {attachments.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="truncate" style={{ color: 'var(--role-accent)' }}>{a.name}</a>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      {tab === 'parents' && (
        <div>
          {parents.length === 0 ? (
            <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucun parent rattaché.</p>
          ) : (
            <ul className="ds-detail-list mb-4">
              {parents.map((sp: any) => (
                <li key={sp.id} className="ds-parent-row">
                  <span className="min-w-0">
                    <strong className="block truncate text-[.86rem] text-ds-text">{sp.parent?.first_name} {sp.parent?.last_name}</strong>
                    <span className="text-[.74rem] text-ds-text-tertiary">{sp.parent?.phone || '—'}</span>
                  </span>
                  <span className="ds-badge ds-badge-neutral">{RELATION_LABEL[sp.relation] || sp.relation}</span>
                  <Button variant="ghost" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label="Retirer" onClick={() => onRemoveParent(sp)} />
                </li>
              ))}
            </ul>
          )}
          <div className="ds-parent-add">
            <p className="mb-2 text-[.74rem] font-bold uppercase tracking-wide text-ds-text-tertiary">Rattacher un parent</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="ds-field flex-1"><span>Parent</span>
                <select className="ds-select" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {availableParents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="ds-field w-28"><span>Relation</span>
                <select className="ds-select" value={newRelation} onChange={(e) => setNewRelation(e.target.value)}>
                  {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
                </select>
              </label>
              <Button size="sm" icon={<UserPlus aria-hidden />} loading={parentPending} disabled={!newParent}
                onClick={() => { onAddParent(newParent, newRelation); setNewParent(''); }}>Ajouter</Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        gradesLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={40} className="rounded-lg" />)}</div>
        ) : grades.length === 0 ? (
          <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucune note enregistrée.</p>
        ) : (
          <ul className="ds-detail-list">
            {grades.map((g: any) => (
              <li key={g.id} className="ds-note-row">
                <span className="min-w-0">
                  <strong className="block truncate text-[.86rem] text-ds-text">{g.subject?.name || 'Matière'}</strong>
                  <span className="text-[.74rem] text-ds-text-tertiary">{g.evaluationType?.name || ''}{g.semester?.name ? ` · ${g.semester.name}` : ''}</span>
                </span>
                <span className={`ds-activity-note ${Number(g.note) / (g.max_note || 20) >= 0.5 ? 'ds-avg-pass' : 'ds-avg-fail'}`}>
                  {num(g.note)}<span className="ds-note-max">/{g.max_note}</span>
                </span>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'presences' && (
        attendanceLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={48} className="rounded-lg" />)}</div>
        ) : attendance.length === 0 ? (
          <p className="py-4 text-center text-sm text-ds-text-tertiary">Aucun relevé de présence.</p>
        ) : (
          <ul className="ds-detail-list">
            {attendance.map((a: any) => (
              <li key={a.id} className="ds-att-row">
                <strong className="flex-1 text-[.86rem] text-ds-text">{MONTHS[a.month] || a.month} {a.year}</strong>
                <span className="ds-att-mini"><span style={{ color: 'var(--success-600)' }}>{a.present_days ?? 0}P</span> · <span style={{ color: 'var(--amber-700)' }}>{a.late_days ?? 0}R</span> · <span style={{ color: 'var(--danger-600)' }}>{a.absent_days ?? 0}A</span></span>
                <span className="ds-activity-note">{a.attendance_rate ?? 0}<span className="ds-note-max">%</span></span>
              </li>
            ))}
          </ul>
        )
      )}
    </Drawer>
  );
}
