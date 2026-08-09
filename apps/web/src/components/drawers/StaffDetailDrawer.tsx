import React from 'react';
import { Drawer, Descriptions, Tag, Avatar, Button, Space, Divider, Table, Typography } from 'antd';
import { UserOutlined, EditOutlined, DollarOutlined, FileTextOutlined } from '@ant-design/icons';
import { Staff, StaffSalary } from '../../lib/hooks/useStaff';

const { Title, Text } = Typography;

interface StaffDetailDrawerProps {
  staff: Staff | null;
  visible: boolean;
  onClose: () => void;
  onEdit?: (staff: Staff) => void;
  onGenerateSalary?: (staff: Staff) => void;
}

const StaffDetailDrawer: React.FC<StaffDetailDrawerProps> = ({
  staff,
  visible,
  onClose,
  onEdit,
  onGenerateSalary,
}) => {
  if (!staff) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getFunctionColor = (func: string) => {
    const colors: Record<string, string> = {
      'ENSEIGNANT': 'blue',
      'DIRECTEUR': 'red',
      'SURVEILLANT': 'orange',
      'SECRETAIRE': 'green',
      'COMPTABLE': 'purple',
      'MAINTENANCE': 'gray',
    };
    return colors[func] || 'default';
  };

  const getContractTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'CDI': 'green',
      'CDD': 'orange',
      'VACATAIRE': 'blue',
      'BENEVOLAT': 'purple',
    };
    return colors[type] || 'default';
  };

  const getSalaryStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'DRAFT': 'orange',
      'APPROVED': 'blue',
      'PAID': 'green',
    };
    return colors[status] || 'default';
  };

  const salaryColumns = [
    {
      title: 'Période',
      key: 'period',
      render: (_: any, record: StaffSalary) => {
        const monthNames = [
          'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
          'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
        ];
        return `${monthNames[record.month - 1]} ${record.year}`;
      },
    },
    {
      title: 'Salaire Brut',
      dataIndex: 'grossSalary',
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: 'Salaire Net',
      dataIndex: 'netSalary',
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: 'Statut',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={getSalaryStatusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'PDF',
      key: 'pdf',
      render: (_: any, record: StaffSalary) => (
        record.pdfUrl ? (
          <Button
            type="link"
            icon={<FileTextOutlined />}
            onClick={() => window.open(record.pdfUrl, '_blank')}
          >
            Voir PDF
          </Button>
        ) : (
          <Text type="secondary">Non généré</Text>
        )
      ),
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size="large" icon={<UserOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {staff.firstName} {staff.lastName}
            </Title>
            <Text type="secondary">{staff.function}</Text>
          </div>
        </div>
      }
      placement="right"
      onClose={onClose}
      open={visible}
      width={600}
      extra={
        <Space>
          {onGenerateSalary && (
            <Button
              type="primary"
              icon={<DollarOutlined />}
              onClick={() => onGenerateSalary(staff)}
            >
              Générer Salaire
            </Button>
          )}
          {onEdit && (
            <Button
              icon={<EditOutlined />}
              onClick={() => onEdit(staff)}
            >
              Modifier
            </Button>
          )}
        </Space>
      }
    >
      <Descriptions
        title="Informations Personnelles"
        bordered
        column={1}
        size="small"
      >
        <Descriptions.Item label="Nom complet">
          {staff.firstName} {staff.lastName}
        </Descriptions.Item>
        <Descriptions.Item label="Email">
          {staff.email || 'Non renseigné'}
        </Descriptions.Item>
        <Descriptions.Item label="Téléphone">
          {staff.phone || 'Non renseigné'}
        </Descriptions.Item>
        <Descriptions.Item label="Adresse">
          {staff.address || 'Non renseignée'}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Descriptions
        title="Informations Professionnelles"
        bordered
        column={1}
        size="small"
      >
        <Descriptions.Item label="Fonction">
          <Tag color={getFunctionColor(staff.function)}>
            {staff.function}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Spécialisation">
          {staff.specialization || 'Non renseignée'}
        </Descriptions.Item>
        <Descriptions.Item label="Type de contrat">
          <Tag color={getContractTypeColor(staff.contractType)}>
            {staff.contractType}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Date d'embauche">
          {formatDate(staff.hireDate)}
        </Descriptions.Item>
        {staff.endDate && (
          <Descriptions.Item label="Date de fin">
            {formatDate(staff.endDate)}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Salaire de base">
          {formatCurrency(staff.baseSalary)}
        </Descriptions.Item>
        <Descriptions.Item label="Statut">
          <Tag color={staff.isActive ? 'green' : 'red'}>
            {staff.isActive ? 'Actif' : 'Inactif'}
          </Tag>
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Descriptions
        title="Informations Système"
        bordered
        column={1}
        size="small"
      >
        <Descriptions.Item label="Utilisateur associé">
          {staff.user ? (
            <div>
              <div>{staff.user.username}</div>
              <Text type="secondary">{staff.user.email}</Text>
            </div>
          ) : (
            'Aucun utilisateur associé'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Créé le">
          {formatDate(staff.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Modifié le">
          {formatDate(staff.updatedAt)}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <div>
        <Title level={5}>Documents</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          {staff.cvUrl && (
            <Button
              type="link"
              icon={<FileTextOutlined />}
              onClick={() => window.open(staff.cvUrl, '_blank')}
            >
              CV
            </Button>
          )}
          {staff.diplomaUrl && (
            <Button
              type="link"
              icon={<FileTextOutlined />}
              onClick={() => window.open(staff.diplomaUrl, '_blank')}
            >
              Diplôme
            </Button>
          )}
          {staff.contractUrl && (
            <Button
              type="link"
              icon={<FileTextOutlined />}
              onClick={() => window.open(staff.contractUrl, '_blank')}
            >
              Contrat
            </Button>
          )}
          {staff.idCardUrl && (
            <Button
              type="link"
              icon={<FileTextOutlined />}
              onClick={() => window.open(staff.idCardUrl, '_blank')}
            >
              Pièce d'identité
            </Button>
          )}
          {!staff.cvUrl && !staff.diplomaUrl && !staff.contractUrl && !staff.idCardUrl && (
            <Text type="secondary">Aucun document téléchargé</Text>
          )}
        </Space>
      </div>

      {staff.salaries && staff.salaries.length > 0 && (
        <>
          <Divider />
          <div>
            <Title level={5}>Historique des Salaires</Title>
            <Table
              columns={salaryColumns}
              dataSource={staff.salaries}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        </>
      )}
    </Drawer>
  );
};

export default StaffDetailDrawer;
