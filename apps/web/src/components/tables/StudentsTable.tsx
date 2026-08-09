import React, { useState } from 'react';
import { Table, Button, Space, Avatar, Popconfirm, message, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, UserOutlined, LinkOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Student } from '../../lib/hooks/useStudents';
import { StudentStatusBadge } from '../ui/entity-status-badges';
import StudentForm from '../forms/StudentForm';
import ParentLinkModal from '../modals/ParentLinkModal';

interface StudentsTableProps {
  students: Student[];
  loading?: boolean;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
}

const StudentsTable: React.FC<StudentsTableProps> = ({
  students,
  loading,
  onEdit,
  onDelete,
}) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isParentLinkModalVisible, setIsParentLinkModalVisible] = useState(false);

  const getGenderText = (gender: string) => {
    switch (gender) {
      case 'MALE':
        return 'Masculin';
      case 'FEMALE':
        return 'Féminin';
      default:
        return gender;
    }
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsFormModalVisible(true);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    // You can implement a detailed view modal here
    message.info('Affichage des détails de l\'élève');
  };

  const handleLinkParent = (student: Student) => {
    setSelectedStudent(student);
    setIsParentLinkModalVisible(true);
  };

  const handleFormCancel = () => {
    setSelectedStudent(null);
    setIsFormModalVisible(false);
  };

  const handleParentLinkCancel = () => {
    setSelectedStudent(null);
    setIsParentLinkModalVisible(false);
  };

  const columns: ColumnsType<Student> = [
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
      title: 'Numéro',
      dataIndex: 'studentNumber',
      key: 'studentNumber',
      width: 120,
      sorter: (a, b) => a.studentNumber.localeCompare(b.studentNumber),
    },
    {
      title: 'Nom complet',
      key: 'fullName',
      width: 200,
      render: (_, record) => `${record.firstName} ${record.lastName}`,
      sorter: (a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    },
    {
      title: 'Sexe',
      dataIndex: 'gender',
      key: 'gender',
      width: 100,
      render: (gender: string) => getGenderText(gender),
      filters: [
        { text: 'Masculin', value: 'MALE' },
        { text: 'Féminin', value: 'FEMALE' },
      ],
      onFilter: (value, record) => record.gender === value,
    },
    {
      title: 'Classe',
      dataIndex: 'class',
      key: 'class',
      width: 120,
      render: (classInfo: any) => classInfo?.name || 'Non assigné',
    },
    {
      title: 'Statut',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <StudentStatusBadge status={status} />,
      filters: [
        { text: 'Actif', value: 'ACTIVE' },
        { text: 'Inactif', value: 'INACTIVE' },
        { text: 'Diplômé', value: 'GRADUATED' },
        { text: 'Transféré', value: 'TRANSFERRED' },
        { text: 'Expulsé', value: 'EXPELLED' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Téléphone',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (phone: string) => phone || '-',
    },
    {
      title: 'Parents',
      dataIndex: 'studentParents',
      key: 'parents',
      width: 100,
      render: (parents: any[]) => (
        <div className="flex items-center space-x-1">
          <span className="text-sm">{parents?.length || 0}</span>
          {parents && parents.length > 0 && (
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => handleLinkParent(selectedStudent!)}
            />
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
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
          <Button
            type="link"
            icon={<LinkOutlined />}
            onClick={() => handleLinkParent(record)}
            title="Lier un parent"
          />
          <Popconfirm
            title="Êtes-vous sûr de vouloir supprimer cet élève ?"
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
        dataSource={students}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1200 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} sur ${total} élèves`,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
        }}
      />

      {/* Edit Form Modal */}
      <Modal
        title={selectedStudent ? 'Modifier l\'élève' : 'Nouvel élève'}
        open={isFormModalVisible}
        onCancel={handleFormCancel}
        footer={null}
        width={800}
        destroyOnClose
      >
        <StudentForm
          student={selectedStudent || undefined}
          onSubmit={(data) => {
            if (selectedStudent) {
              onEdit({ ...selectedStudent, ...data });
            }
            handleFormCancel();
          }}
          onCancel={handleFormCancel}
        />
      </Modal>

      {/* Parent Link Modal */}
      <ParentLinkModal
        visible={isParentLinkModalVisible}
        student={selectedStudent}
        onCancel={handleParentLinkCancel}
        onSuccess={() => {
          handleParentLinkCancel();
          message.success('Parent lié avec succès');
        }}
      />
    </>
  );
};

export default StudentsTable;
