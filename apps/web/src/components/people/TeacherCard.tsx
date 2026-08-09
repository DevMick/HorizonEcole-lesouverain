import { Button, Col, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import {
  BookOpen,
  Calendar,
  Eye,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { GlassCard } from '../ui/glass-card';
import { ContractStatusBadge } from '../ui/entity-status-badges';

export interface TeacherCardProps {
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    contract_type: string;
    hire_date: string;
    specialties?: string | string[];
    user_id?: string;
  };
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateAccount: () => void;
  isCreatingAccount?: boolean;
}

function parseList(value?: string | string[]) {
  if (!value) return [];
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return value;
}


export function TeacherCard({
  teacher,
  onView,
  onEdit,
  onDelete,
  onCreateAccount,
  isCreatingAccount,
}: TeacherCardProps) {
  const specialties = parseList(teacher.specialties).slice(0, 3);
  const extraCount = Math.max(0, parseList(teacher.specialties).length - 3);

  return (
    <Col xs={24} sm={12} lg={8} xl={8}>
      <GlassCard variant="glass" hover className="h-full" styles={{ body: { padding: '20px' } }}>
        <div className="mb-4 flex items-start justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {teacher.first_name} {teacher.last_name}
            </h3>
          </div>
          <ContractStatusBadge contractType={teacher.contract_type} />
        </div>

        <div className="mb-4 space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-role-primary" aria-hidden="true" />
            <span className="break-all">{teacher.email}</span>
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-role-primary" aria-hidden="true" />
            {teacher.phone}
          </p>
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-role-primary" aria-hidden="true" />
            Embauché le {dayjs(teacher.hire_date).format('DD/MM/YYYY')}
          </p>
        </div>

        {specialties.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-1 text-sm font-medium text-foreground">
              <BookOpen className="h-4 w-4 text-role-primary" aria-hidden="true" />
              Spécialités
            </p>
            <div className="flex flex-wrap gap-1.5">
              {specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="rounded-md bg-[rgb(var(--role-primary)/0.1)] px-2 py-0.5 text-xs text-role-primary"
                >
                  {specialty}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  +{extraCount}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-1 border-t border-border pt-4">
          {!teacher.user_id && (
            <Button
              type="text"
              aria-label="Créer un compte utilisateur"
              icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
              onClick={onCreateAccount}
              loading={isCreatingAccount}
              className="flex h-10 w-10 items-center justify-center"
            />
          )}
          <Button
            type="text"
            aria-label="Voir les détails"
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            onClick={onView}
            className="flex h-10 w-10 items-center justify-center"
          />
          <Button
            type="text"
            aria-label="Modifier l'enseignant"
            icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            onClick={onEdit}
            className="flex h-10 w-10 items-center justify-center"
          />
          <Popconfirm
            title="Supprimer cet enseignant ?"
            description="Cette action est irréversible."
            onConfirm={onDelete}
            okText="Supprimer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              aria-label="Supprimer l'enseignant"
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              className="flex h-10 w-10 items-center justify-center"
            />
          </Popconfirm>
        </div>
      </GlassCard>
    </Col>
  );
}
