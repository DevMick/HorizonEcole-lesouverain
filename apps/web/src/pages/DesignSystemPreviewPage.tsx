import { Button, message } from 'antd';
import { BookOpen, DollarSign, Plus, Users } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { GlassCard } from '../components/ui/glass-card';
import { StatCard } from '../components/ui/stat-card';
import { StatusBadge } from '../components/ui/status-badge';
import { EmptyState } from '../components/ui/empty-state';

export default function DesignSystemPreviewPage() {
  return (
    <div className="animate-fade-in mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Design System Preview"
        description="Composants transverses HorizonEcole — validez en mode clair et sombre via le bouton dans le header."
        action={
          <Button type="primary" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            Action principale
          </Button>
        }
      />

      {/* StatCards */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">StatCard</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Élèves actifs" value="1 234" icon={Users} />
          <StatCard label="Enseignants" value="48" icon={BookOpen} />
          <StatCard label="Revenus du mois" value="12,5 M FCFA" icon={DollarSign} />
          <StatCard label="Paiements en attente" value="23" icon={Users} />
        </div>
      </section>

      {/* StatusBadges */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">StatusBadge</h2>
        <GlassCard variant="glass">
          <p className="mb-4 text-sm text-muted-foreground">
            Chaque statut combine icône + libellé + couleur (jamais la couleur seule).
          </p>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="success" label="Payé" />
            <StatusBadge status="warning" label="En attente" />
            <StatusBadge status="error" label="En retard" />
            <StatusBadge status="info" label="En cours" />
            <StatusBadge status="neutral" label="Inactif" />
          </div>
        </GlassCard>
      </section>

      {/* GlassCard variants */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">GlassCard — variantes</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <GlassCard variant="default" title="Default" hover>
            <p className="text-sm text-muted-foreground">
              Carte standard avec bordure et fond `bg-card`.
            </p>
          </GlassCard>

          <GlassCard variant="glass" title="Glass" hover>
            <p className="text-sm text-muted-foreground">
              Effet verre dépoli — pattern principal des dashboards.
            </p>
          </GlassCard>

          <GlassCard variant="gradient" title="Gradient" hover>
            <p className="text-sm text-white/80">
              Dégradé lié au rôle utilisateur (`data-role`).
            </p>
          </GlassCard>
        </div>
      </section>

      {/* EmptyState */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">EmptyState</h2>
        <GlassCard variant="glass">
          <EmptyState
            title="Aucun élève trouvé"
            description="Commencez par ajouter un élève à votre établissement."
            actionLabel="Ajouter un élève"
            onAction={() => message.info('Action démo — phase 2')}
          />
        </GlassCard>
      </section>

      {/* Hero banner example */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Bannière hero</h2>
        <div className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-8 text-white shadow-xl">
          <h3 className="mb-3 text-2xl font-bold">HorizonEcole</h3>
          <p className="mb-6 text-lg text-blue-100">
            Interface glass Discord-like — dégradés réservés aux fonds pleins avec texte blanc.
          </p>
          <Button className="border-white/30 bg-white/20 text-white hover:bg-white/30">
            Explorer
          </Button>
        </div>
      </section>
    </div>
  );
}
