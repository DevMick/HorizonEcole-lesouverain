import { useEffect, useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { EntityBoard } from '../components/shared/EntityBoard';
import { EntityFormModal, type EntityField } from '../components/shared/EntityFormModal';
import { withTransitionsSuppressed } from '../lib/utils';

/** Prévisualisation du scaffold générique de l'étape 5 (dev only, données fictives). */

const FIELDS: EntityField[] = [
  { name: 'name', label: 'Nom de la classe', required: true, min: 2, placeholder: 'Ex : 6ème A…' },
  { name: 'level', label: 'Niveau', type: 'select', colSpan: 1, options: [{ value: 'college', label: 'Collège' }, { value: 'lycee', label: 'Lycée' }] },
];
const INITIAL = [
  { id: '1', name: '6ème 1', students: 32, subjects: 9 }, { id: '2', name: '6ème 2', students: 30, subjects: 9 },
  { id: '3', name: '5ème 1', students: 28, subjects: 10 }, { id: '4', name: '4ème 1', students: 26, subjects: 11 },
  { id: '5', name: '3ème 1', students: 24, subjects: 11 },
];

export default function DesignSystemEntityPreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [role, setRole] = useState<'admin' | 'teacher'>('admin');
  const [items, setItems] = useState(INITIAL);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { document.documentElement.setAttribute('data-role', role); return () => document.documentElement.removeAttribute('data-role'); }, [role]);
  useEffect(() => { withTransitionsSuppressed(() => { document.documentElement.setAttribute('data-theme', theme); document.documentElement.classList.toggle('dark', theme === 'dark'); }); }, [theme]);

  const filtered = useMemo(() => items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase())), [items, search]);

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex max-w-6xl flex-wrap justify-end gap-2">
        <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
          <button className={`ds-btn ds-btn-sm ${role === 'admin' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setRole('admin')}>Admin</button>
          <button className={`ds-btn ds-btn-sm ${role === 'teacher' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setRole('teacher')}>Enseignant</button>
        </div>
        <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
          <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
          <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
        </div>
      </div>
      <EntityBoard
        title="Classes"
        subtitle="Aperçu du scaffold générique de l'étape 5."
        icon={GraduationCap}
        primaryLabel="Nouvelle classe"
        onPrimary={() => { setEditing(null); setFormOpen(true); }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher par nom…"
        items={filtered}
        cardOf={(c) => ({ key: c.id, title: c.name, badges: [{ label: `${c.students} élèves`, kind: 'role' }, { label: `${c.subjects} matières`, kind: 'neutral' }] })}
        onEdit={(c) => { setEditing(c); setFormOpen(true); }}
        onDelete={(c) => setItems((s) => s.filter((x) => x.id !== c.id))}
      />
      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la classe' : 'Nouvelle classe'}
        fields={FIELDS}
        initial={editing}
        submitLabel={editing ? 'Modifier' : 'Créer'}
        onSubmit={(v) => {
          if (editing) setItems((s) => s.map((x) => (x.id === editing.id ? { ...x, ...v } : x)));
          else setItems((s) => [...s, { id: `n${s.length + 1}`, name: v.name, students: 0, subjects: 0 }]);
          setFormOpen(false);
        }}
      />
    </div>
  );
}
