import { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  Space,
  Tag,
  message,
  Popconfirm,
  Card,
  Typography,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const { Title } = Typography;
const { Option } = Select;

const levelLabels = {
  SIXIEME: '6ème',
  CINQUIEME: '5ème',
  QUATRIEME: '4ème',
  TROISIEME: '3ème',
};

export default function ClassSubjectsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 15,
  });
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch assignments
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['class-subjects'],
    queryFn: async () => {
      const response = await api.get('/class-subjects');
      return response.data.data;
    },
  });

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['school-classes'],
    queryFn: async () => {
      const response = await api.get('/school-classes');
      return response.data.data;
    },
  });

  // Fetch subjects
  const { data: subjectsData } = useQuery({
    queryKey: ['school-subjects'],
    queryFn: async () => {
      const response = await api.get('/school-subjects');
      return response.data.data;
    },
  });

  // Fetch teachers
  const { data: teachersData } = useQuery({
    queryKey: ['staff-teachers'],
    queryFn: async () => {
      const response = await api.get('/staff?function=ENSEIGNANT');
      return response.data.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const response = await api.post('/class-subjects', values);
      return response.data;
    },
    onSuccess: () => {
      message.success('Affectation créée avec succès !');
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      handleCancel();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: any) => {
      const response = await api.patch(`/class-subjects/${id}`, values);
      return response.data;
    },
    onSuccess: () => {
      message.success('Affectation mise à jour !');
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      handleCancel();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Erreur');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/class-subjects/${id}`);
      return response.data;
    },
    onSuccess: () => {
      message.success('Affectation supprimée !');
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Erreur');
    },
  });

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingAssignment(null);
    form.resetFields();
  };

  const handleEdit = (assignment: any) => {
    setEditingAssignment(assignment);
    form.setFieldsValue({
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      teacherId: assignment.teacherId,
      hoursPerWeek: assignment.hoursPerWeek,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingAssignment) {
        updateMutation.mutate({ id: editingAssignment.id, ...values });
      } else {
        createMutation.mutate(values);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const columns = [
    {
      title: 'Classe',
      key: 'class',
      render: (_: any, record: any) => (
        <Space>
          <Tag color={
            record.class.level === 'SIXIEME' ? 'blue' :
            record.class.level === 'CINQUIEME' ? 'green' :
            record.class.level === 'QUATRIEME' ? 'orange' : 'red'
          }>
            {levelLabels[record.class.level as keyof typeof levelLabels]}
          </Tag>
          <strong>{record.class.name}</strong>
          {record.class.academicYear?.isCurrent && (
            <Tag color="success" style={{ fontSize: '10px' }}>Actuelle</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Matière',
      key: 'subject',
      render: (_: any, record: any) => (
        <Space>
          <BookOutlined style={{ color: 'rgb(var(--role-primary))' }} />
          <span>
            {record.subject.name}
            <Tag color="cyan" style={{ marginLeft: '8px' }}>{record.subject.code}</Tag>
          </span>
        </Space>
      ),
    },
    {
      title: 'Professeur',
      key: 'teacher',
      render: (_: any, record: any) =>
        record.teacher ? (
          <span>{record.teacher.firstName} {record.teacher.lastName}</span>
        ) : (
          <Tag color="default">Non assigné</Tag>
        ),
    },
    {
      title: 'Heures/Semaine',
      dataIndex: 'hoursPerWeek',
      key: 'hoursPerWeek',
      render: (hours: number) => <Tag color="purple">{hours}h</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Modifier
          </Button>
          <Popconfirm
            title="Supprimer cette affectation ?"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Supprimer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              Supprimer
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }} className="fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, color: 'rgb(var(--role-primary))' }}>
          <LinkOutlined style={{ marginRight: '12px' }} />
          Affectations Matières-Classes
        </Title>
        <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '16px' }}>
          Assignez les matières aux classes et désignez les professeurs responsables
        </p>
      </div>

      {/* Bouton au-dessus du tableau */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        justifyContent: 'flex-end',
        width: '100%',
      }}
      className="button-container-responsive"
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          size="large"
          style={{
            background: 'rgb(var(--role-primary))',
            borderColor: 'rgb(var(--role-primary))',
            borderRadius: '8px',
            height: '40px',
            width: 'auto',
          }}
          className="responsive-button"
        >
          Nouvelle Affectation
        </Button>
      </div>

      <Card className="modern-card">

        <Alert
          message="Affectation de matières aux classes"
          description="Assignez les matières aux classes et désignez les professeurs responsables. Une matière ne peut être affectée qu'une seule fois par classe."
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        <Table
          columns={columns}
          dataSource={assignmentsData || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              setPagination({
                current: page,
                pageSize: pageSize || pagination.pageSize,
              });
            },
            onShowSizeChange: (current, size) => {
              setPagination({
                current: 1,
                pageSize: size,
              });
            },
          }}
        />
      </Card>

      {/* Modal de création/édition */}
      <Modal
        title={editingAssignment ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText={editingAssignment ? 'Mettre à jour' : 'Créer'}
        cancelText="Annuler"
        cancelButtonProps={{
          className: 'modern-button-secondary-outline',
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: '24px' }}
        >
          <Form.Item
            name="classId"
            label="Classe"
            rules={[{ required: true, message: 'La classe est requise' }]}
          >
            <Select
              placeholder="Sélectionner une classe"
              disabled={!!editingAssignment}
            >
              {classesData?.map((classItem: any) => (
                <Option key={classItem.id} value={classItem.id}>
                  {classItem.name} - {levelLabels[classItem.level as keyof typeof levelLabels]} ({classItem.academicYear?.name})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="subjectId"
            label="Matière"
            rules={[{ required: true, message: 'La matière est requise' }]}
          >
            <Select
              placeholder="Sélectionner une matière"
              disabled={!!editingAssignment}
            >
              {subjectsData?.map((subject: any) => (
                <Option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code}) - Coef. {subject.coefficient}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="teacherId"
            label="Professeur"
          >
            <Select
              placeholder="Sélectionner un professeur (optionnel)"
              allowClear
            >
              {teachersData?.map((teacher: any) => (
                <Option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName} ({teacher.staffNumber})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="hoursPerWeek"
            label="Heures par semaine"
            initialValue={1}
            rules={[{ required: true, message: 'Le nombre d\'heures est requis' }]}
          >
            <InputNumber
              min={1}
              max={20}
              style={{ width: '100%' }}
              addonAfter="h/semaine"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

