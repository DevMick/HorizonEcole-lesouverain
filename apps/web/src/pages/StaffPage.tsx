import React, { useState } from 'react';
import { Button, Input, Select, Space, Row, Col, Card, Statistic, Modal, Drawer, message, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined, FilterOutlined, UserOutlined, DollarOutlined, FileTextOutlined } from '@ant-design/icons';
import { useStaff, useStaffStats, useBulkGenerateSalaries } from '../lib/hooks/useStaff';
import StaffTable from '../components/tables/StaffTable';
import StaffForm from '../components/forms/StaffForm';
import StaffDetailDrawer from '../components/drawers/StaffDetailDrawer';
import { Staff } from '../lib/hooks/useStaff';
import dayjs from 'dayjs';

const { Option } = Select;

const StaffPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [functionFilter, setFunctionFilter] = useState<string>('');
  const [contractFilter, setContractFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);

  // Fetch data
  const { data: staffData, isLoading: staffLoading, refetch: refetchStaff } = useStaff({
    search,
    function: functionFilter,
    contractType: contractFilter,
    isActive: statusFilter,
    page: currentPage,
    limit: pageSize,
  });

  const { data: statsData, isLoading: statsLoading } = useStaffStats();
  const bulkGenerateSalariesMutation = useBulkGenerateSalaries();

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (filterType: string, value: any) => {
    switch (filterType) {
      case 'function':
        setFunctionFilter(value);
        break;
      case 'contract':
        setContractFilter(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
    }
    setCurrentPage(1);
  };

  const handleTableChange = (pagination: any) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  const handleViewStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsDetailDrawerOpen(true);
  };

  const handleEditStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsFormModalOpen(true);
  };

  const handleGenerateSalary = (staff: Staff) => {
    setSelectedStaff(staff);
    setIsSalaryModalOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormModalOpen(false);
    setSelectedStaff(null);
    refetchStaff();
  };

  const handleFormCancel = () => {
    setIsFormModalOpen(false);
    setSelectedStaff(null);
  };

  const handleDetailClose = () => {
    setIsDetailDrawerOpen(false);
    setSelectedStaff(null);
  };

  const handleBulkGenerateSalaries = async () => {
    if (!staffData?.data || staffData.data.length === 0) {
      message.warning('No staff members found');
      return;
    }

    const currentDate = dayjs();
    const staffIds = staffData.data.map((staff: any) => staff.id);

    try {
      await bulkGenerateSalariesMutation.mutateAsync({
        staffIds,
        month: currentDate.month() + 1,
        year: currentDate.year(),
        allowances: [
          { label: 'Indemnité de transport', amount: 15000 },
          { label: 'Indemnité de logement', amount: 25000 },
        ],
        deductions: [],
        notes: 'Génération automatique des salaires',
      });

      message.success('Salaries generated successfully for all staff members');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to generate salaries');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined />
          Gestion du Personnel
        </h1>
        <p style={{ margin: 0, color: '#666' }}>
          Gérez les informations du personnel et générez les bulletins de paie
        </p>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Personnel"
              value={statsData?.totalStaff || 0}
              loading={statsLoading}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Personnel Actif"
              value={statsData?.activeStaff || 0}
              loading={statsLoading}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Personnel Inactif"
              value={statsData?.inactiveStaff || 0}
              loading={statsLoading}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Paie Mensuelle"
              value={statsData?.monthlyPayroll || 0}
              loading={statsLoading}
              prefix={<DollarOutlined />}
              formatter={(value) => `${Number(value).toLocaleString()} XAF`}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters and Actions */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="Rechercher par nom, email, téléphone..."
              prefix={<SearchOutlined />}
                value={search}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Fonction"
              value={functionFilter}
              onChange={(value) => handleFilterChange('function', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="ENSEIGNANT">Enseignant</Option>
              <Option value="DIRECTEUR">Directeur</Option>
              <Option value="SURVEILLANT">Surveillant</Option>
              <Option value="SECRETAIRE">Secrétaire</Option>
              <Option value="COMPTABLE">Comptable</Option>
              <Option value="MAINTENANCE">Maintenance</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Contrat"
              value={contractFilter}
              onChange={(value) => handleFilterChange('contract', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="CDI">CDI</Option>
              <Option value="CDD">CDD</Option>
              <Option value="VACATAIRE">Vacataire</Option>
              <Option value="BENEVOLAT">Bénévolat</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Statut"
              value={statusFilter}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value={true}>Actif</Option>
              <Option value={false}>Inactif</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsFormModalOpen(true)}
              >
                Ajouter
              </Button>
              <Button
                icon={<DollarOutlined />}
                onClick={handleBulkGenerateSalaries}
                loading={bulkGenerateSalariesMutation.isPending}
              >
                Générer Salaires
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Staff Table */}
      <Card>
        <StaffTable
          staff={staffData?.data || []}
          loading={staffLoading}
          onView={handleViewStaff}
          onEdit={handleEditStaff}
          onGenerateSalary={handleGenerateSalary}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: staffData?.pagination?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showQuickJumper: true,
            showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} sur ${total} employés`,
            onChange: handleTableChange,
            onShowSizeChange: (_current: number, size: number) => {
              setCurrentPage(1);
              setPageSize(size);
            },
          }}
        />
      </Card>

      {/* Staff Form Modal */}
      <Modal
        title={selectedStaff ? 'Modifier le Personnel' : 'Ajouter un Membre du Personnel'}
        open={isFormModalOpen}
        onCancel={handleFormCancel}
        footer={null}
        width={800}
        destroyOnClose
      >
        <StaffForm
          staff={selectedStaff || undefined}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </Modal>

      {/* Staff Detail Drawer */}
      <StaffDetailDrawer
        staff={selectedStaff}
        visible={isDetailDrawerOpen}
        onClose={handleDetailClose}
        onEdit={handleEditStaff}
        onGenerateSalary={handleGenerateSalary}
      />

      {/* Salary Generation Modal */}
      <Modal
        title={`Générer le Salaire - ${selectedStaff?.firstName} ${selectedStaff?.lastName}`}
        open={isSalaryModalOpen}
        onCancel={() => {
          setIsSalaryModalOpen(false);
          setSelectedStaff(null);
        }}
        footer={null}
        width={600}
      >
        <p>Fonctionnalité de génération de salaire individuel à implémenter.</p>
        <p>Pour l'instant, utilisez la génération en lot via le bouton "Générer Salaires".</p>
      </Modal>
    </div>
  );
};

export default StaffPage;