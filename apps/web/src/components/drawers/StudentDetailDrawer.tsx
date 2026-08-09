import React from 'react';
import { Drawer, Descriptions, Tag, Avatar, List, Button, Space } from 'antd';
import { UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, CalendarOutlined } from '@ant-design/icons';
import { Student } from '../../lib/hooks/useStudents';

interface StudentDetailDrawerProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
}

const StudentDetailDrawer: React.FC<StudentDetailDrawerProps> = ({
  visible,
  student,
  onClose,
}) => {
  if (!student) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'INACTIVE':
        return 'orange';
      case 'GRADUATED':
        return 'blue';
      case 'TRANSFERRED':
        return 'purple';
      case 'EXPELLED':
        return 'red';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Actif';
      case 'INACTIVE':
        return 'Inactif';
      case 'GRADUATED':
        return 'Diplômé';
      case 'TRANSFERRED':
        return 'Transféré';
      case 'EXPELLED':
        return 'Expulsé';
      default:
        return status;
    }
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <Drawer
      title={
        <div className="flex items-center space-x-3">
          <Avatar
            size={40}
            src={student.avatarUrl}
            icon={<UserOutlined />}
          />
          <div>
            <div className="font-semibold">
              {student.firstName} {student.lastName}
            </div>
            <div className="text-sm text-gray-500">
              {student.studentNumber}
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
        {/* Status */}
        <div className="flex justify-center">
          <Tag color={getStatusColor(student.status)}>
            {getStatusText(student.status)}
          </Tag>
        </div>

        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Informations personnelles</h3>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Nom complet">
              {student.firstName} {student.lastName}
            </Descriptions.Item>
            <Descriptions.Item label="Numéro d'élève">
              {student.studentNumber}
            </Descriptions.Item>
            <Descriptions.Item label="Date de naissance">
              <Space>
                <CalendarOutlined />
                {formatDate(student.dateOfBirth)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Lieu de naissance">
              {student.placeOfBirth || 'Non renseigné'}
            </Descriptions.Item>
            <Descriptions.Item label="Sexe">
              {getGenderText(student.gender)}
            </Descriptions.Item>
            <Descriptions.Item label="Nationalité">
              {student.nationality || 'Non renseignée'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Informations de contact</h3>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Téléphone">
              {student.phone ? (
                <Space>
                  <PhoneOutlined />
                  {student.phone}
                </Space>
              ) : 'Non renseigné'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {student.email ? (
                <Space>
                  <MailOutlined />
                  {student.email}
                </Space>
              ) : 'Non renseigné'}
            </Descriptions.Item>
            <Descriptions.Item label="Adresse">
              {student.address ? (
                <Space>
                  <HomeOutlined />
                  {student.address}
                </Space>
              ) : 'Non renseignée'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Academic Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Informations académiques</h3>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Classe">
              {student.class?.name || 'Non assignée'}
            </Descriptions.Item>
            <Descriptions.Item label="Niveau">
              {student.class?.level || 'Non renseigné'}
            </Descriptions.Item>
            <Descriptions.Item label="Date d'inscription">
              <Space>
                <CalendarOutlined />
                {formatDate(student.enrollmentDate)}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Medical Information */}
        {(student.bloodType || student.allergies || student.medicalNotes) && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Informations médicales</h3>
            <Descriptions column={1} size="small">
              {student.bloodType && (
                <Descriptions.Item label="Groupe sanguin">
                  {student.bloodType}
                </Descriptions.Item>
              )}
              {student.allergies && (
                <Descriptions.Item label="Allergies">
                  {student.allergies}
                </Descriptions.Item>
              )}
              {student.medicalNotes && (
                <Descriptions.Item label="Notes médicales">
                  {student.medicalNotes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}

        {/* Parents */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Parents</h3>
          {student.studentParents && student.studentParents.length > 0 ? (
            <List
              dataSource={student.studentParents}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={`${item.parent.firstName} ${item.parent.lastName}`}
                    description={
                      <Space wrap>
                        <Tag color={getRelationColor(item.relation)}>
                          {getRelationText(item.relation)}
                        </Tag>
                        <span>{item.parent.phone}</span>
                        {item.parent.isPrimaryContact && (
                          <Tag color="green">Contact Principal</Tag>
                        )}
                        {item.parent.isFinancialResponsible && (
                          <Tag color="blue">Responsable Financier</Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <div className="text-gray-500 text-center py-4">
              Aucun parent lié à cet élève
            </div>
          )}
        </div>

        {/* Documents */}
        {(student.birthCertificateUrl || student.vaccinationCardUrl || student.previousSchoolReportUrl) && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Documents</h3>
            <List>
              {student.birthCertificateUrl && (
                <List.Item>
                  <Button type="link" href={student.birthCertificateUrl} target="_blank">
                    Acte de naissance
                  </Button>
                </List.Item>
              )}
              {student.vaccinationCardUrl && (
                <List.Item>
                  <Button type="link" href={student.vaccinationCardUrl} target="_blank">
                    Carnet de vaccination
                  </Button>
                </List.Item>
              )}
              {student.previousSchoolReportUrl && (
                <List.Item>
                  <Button type="link" href={student.previousSchoolReportUrl} target="_blank">
                    Bulletin de l'école précédente
                  </Button>
                </List.Item>
              )}
            </List>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default StudentDetailDrawer;
