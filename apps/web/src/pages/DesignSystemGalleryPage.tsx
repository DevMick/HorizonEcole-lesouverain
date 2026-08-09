import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { withTransitionsSuppressed } from '../lib/utils';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  StatusBadge,
  Input,
  Field,
  SearchInput,
  Skeleton,
  Tabs,
  Drawer,
  Modal,
  toast,
} from '../components/ds';

type Role = 'admin' | 'teacher';
type Theme = 'light' | 'dark';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-[1.1rem] font-bold text-ds-text">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Galerie de vérification des composants de base (§5) — hors production.
 * Bascule rôle/thème locale pour inspecter les 4 combinaisons.
 */
export default function DesignSystemGalleryPage() {
  const [role, setRole] = useState<Role>('admin');
  const [theme, setTheme] = useState<Theme>('light');
  const [tab, setTab] = useState('profil');
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Applique rôle/thème sur <html> pour la prévisualisation (dev only).
  useEffect(() => {
    const html = document.documentElement;
    const prevRole = html.getAttribute('data-role');
    const prevTheme = html.getAttribute('data-theme');
    withTransitionsSuppressed(() => {
      html.setAttribute('data-role', role);
      html.setAttribute('data-theme', theme);
      html.classList.toggle('dark', theme === 'dark');
    });
    return () => {
      if (prevRole) html.setAttribute('data-role', prevRole);
      else html.removeAttribute('data-role');
      if (prevTheme) html.setAttribute('data-theme', prevTheme);
      html.classList.toggle('dark', prevTheme === 'dark');
    };
  }, [role, theme]);

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text" style={{ transition: 'background .2s' }}>
      <div className="mx-auto max-w-5xl space-y-10">
        {/* En-tête + bascules de démo */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[1.5rem] font-bold tracking-tight">Composants « Encre &amp; Craie »</h1>
            <p className="mt-1 text-sm text-ds-text-secondary">Catalogue §5 — vérification des états, rôles et thèmes.</p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
              <Button size="sm" variant={role === 'admin' ? 'primary' : 'ghost'} onClick={() => setRole('admin')}>Admin</Button>
              <Button size="sm" variant={role === 'teacher' ? 'primary' : 'ghost'} onClick={() => setRole('teacher')}>Enseignant</Button>
            </div>
            <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
              <Button size="sm" variant={theme === 'light' ? 'primary' : 'ghost'} onClick={() => setTheme('light')}>Clair</Button>
              <Button size="sm" variant={theme === 'dark' ? 'primary' : 'ghost'} onClick={() => setTheme('dark')}>Sombre</Button>
            </div>
          </div>
        </header>

        {/* Boutons */}
        <Section title="Boutons (§5.1)">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Plus aria-hidden />}>Primaire</Button>
              <Button variant="secondary">Secondaire</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger" icon={<Trash2 aria-hidden />}>Danger</Button>
              <Button variant="primary" disabled>Désactivé</Button>
              <Button variant="primary" loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>
                {loading ? 'Envoi…' : 'Avec loading'}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="lg" variant="primary" block className="mt-1">Pleine largeur (mobile)</Button>
            </div>
          </Card>
        </Section>

        {/* Cartes */}
        <Section title="Cartes (§5.4)">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Standard</CardTitle></CardHeader>
              <p className="text-sm text-ds-text-secondary">Carte de base : fond surélevé, bordure, ombre douce.</p>
            </Card>
            <Card accent hover>
              <CardHeader><CardTitle>Languette + survol</CardTitle></CardHeader>
              <p className="text-sm text-ds-text-secondary">Languette d'accent de rôle ; s'élève au survol.</p>
            </Card>
            <Card accent="warning">
              <CardHeader><CardTitle>Action requise</CardTitle></CardHeader>
              <p className="text-sm text-ds-text-secondary">Languette ambre = état à traiter (§5.4).</p>
            </Card>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges de statut (§5.3)">
          <Card>
            <div className="flex flex-wrap gap-3">
              <StatusBadge status="success">Présent</StatusBadge>
              <StatusBadge status="warning">En attente</StatusBadge>
              <StatusBadge status="danger">Absent</StatusBadge>
              <StatusBadge status="info">Nouveau</StatusBadge>
              <StatusBadge status="neutral">Archivé</StatusBadge>
              <StatusBadge status="role" icon={false}>Rôle</StatusBadge>
            </div>
          </Card>
        </Section>

        {/* Champs */}
        <Section title="Champs de formulaire (§5.2)">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom de l'élève"><Input placeholder="Ex. Awa Ndiaye" /></Field>
              <Field label="Matricule" error="Ce matricule existe déjà.">
                <Input defaultValue="STU-0421" error />
              </Field>
              <Field label="Recherche"><SearchInput placeholder="Rechercher un élève…" /></Field>
              <Field label="Désactivé"><Input placeholder="Non modifiable" disabled /></Field>
            </div>
          </Card>
        </Section>

        {/* Skeletons */}
        <Section title="Squelettes de chargement (§5.6)">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Skeleton variant="line" width="60%" />
                <Skeleton variant="line" width="90%" />
                <Skeleton variant="line" width="75%" />
              </div>
              <Skeleton variant="card" />
            </div>
          </Card>
        </Section>

        {/* Onglets */}
        <Section title="Onglets (§5.7)">
          <Card>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: 'profil', label: 'Profil' },
                { key: 'parents', label: 'Parents' },
                { key: 'notes', label: 'Notes' },
                { key: 'presences', label: 'Présences' },
              ]}
            />
            <p className="mt-4 text-sm text-ds-text-secondary">Onglet actif : <strong className="text-ds-text">{tab}</strong></p>
          </Card>
        </Section>

        {/* Overlays */}
        <Section title="Tiroir / Modale / Toasts (§5.8–5.9)">
          <Card>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setDrawer(true)}>Ouvrir le tiroir</Button>
              <Button variant="secondary" onClick={() => setModal(true)}>Ouvrir la modale</Button>
              <Button variant="outline" onClick={() => toast.success('Appel enregistré.')}>Toast succès</Button>
              <Button variant="outline" onClick={() => toast.info('Synchronisation…')}>Toast info</Button>
              <Button variant="outline" onClick={() => toast.warning('3 notes manquantes.')}>Toast alerte</Button>
              <Button variant="outline" onClick={() => toast.error('Échec de l\'enregistrement.', { action: { label: 'Réessayer', onClick: () => toast.info('Nouvelle tentative…') } })}>Toast erreur</Button>
            </div>
          </Card>
        </Section>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Fiche élève"
        headerExtra={<span className="grid h-10 w-10 flex-none place-items-center rounded-full font-display text-sm font-bold text-white" style={{ background: 'var(--role-accent)' }}>AN</span>}>
        <Tabs value={tab} onChange={setTab} items={[
          { key: 'profil', label: 'Profil' },
          { key: 'parents', label: 'Parents' },
          { key: 'notes', label: 'Notes' },
        ]} />
        <p className="mt-4 text-sm text-ds-text-secondary">Contenu de l'onglet « {tab}». Fermez par la croix, le scrim ou Échap.</p>
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} title="Confirmer la suppression"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Annuler</Button>
          <Button variant="danger" icon={<Trash2 aria-hidden />} onClick={() => { setModal(false); toast.success('Élément supprimé.'); }}>Supprimer</Button>
        </>}>
        <p className="text-sm text-ds-text-secondary">Cette action est irréversible. Confirmez-vous la suppression de cet enregistrement&nbsp;?</p>
      </Modal>
    </div>
  );
}
