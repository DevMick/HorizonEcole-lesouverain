import { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  Form,
  Select,
  Space,
  Input,
  Row,
  Col,
  DatePicker,
  App,
  Spin,
} from 'antd';
import { Calendar, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import dayjs from 'dayjs';
import { PageHeader } from '../components/ui/page-header';
import { GlassCard } from '../components/ui/glass-card';
import { EmptyState } from '../components/ui/empty-state';
import { SemesterCard } from '../components/academic/SemesterCard';

export default function SemestersPage() {
  const { message: messageApi } = App.useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<any>(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch semesters
  const { data: semestersData, isLoading } = useQuery({
    queryKey: ['semesters'],
    queryFn: async () => {
      const response = await api.get('/semesters');
      return response.data.data || [];
    },
  });

  // Fetch academic years
  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => {
      const response = await api.get('/academic-years');
      return response.data.data || [];
    },
  });

  // Définir l'année en cours par défaut dans le filtre
  useEffect(() => {
    if (academicYearsData && academicYearsData.length > 0 && !selectedAcademicYear) {
      const currentYear = academicYearsData.find((year: any) => year.isCurrent);
      if (currentYear) {
        setSelectedAcademicYear(currentYear.id);
      }
    }
  }, [academicYearsData, selectedAcademicYear]);

  // Filtrer les trimestres selon l'année académique sélectionnée
  const filteredSemesters = semestersData?.filter((semester: any) => {
    if (!selectedAcademicYear) return true;
    return semester.academic_year_id === selectedAcademicYear;
  }) || [];

  // Définir l'année en cours par défaut quand les données sont chargées et le modal est ouvert
  useEffect(() => {
    if (isModalOpen && !editingSemester && academicYearsData && academicYearsData.length > 0) {
      const currentYear = academicYearsData.find((year: any) => year.isCurrent);
      if (currentYear) {
        const currentValue = form.getFieldValue('academicYearId');
        if (!currentValue) {
          form.setFieldsValue({
            academicYearId: currentYear.id,
          });
        }
      }
    }
  }, [isModalOpen, editingSemester, academicYearsData, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/semesters', {
        name: data.name,
        startDate: data.startDate.format('YYYY-MM-DD'),
        endDate: data.endDate.format('YYYY-MM-DD'),
        academicYearId: data.academicYearId,
      });
      return response.data;
    },
    onSuccess: () => {
      messageApi.success('Trimestre créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
      handleCloseModal();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la création du trimestre';
      messageApi.error(errorMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.patch(`/semesters/${id}`, {
        name: data.name,
        startDate: data.startDate.format('YYYY-MM-DD'),
        endDate: data.endDate.format('YYYY-MM-DD'),
        academicYearId: data.academicYearId,
      });
      return response.data;
    },
    onSuccess: () => {
      messageApi.success('Trimestre modifié avec succès');
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
      handleCloseModal();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la modification du trimestre';
      messageApi.error(errorMessage);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/semesters/${id}`);
      return response.data;
    },
    onSuccess: () => {
      messageApi.success('Trimestre supprimé avec succès');
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression du trimestre';
      messageApi.error(errorMessage);
    },
  });

  const handleOpenModal = (semester?: any) => {
    if (semester) {
      setEditingSemester(semester);
      form.setFieldsValue({
        name: semester.name,
        startDate: dayjs(semester.start_date),
        endDate: dayjs(semester.end_date),
        academicYearId: semester.academic_year_id,
      });
    } else {
      setEditingSemester(null);
      form.resetFields();
      // Définir l'année en cours par défaut
      const currentYear = academicYearsData?.find((year: any) => year.isCurrent);
      if (currentYear) {
        form.setFieldsValue({
          academicYearId: currentYear.id,
        });
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSemester(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingSemester) {
        updateMutation.mutate({ id: editingSemester.id, data: values });
      } else {
        createMutation.mutate(values);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <div className="animate-fade-in mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Gestion des Trimestres"
        description="Gérez les trimestres de l'année académique"
        action={
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => handleOpenModal()}
            size="large"
          >
            Créer un Trimestre
          </Button>
        }
      />

      <GlassCard variant="glass" styles={{ body: { padding: '24px' } }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Année Scolaire" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Sélectionnez une année scolaire"
                value={selectedAcademicYear}
                onChange={(value) => setSelectedAcademicYear(value)}
                showSearch
                optionFilterProp="children"
                allowClear
                style={{ width: '100%' }}
              >
                {academicYearsData?.map((year: any) => (
                  <Select.Option key={year.id} value={year.id}>
                    {year.name} {year.isCurrent && '(En cours)'}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </GlassCard>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : filteredSemesters.length > 0 ? (
        <Row gutter={[24, 24]}>
          {filteredSemesters.map((semester: any) => {
            const startDate = dayjs(semester.start_date);
            const endDate = dayjs(semester.end_date);
            const academicYear =
              semester.academicYear ||
              academicYearsData?.find((ay: any) => ay.id === semester.academic_year_id);

            return (
              <SemesterCard
                key={semester.id}
                name={semester.name}
                academicYearName={academicYear?.name}
                startDate={startDate.format('DD/MM/YYYY')}
                endDate={endDate.format('DD/MM/YYYY')}
                durationDays={endDate.diff(startDate, 'day') + 1}
                onEdit={() => handleOpenModal(semester)}
                onDelete={() => deleteMutation.mutate(semester.id)}
              />
            );
          })}
        </Row>
      ) : (
        <EmptyState
          icon={Calendar}
          title={
            selectedAcademicYear
              ? 'Aucun trimestre pour cette année'
              : 'Aucun trimestre trouvé'
          }
          description="Créez un trimestre pour structurer l'année scolaire."
          actionLabel="Créer un Trimestre"
          onAction={() => handleOpenModal()}
        />
      )}

      <Modal
        title={
          <Space>
            <Calendar className="h-5 w-5 text-role-primary" aria-hidden="true" />
            <span>{editingSemester ? 'Modifier le Trimestre' : 'Créer un Trimestre'}</span>
          </Space>
        }
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingSemester ? 'Modifier' : 'Créer'}
        cancelText="Annuler"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: '24px' }}
        >
          <Form.Item
            name="academicYearId"
            label="Année Académique"
            rules={[
              { required: true, message: 'L\'année académique est obligatoire' },
            ]}
          >
            <Select
              placeholder="Sélectionnez une année académique"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              loading={!academicYearsData}
            >
              {academicYearsData?.map((year: any) => (
                <Select.Option key={year.id} value={year.id} label={year.name}>
                  {year.name} {year.isCurrent && '(En cours)'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Nom du Trimestre"
            rules={[
              { required: true, message: 'Le nom est obligatoire' },
              { max: 100, message: 'Le nom ne peut pas dépasser 100 caractères' },
            ]}
          >
            <Input placeholder="Ex: Premier Trimestre" />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="Date de Début"
            rules={[
              { required: true, message: 'La date de début est obligatoire' },
            ]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder="Sélectionnez la date de début"
            />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="Date de Fin"
            rules={[
              { required: true, message: 'La date de fin est obligatoire' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const startDate = getFieldValue('startDate');
                  if (!value || !startDate) {
                    return Promise.resolve();
                  }
                  if (value.isBefore(startDate) || value.isSame(startDate)) {
                    return Promise.reject(new Error('La date de fin doit être postérieure à la date de début'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder="Sélectionnez la date de fin"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

