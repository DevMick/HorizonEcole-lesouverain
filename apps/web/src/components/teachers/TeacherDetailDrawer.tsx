import React from 'react';
import { Drawer, Descriptions, Tag, Avatar, Space } from 'antd';
import { UserOutlined, PhoneOutlined, MailOutlined, CalendarOutlined, BuildOutlined } from '@ant-design/icons';

interface TeacherDetailDrawerProps {
  visible: boolean;
  teacher: any;
  onClose: () => void;
}

const TeacherDetailDrawer: React.FC<TeacherDetailDrawerProps> = ({
  visible,
  teacher,
  onClose,
}) => {
  if (!teacher) return null;

  const getContractColor = (contractType: string) => {
    switch (contractType) {
      case 'CDI':
        return 'green';
      case 'CDD':
        return 'blue';
      case 'VACATAIRE':
        return 'orange';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Non renseignée';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <Drawer
      title={
        <div className="flex items-center space-x-3">
          <Avatar
            size={40}
            icon={<UserOutlined />}
          />
          <div>
            <div className="font-semibold">
              {teacher.first_name} {teacher.last_name}
            </div>
            <div className="text-sm text-gray-500">
              {teacher.email}
            </div>
          </div>
        </div>
      }
      placement="right"
      onClose={onClose}
      open={visible}
      width={600}
    >
      <div className="space-y-6">
        {/* Contract Type */}
        <div className="flex justify-center">
          <Tag color={getContractColor(teacher.contract_type)}>
            {teacher.contract_type}
          </Tag>
        </div>

        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Informations personnelles</h3>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Nom complet">
              {teacher.first_name} {teacher.last_name}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              <Space>
                <MailOutlined />
                {teacher.email}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Contact">
              {teacher.phone ? (
                <Space>
                  <PhoneOutlined />
                  {teacher.phone}
                </Space>
              ) : 'Non renseigné'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Professional Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Informations professionnelles</h3>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Type de contrat">
              <Space>
                <BuildOutlined />
                {teacher.contract_type}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Date d'embauche">
              <Space>
                <CalendarOutlined />
                {formatDate(teacher.hire_date)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Spécialités">
              {teacher.specialties || 'Non renseignées'}
            </Descriptions.Item>
            <Descriptions.Item label="Qualifications">
              {teacher.qualifications || 'Non renseignées'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>
    </Drawer>
  );
};

export default TeacherDetailDrawer;
