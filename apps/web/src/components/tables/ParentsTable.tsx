import React, { useState } from 'react';
import { Table, Button, Space, Tag, Avatar, Popconfirm, message, Modal, Switch } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Parent } from '../../lib/hooks/useParents';
import ParentForm from '../forms/ParentForm';

interface ParentsTableProps {
  parents: Parent[];
  loading?: boolean;
  onEdit: (parent: Parent) => void;
  onDelete: (id: string) => void;
}

const ParentsTable: React.FC<ParentsTableProps> = ({
  parents,
  loading,
  onEdit,
  onDelete,
}) => {
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);

  const getRelationColor = (relation: string) => {
    switch (relation) {
      case 'PERE':
        return 'blue';
      case 'MERE':
        return 'pink';
      case 'TUTEUR':
        return 'purple';
      case 'AUTRE':
        return 'default';
      default:
        return 'default';
    }
  };

  const getRelationText = (relation: string) => {
    switch (relation) {
      case 'PERE':
        return 'Père';
      case 'MERE':
        return 'Mère';
      case 'TUTEUR':
        return 'Tuteur';
      case 'AUTRE':
        return 'Autre';
      default:
        return relation;
    }
  };

  const handleEdit = (parent: Parent) => {
    setSelectedParent(parent);
    setIsFormModalVisible(true);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
  };

  const handleView = (parent: Parent) => {
    setSelectedParent(parent);
    // You can implement a detailed view modal here
    message.info('Affichage des détails du parent');
  };

  const handleFormCancel = () => {
    setSelectedParent(null);
    setIsFormModalVisible(false);
  };

  const columns: ColumnsType<Parent> = [
    {
      title: 'Photo',
      dataIndex: 'avatarUrl',
      key: 'avatar',
      width: 80,
      render: (avatarUrl: string) => (
        <Avatar
          size={40}
          src={avatarUrl}
          icon={<UserOutlined />}
          className="border border-gray-200"
        />
      ),
    },
    {
      title: 'Nom complet',
      key: 'fullName',
      width: 200,
      render: (_, record) => `${record.firstName} ${record.lastName}`,
      sorter: (a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    },
    {
      title: 'Relation',
      dataIndex: 'relation',
      key: 'relation',
      width: 100,
      render: (relation: string) => (
        <Tag color={getRelationColor(relation)}>
          {getRelationText(relation)}
        </Tag>
      ),
      filters: [
        { text: 'Père', value: 'PERE' },
        { text: 'Mère', value: 'MERE' },
        { text: 'Tuteur', value: 'TUTEUR' },
        { text: 'Autre', value: 'AUTRE' },
      ],
      onFilter: (value, record) => record.relation === value,
    },
    {
      title: 'Téléphone',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      render: (email: string) => email || '-',
    },
    {
      title: 'Profession',
      dataIndex: 'profession',
      key: 'profession',
      width: 150,
      render: (profession: string) => profession || '-',
    },
    {
      title: 'Contact Principal',
      dataIndex: 'isPrimaryContact',
      key: 'isPrimaryContact',
      width: 130,
      render: (isPrimary: boolean) => (
        <Switch checked={isPrimary} disabled size="small" />
      ),
      filters: [
        { text: 'Oui', value: true },
        { text: 'Non', value: false },
      ],
      onFilter: (value, record) => record.isPrimaryContact === value,
    },
    {
      title: 'Responsable Financier',
      dataIndex: 'isFinancialResponsible',
      key: 'isFinancialResponsible',
      width: 150,
      render: (isFinancial: boolean) => (
        <Switch checked={isFinancial} disabled size="small" />
      ),
      filters: [
        { text: 'Oui', value: true },
        { text: 'Non', value: false },
      ],
      onFilter: (value, record) => record.isFinancialResponsible === value,
    },
    {
      title: 'Élèves',
      dataIndex: 'studentParents',
      key: 'students',
      width: 80,
      render: (students: any[]) => (
        <Tag color="blue">{students?.length || 0}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
            title="Voir les détails"
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            title="Modifier"
          />
          <Popconfirm
            title="Êtes-vous sûr de vouloir supprimer ce parent ?"
            description="Cette action est irréversible."
            onConfirm={() => handleDelete(record.id)}
            okText="Oui"
            cancelText="Non"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              title="Supprimer"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table
        columns={columns}
        dataSource={parents}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1200 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} sur ${total} parents`,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
        }}
      />

      {/* Edit Form Modal */}
      <Modal
        title={selectedParent ? 'Modifier le parent' : 'Nouveau parent'}
        open={isFormModalVisible}
        onCancel={handleFormCancel}
        footer={null}
        width={600}
        destroyOnClose
      >
        <ParentForm
          parent={selectedParent || undefined}
          onSubmit={(data) => {
            if (selectedParent) {
              onEdit({ ...selectedParent, ...data });
            }
            handleFormCancel();
          }}
          onCancel={handleFormCancel}
        />
      </Modal>
    </>
  );
};

export default ParentsTable;
