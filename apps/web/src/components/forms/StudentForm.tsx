import React, { useEffect } from 'react';
import { Form, Input, Select, DatePicker, Button, Row, Col, Upload, message } from 'antd';
import { UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useForm } from 'antd/es/form/Form';
import dayjs from 'dayjs';
import { CreateStudentData, UpdateStudentData, Student } from '../../lib/hooks/useStudents';
import { useUploadStudentAvatar } from '../../lib/hooks/useStudents';

const { Option } = Select;
const { TextArea } = Input;

interface StudentFormProps {
  student?: Student;
  onSubmit: (data: CreateStudentData | UpdateStudentData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const StudentForm: React.FC<StudentFormProps> = ({ student, onSubmit, onCancel, loading }) => {
  const [form] = useForm();
  const uploadAvatarMutation = useUploadStudentAvatar();

  const isEditing = !!student;

  useEffect(() => {
    if (student) {
      form.setFieldsValue({
        ...student,
        dateOfBirth: student.dateOfBirth ? dayjs(student.dateOfBirth) : null,
        enrollmentDate: student.enrollmentDate ? dayjs(student.enrollmentDate) : null,
      });
    }
  }, [student, form]);

  const handleSubmit = (values: any) => {
    const formattedValues = {
      ...values,
      dateOfBirth: values.dateOfBirth?.format('YYYY-MM-DD'),
      enrollmentDate: values.enrollmentDate?.format('YYYY-MM-DD'),
    };
    onSubmit(formattedValues);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!student?.id) {
      message.error('Please save the student first before uploading avatar');
      return false;
    }

    try {
      await uploadAvatarMutation.mutateAsync({ id: student.id, file });
      message.success('Avatar uploaded successfully');
      return false; // Prevent default upload behavior
    } catch (error) {
      message.error('Failed to upload avatar');
      return false;
    }
  };

  const uploadProps = {
    beforeUpload: handleAvatarUpload,
    showUploadList: false,
    accept: 'image/*',
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        status: 'ACTIVE',
        gender: 'MALE',
      }}
    >
      <Row gutter={16}>
        {/* Avatar Upload */}
        <Col span={24}>
          <Form.Item label="Photo">
            <div className="flex items-center space-x-4">
              {student?.avatarUrl ? (
                <img
                  src={student.avatarUrl}
                  alt="Student Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                  <UserOutlined className="text-2xl text-gray-400" />
                </div>
              )}
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} loading={uploadAvatarMutation.isPending}>
                  {student?.avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </Upload>
            </div>
          </Form.Item>
        </Col>

        {/* Basic Information */}
        <Col span={12}>
          <Form.Item
            name="studentNumber"
            label="Numéro d'élève"
            rules={[{ required: true, message: 'Le numéro d\'élève est requis' }]}
          >
            <Input placeholder="Ex: STU2024001" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="status"
            label="Statut"
            rules={[{ required: true, message: 'Le statut est requis' }]}
          >
            <Select>
              <Option value="ACTIVE">Actif</Option>
              <Option value="INACTIVE">Inactif</Option>
              <Option value="GRADUATED">Diplômé</Option>
              <Option value="TRANSFERRED">Transféré</Option>
              <Option value="EXPELLED">Expulsé</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="firstName"
            label="Prénom"
            rules={[{ required: true, message: 'Le prénom est requis' }]}
          >
            <Input placeholder="Prénom de l'élève" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="lastName"
            label="Nom"
            rules={[{ required: true, message: 'Le nom est requis' }]}
          >
            <Input placeholder="Nom de l'élève" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="dateOfBirth"
            label="Date de naissance"
            rules={[{ required: true, message: 'La date de naissance est requise' }]}
          >
            <DatePicker className="w-full" placeholder="Sélectionner la date" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="gender"
            label="Sexe"
            rules={[{ required: true, message: 'Le sexe est requis' }]}
          >
            <Select>
              <Option value="MALE">Masculin</Option>
              <Option value="FEMALE">Féminin</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="placeOfBirth" label="Lieu de naissance">
            <Input placeholder="Lieu de naissance" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="nationality" label="Nationalité">
            <Input placeholder="Nationalité" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="enrollmentDate" label="Date d'inscription" rules={[{ required: true }]}>
            <DatePicker className="w-full" placeholder="Sélectionner la date" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="classId" label="Classe">
            <Select placeholder="Sélectionner une classe" allowClear>
              {/* Options will be loaded from API */}
              <Option value="class1">6ème A</Option>
              <Option value="class2">6ème B</Option>
              <Option value="class3">5ème A</Option>
            </Select>
          </Form.Item>
        </Col>

        {/* Contact Information */}
        <Col span={24}>
          <h3 className="text-lg font-semibold mb-4">Informations de contact</h3>
        </Col>

        <Col span={12}>
          <Form.Item
            name="phone"
            label="Téléphone"
            rules={[
              { pattern: /^[0-9+\-\s()]+$/, message: 'Format de téléphone invalide' }
            ]}
          >
            <Input placeholder="Numéro de téléphone" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { type: 'email', message: 'Format d\'email invalide' }
            ]}
          >
            <Input placeholder="Adresse email" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="address" label="Adresse">
            <TextArea rows={3} placeholder="Adresse complète" />
          </Form.Item>
        </Col>

        {/* Medical Information */}
        <Col span={24}>
          <h3 className="text-lg font-semibold mb-4">Informations médicales</h3>
        </Col>

        <Col span={12}>
          <Form.Item name="bloodType" label="Groupe sanguin">
            <Select placeholder="Sélectionner le groupe sanguin" allowClear>
              <Option value="A+">A+</Option>
              <Option value="A-">A-</Option>
              <Option value="B+">B+</Option>
              <Option value="B-">B-</Option>
              <Option value="AB+">AB+</Option>
              <Option value="AB-">AB-</Option>
              <Option value="O+">O+</Option>
              <Option value="O-">O-</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="allergies" label="Allergies">
            <TextArea rows={2} placeholder="Liste des allergies (si applicable)" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="medicalNotes" label="Notes médicales">
            <TextArea rows={3} placeholder="Notes médicales importantes" />
          </Form.Item>
        </Col>

        {/* Documents */}
        <Col span={24}>
          <h3 className="text-lg font-semibold mb-4">Documents</h3>
        </Col>

        <Col span={24}>
          <Form.Item name="birthCertificateUrl" label="Acte de naissance">
            <Input placeholder="URL de l'acte de naissance" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="vaccinationCardUrl" label="Carnet de vaccination">
            <Input placeholder="URL du carnet de vaccination" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="previousSchoolReportUrl" label="Bulletin de l'école précédente">
            <Input placeholder="URL du bulletin précédent" />
          </Form.Item>
        </Col>
      </Row>

      <div className="flex justify-end space-x-2 pt-6">
        <Button onClick={onCancel}>
          Annuler
        </Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          {isEditing ? 'Mettre à jour' : 'Créer'}
        </Button>
      </div>
    </Form>
  );
};

export default StudentForm;
