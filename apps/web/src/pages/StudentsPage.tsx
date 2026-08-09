import React, { useState } from 'react';
import { Row, Col, Button, Input, Select, message, Modal } from 'antd';
import { Plus, Search as SearchIcon, Filter, Users, UserCheck, User } from 'lucide-react';
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, Student } from '../lib/hooks/useStudents';
import StudentsTable from '../components/tables/StudentsTable';
import StudentForm from '../components/forms/StudentForm';
import StudentDetailDrawer from '../components/drawers/StudentDetailDrawer';
import { PageHeader } from '../components/ui/page-header';
import { StatCard } from '../components/ui/stat-card';
import { GlassCard } from '../components/ui/glass-card';

const { Search } = Input;
const { Option } = Select;

const StudentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: undefined as 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'EXPELLED' | undefined,
    classId: undefined as string | undefined,
    gender: undefined as string | undefined,
  });

  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // API hooks
  const { data: studentsData, isLoading, refetch } = useStudents(searchParams);
  const createStudentMutation = useCreateStudent();
  const updateStudentMutation = useUpdateStudent();
  const deleteStudentMutation = useDeleteStudent();

  const handleSearch = (value: string) => {
    setSearchParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleFilterChange = (key: string, value: any) => {
    setSearchParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleCreateStudent = () => {
    setSelectedStudent(null);
    setIsFormModalVisible(true);
  };

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setIsFormModalVisible(true);
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteStudentMutation.mutateAsync(id);
      message.success('Élève supprimé avec succès');
      refetch();
    } catch (error) {
      message.error('Erreur lors de la suppression de l\'élève');
    }
  };

  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailDrawerVisible(true);
  };

  const handleLinkParent = (student: Student) => {
    setSelectedStudent(student);
    // This will be handled by the table component
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (selectedStudent) {
        await updateStudentMutation.mutateAsync({
          id: selectedStudent.id,
          data,
        });
        message.success('Élève mis à jour avec succès');
      } else {
        await createStudentMutation.mutateAsync(data);
        message.success('Élève créé avec succès');
      }
      setIsFormModalVisible(false);
      refetch();
    } catch (error) {
      message.error('Erreur lors de la sauvegarde de l\'élève');
    }
  };

  const handleFormCancel = () => {
    setSelectedStudent(null);
    setIsFormModalVisible(false);
  };

  const handleDetailClose = () => {
    setSelectedStudent(null);
    setIsDetailDrawerVisible(false);
  };

  return (
    <div className="animate-fade-in mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Élèves"
        description="Gestion des élèves de l'école"
        action={
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={handleCreateStudent}
            size="large"
          >
            Nouvel élève
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Élèves" value={studentsData?.pagination?.total || 0} icon={Users} />
        <StatCard
          label="Élèves Actifs"
          value={studentsData?.data?.filter((s: Student) => s.status === 'ACTIVE').length || 0}
          icon={UserCheck}
        />
        <StatCard
          label="Filles"
          value={studentsData?.data?.filter((s: Student) => s.gender === 'FEMALE').length || 0}
          icon={User}
        />
        <StatCard
          label="Garçons"
          value={studentsData?.data?.filter((s: Student) => s.gender === 'MALE').length || 0}
          icon={User}
        />
      </div>

      <GlassCard variant="glass" styles={{ body: { padding: '24px' } }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <Search
              placeholder="Rechercher par nom, numéro, téléphone..."
              allowClear
              enterButton={<SearchIcon className="h-4 w-4" aria-hidden="true" />}
              size="large"
              onSearch={handleSearch}
              onChange={(e) => !e.target.value && handleSearch('')}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Select
              placeholder="Statut"
              allowClear
              size="large"
              className="w-full"
              value={searchParams.status}
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="ACTIVE">Actif</Option>
              <Option value="INACTIVE">Inactif</Option>
              <Option value="GRADUATED">Diplômé</Option>
              <Option value="TRANSFERRED">Transféré</Option>
              <Option value="EXPELLED">Expulsé</Option>
            </Select>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Select
              placeholder="Sexe"
              allowClear
              size="large"
              className="w-full"
              value={searchParams.gender}
              onChange={(value) => handleFilterChange('gender', value)}
            >
              <Option value="MALE">Masculin</Option>
              <Option value="FEMALE">Féminin</Option>
            </Select>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Select
              placeholder="Classe"
              allowClear
              size="large"
              className="w-full"
              value={searchParams.classId}
              onChange={(value) => handleFilterChange('classId', value)}
            >
              <Option value="class1">6ème A</Option>
              <Option value="class2">6ème B</Option>
              <Option value="class3">5ème A</Option>
            </Select>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Button
              icon={<Filter className="h-4 w-4" aria-hidden="true" />}
              onClick={() => {
                setSearchParams({
                  page: 1,
                  limit: 20,
                  search: '',
                  status: undefined,
                  classId: undefined,
                  gender: undefined,
                });
              }}
              block
            >
              Réinitialiser
            </Button>
          </Col>
        </Row>
      </GlassCard>

      <GlassCard variant="glass" className="modern-table">
        <StudentsTable
          students={studentsData?.data || []}
          loading={isLoading}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
        />
      </GlassCard>

      {/* Create/Edit Form Modal */}
      <Modal
        className="modern-modal"
        title={selectedStudent ? 'Modifier l\'élève' : 'Nouvel élève'}
        open={isFormModalVisible}
        onCancel={handleFormCancel}
        footer={null}
        width={800}
        destroyOnClose
      >
        <StudentForm
          student={selectedStudent || undefined}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          loading={createStudentMutation.isPending || updateStudentMutation.isPending}
        />
      </Modal>

      {/* Student Detail Drawer */}
      <StudentDetailDrawer
        visible={isDetailDrawerVisible}
        student={selectedStudent}
        onClose={handleDetailClose}
      />
    </div>
  );
};

export default StudentsPage;