import React, { useEffect } from 'react';
import { Form, Input, Select, Button, Row, Col, Upload, message, Switch } from 'antd';
import { UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useForm } from 'antd/es/form/Form';
import { CreateParentData, UpdateParentData, Parent } from '../../lib/hooks/useParents';
import { useUploadParentAvatar } from '../../lib/hooks/useParents';

const { Option } = Select;
const { TextArea } = Input;

interface ParentFormProps {
  parent?: Parent;
  onSubmit: (data: CreateParentData | UpdateParentData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const ParentForm: React.FC<ParentFormProps> = ({ parent, onSubmit, onCancel, loading }) => {
  const [form] = useForm();
  const uploadAvatarMutation = useUploadParentAvatar();

  const isEditing = !!parent;

  useEffect(() => {
    if (parent) {
      form.setFieldsValue(parent);
    }
  }, [parent, form]);

  const handleSubmit = (values: any) => {
    onSubmit(values);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!parent?.id) {
      message.error('Please save the parent first before uploading avatar');
      return false;
    }

    try {
      await uploadAvatarMutation.mutateAsync({ id: parent.id, file });
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
        relation: 'PERE',
        isPrimaryContact: false,
        isFinancialResponsible: false,
      }}
    >
      <Row gutter={16}>
        {/* Avatar Upload */}
        <Col span={24}>
          <Form.Item label="Photo">
            <div className="flex items-center space-x-4">
              {parent?.avatarUrl ? (
                <img
                  src={parent.avatarUrl}
                  alt="Parent Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                  <UserOutlined className="text-2xl text-gray-400" />
                </div>
              )}
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} loading={uploadAvatarMutation.isPending}>
                  {parent?.avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </Upload>
            </div>
          </Form.Item>
        </Col>

        {/* Basic Information */}
        <Col span={12}>
          <Form.Item
            name="firstName"
            label="Prénom"
            rules={[{ required: true, message: 'Le prénom est requis' }]}
          >
            <Input placeholder="Prénom du parent" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="lastName"
            label="Nom"
            rules={[{ required: true, message: 'Le nom est requis' }]}
          >
            <Input placeholder="Nom du parent" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            name="relation"
            label="Relation avec l'élève"
            rules={[{ required: true, message: 'La relation est requise' }]}
          >
            <Select>
              <Option value="PERE">Père</Option>
              <Option value="MERE">Mère</Option>
              <Option value="TUTEUR">Tuteur</Option>
              <Option value="AUTRE">Autre</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="phone"
            label="Téléphone"
            rules={[
              { required: true, message: 'Le téléphone est requis' },
              { pattern: /^[0-9+\-\s()]+$/, message: 'Format de téléphone invalide' }
            ]}
          >
            <Input placeholder="Numéro de téléphone" />
          </Form.Item>
        </Col>

        {/* Contact Information */}
        <Col span={24}>
          <h3 className="text-lg font-semibold mb-4">Informations de contact</h3>
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

        {/* Professional Information */}
        <Col span={24}>
          <h3 className="text-lg font-semibold mb-4">Informations professionnelles</h3>
        </Col>

        <Col span={12}>
          <Form.Item name="profession" label="Profession">
            <Input placeholder="Profession" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="workplace" label="Lieu de travail">
            <Input placeholder="Lieu de travail" />
          </Form.Item>
        </Col>

        {/* Roles */}
        <Col span={24}>
          <h3 className="text-lg font-semibold mb-4">Rôles</h3>
        </Col>

        <Col span={12}>
          <Form.Item name="isPrimaryContact" label="Contact principal" valuePropName="checked">
            <Switch checkedChildren="Oui" unCheckedChildren="Non" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="isFinancialResponsible" label="Responsable financier" valuePropName="checked">
            <Switch checkedChildren="Oui" unCheckedChildren="Non" />
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

export default ParentForm;
