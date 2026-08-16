import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Col, Spin, Tabs, Typography } from 'antd';
import { ArrowLeft, Calendar, Edit, ExternalLink, FileText, Mail, MapPin, Phone } from 'lucide-react';
import { studentsApi } from '../lib/api';
import { formatDate, calculateAge } from '../lib/utils';
import { PersonDetailHeader } from '../components/ui/person-detail-header';
import { GlassCard } from '../components/ui/glass-card';
import { StatCard } from '../components/ui/stat-card';
import { StudentStatusBadge } from '../components/ui/entity-status-badges';
import { BookOpen, CreditCard } from 'lucide-react';

const { Text } = Typography;

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function StudentDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const student = data?.data.data;

  if (!student) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-2xl font-bold">Élève non trouvé</h2>
        <p className="mt-2 text-muted-foreground">L'élève demandé n'existe pas.</p>
        <Link to="/people/students" className="mt-4 inline-block text-primary">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const initials = `${student.firstName?.charAt(0) ?? ''}${student.lastName?.charAt(0) ?? ''}`;

  // Mêmes documents que ceux exposés par StudentDetailDrawer : le formulaire élève
  // renseigne ces trois URLs, l'API les renvoie avec la fiche.
  const documents = [
    { label: 'Acte de naissance', url: student.birthCertificateUrl },
    { label: 'Carnet de vaccination', url: student.vaccinationCardUrl },
    { label: "Bulletin de l'école précédente", url: student.previousSchoolReportUrl },
  ].filter((doc): doc is { label: string; url: string } => Boolean(doc.url));

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <Link
        to="/people/students"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux élèves
      </Link>

      <PersonDetailHeader
        initials={initials}
        name={`${student.firstName} ${student.lastName}`}
        subtitle={student.studentNumber}
        action={
          <Button type="primary" icon={<Edit className="h-4 w-4" aria-hidden="true" />}>
            Modifier
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Notes" value={student.grades?.length ?? 0} icon={BookOpen} />
        <StatCard label="Paiements" value={student.payments?.length ?? 0} icon={CreditCard} />
        <GlassCard variant="glass" styles={{ body: { padding: '24px' } }}>
          <p className="text-sm font-medium text-muted-foreground">Statut</p>
          <div className="mt-3">
            <StudentStatusBadge status={student.status} />
          </div>
          {student.class && (
            <p className="mt-3 text-sm text-muted-foreground">
              Classe : <span className="font-medium text-foreground">{student.class.name}</span>
            </p>
          )}
        </GlassCard>
      </div>

      <Tabs
        defaultActiveKey="info"
        items={[
          {
            key: 'info',
            label: 'Informations',
            children: (
              <div className="space-y-6">
                <GlassCard variant="glass" title="Informations personnelles">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InfoField label="Numéro d'élève">{student.studentNumber}</InfoField>
                    <InfoField label="Date de naissance">{formatDate(student.dateOfBirth)}</InfoField>
                    <InfoField label="Âge">{calculateAge(student.dateOfBirth)} ans</InfoField>
                    <InfoField label="Sexe">
                      {student.gender === 'MALE' ? 'Masculin' : 'Féminin'}
                    </InfoField>
                    <div className="sm:col-span-2">
                      <InfoField label="Adresse">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {student.address}
                        </span>
                      </InfoField>
                    </div>
                    {student.phone && (
                      <InfoField label="Téléphone">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {student.phone}
                        </span>
                      </InfoField>
                    )}
                    {student.email && (
                      <InfoField label="Email">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {student.email}
                        </span>
                      </InfoField>
                    )}
                  </dl>
                </GlassCard>

                <GlassCard variant="glass" title="Informations parentales">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InfoField label="Nom du parent">{student.parentName}</InfoField>
                    <InfoField label="Téléphone parent">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {student.parentPhone}
                      </span>
                    </InfoField>
                    {student.parentEmail && (
                      <InfoField label="Email parent">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {student.parentEmail}
                        </span>
                      </InfoField>
                    )}
                  </dl>
                </GlassCard>
              </div>
            ),
          },
          {
            key: 'documents',
            label: 'Documents',
            children: (
              <GlassCard variant="glass">
                {documents.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {documents.map((doc) => (
                      <li
                        key={doc.label}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="inline-flex items-center gap-2 text-sm text-foreground">
                          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {doc.label}
                        </span>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Consulter
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text type="secondary">Aucun document associé pour le moment.</Text>
                )}
              </GlassCard>
            ),
          },
          {
            key: 'historique',
            label: 'Historique',
            children: (
              <GlassCard variant="glass">
                <InfoField label="Inscrit le">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {formatDate(student.createdAt)}
                  </span>
                </InfoField>
              </GlassCard>
            ),
          },
        ]}
      />
    </div>
  );
}
