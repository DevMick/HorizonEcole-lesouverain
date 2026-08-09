import { StatusBadge, type Status } from './status-badge';

const STUDENT_STATUS_MAP: Record<string, { status: Status; label: string }> = {
  ACTIVE: { status: 'success', label: 'Actif' },
  INACTIVE: { status: 'neutral', label: 'Inactif' },
  GRADUATED: { status: 'info', label: 'Diplômé' },
  TRANSFERRED: { status: 'warning', label: 'Transféré' },
  EXPELLED: { status: 'error', label: 'Expulsé' },
};

const CONTRACT_STATUS_MAP: Record<string, { status: Status; label: string }> = {
  CDI: { status: 'success', label: 'CDI' },
  CDD: { status: 'warning', label: 'CDD' },
  VACATAIRE: { status: 'info', label: 'Vacataire' },
};

export function StudentStatusBadge({ status }: { status: string }) {
  const mapped = STUDENT_STATUS_MAP[status] ?? { status: 'neutral' as Status, label: status };
  return <StatusBadge status={mapped.status} label={mapped.label} />;
}

export function ContractStatusBadge({ contractType }: { contractType: string }) {
  const mapped = CONTRACT_STATUS_MAP[contractType] ?? {
    status: 'neutral' as Status,
    label: contractType,
  };
  return <StatusBadge status={mapped.status} label={mapped.label} />;
}
