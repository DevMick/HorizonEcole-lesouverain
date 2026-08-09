import React from 'react';
import { Table, Button, Space, Tag, Avatar, Dropdown, Modal, message, Tooltip } from 'antd';
import { MoreOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UserOutlined, DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Staff } from '../../lib/hooks/useStaff';
import { useDeleteStaff } from '../../lib/hooks/useStaff';

interface StaffTableProps {
  staff: Staff[];
  loading?: boolean;
  onEdit?: (staff: Staff) => void;
  onView?: (staff: Staff) => void;
  onGenerateSalary?: (staff: Staff) => void;
  pagination?: any;
}

const StaffTable: React.FC<StaffTableProps> = ({
  staff,
  loading,
  onEdit,
  onView,
  onGenerateSalary,
  pagination,
}) => {
  const deleteStaffMutation = useDeleteStaff();

  const handleDelete = async (staff: Staff) => {
    Modal.confirm({
      title: 'Delete Staff Member',
      content: `Are you sure you want to delete ${staff.firstName} ${staff.lastName}?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteStaffMutation.mutateAsync(staff.id);
          message.success('Staff member deleted successfully');
        } catch (error: any) {
          message.error(error.response?.data?.error || 'Failed to delete staff member');
        }
      },
    });
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

  const columns: ColumnsType<Staff> = [
    {
      title: 'Staff Member',
      key: 'staff',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>
              {record.firstName} {record.lastName}
            </div>
            {record.email && (
              <div style={{ fontSize: 12, color: '#666' }}>
                {record.email}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Function',
      dataIndex: 'function',
      key: 'function',
      render: (func: string) => (
        <Tag color={getFunctionColor(func)}>
          {func}
        </Tag>
      ),
      filters: [
        { text: 'Enseignant', value: 'ENSEIGNANT' },
        { text: 'Directeur', value: 'DIRECTEUR' },
        { text: 'Surveillant', value: 'SURVEILLANT' },
        { text: 'Secrétaire', value: 'SECRETAIRE' },
        { text: 'Comptable', value: 'COMPTABLE' },
        { text: 'Maintenance', value: 'MAINTENANCE' },
      ],
      onFilter: (value, record) => record.function === value,
    },
    {
      title: 'Contract',
      dataIndex: 'contractType',
      key: 'contractType',
      render: (type: string) => (
        <Tag color={getContractTypeColor(type)}>
          {type}
        </Tag>
      ),
      filters: [
        { text: 'CDI', value: 'CDI' },
        { text: 'CDD', value: 'CDD' },
        { text: 'Vacataire', value: 'VACATAIRE' },
        { text: 'Bénévolat', value: 'BENEVOLAT' },
      ],
      onFilter: (value, record) => record.contractType === value,
    },
    {
      title: 'Base Salary',
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      render: (salary: number) => formatCurrency(salary),
      sorter: (a, b) => a.baseSalary - b.baseSalary,
    },
    {
      title: 'Hire Date',
      dataIndex: 'hireDate',
      key: 'hireDate',
      render: (date: string) => formatDate(date),
      sorter: (a, b) => new Date(a.hireDate).getTime() - new Date(b.hireDate).getTime(),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {onView && (
            <Tooltip title="View Details">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => onView(record)}
              />
            </Tooltip>
          )}
          
          {onGenerateSalary && (
            <Tooltip title="Generate Salary">
              <Button
                type="text"
                icon={<DollarOutlined />}
                onClick={() => onGenerateSalary(record)}
              />
            </Tooltip>
          )}

          <Dropdown
            menu={{
              items: [
                {
                  key: 'edit',
                  label: 'Edit',
                  icon: <EditOutlined />,
                  onClick: () => onEdit?.(record),
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleDelete(record),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={staff}
      loading={loading}
      rowKey="id"
      pagination={pagination}
      scroll={{ x: 800 }}
    />
  );
};

export default StaffTable;
