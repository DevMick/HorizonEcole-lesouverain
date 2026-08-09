import React, { useEffect } from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Upload, Button, Row, Col, Space, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { Staff, CreateStaffData, UpdateStaffData } from '../../lib/hooks/useStaff';
import { useCreateStaff, useUpdateStaff } from '../../lib/hooks/useStaff';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface StaffFormProps {
  staff?: Staff;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const StaffForm: React.FC<StaffFormProps> = ({ staff, onSuccess, onCancel }) => {
  const [form] = Form.useForm();
  const createStaffMutation = useCreateStaff();
  const updateStaffMutation = useUpdateStaff();

  const isEditing = !!staff;

  useEffect(() => {
    if (staff) {
      form.setFieldsValue({
        ...staff,
        hireDate: staff.hireDate ? dayjs(staff.hireDate) : undefined,
        endDate: staff.endDate ? dayjs(staff.endDate) : undefined,
      });
    }
  }, [staff, form]);

  const handleSubmit = async (values: any) => {
    try {
      const formData = {
        ...values,
        hireDate: values.hireDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };

      if (isEditing) {
        await updateStaffMutation.mutateAsync({
          id: staff!.id,
          data: formData as UpdateStaffData,
        });
        message.success('Staff member updated successfully');
      } else {
        await createStaffMutation.mutateAsync(formData as CreateStaffData);
        message.success('Staff member created successfully');
      }

      onSuccess?.();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to save staff member');
    }
  };

  const handleFileUpload = (info: any) => {
    if (info.file.status === 'done') {
      message.success(`${info.file.name} uploaded successfully`);
      form.setFieldsValue({
        [info.file.field]: info.file.response?.data?.url,
      });
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} upload failed`);
    }
  };

  const uploadProps = {
    name: 'file',
    action: '/api/upload',
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    onChange: handleFileUpload,
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        function: 'ENSEIGNANT',
        contractType: 'CDI',
        isActive: true,
      }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="firstName"
            label="Prénom"
            rules={[{ required: true, message: 'Please enter first name' }]}
          >
            <Input placeholder="Enter first name" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="lastName"
            label="Nom"
            rules={[{ required: true, message: 'Please enter last name' }]}
          >
            <Input placeholder="Enter last name" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="phone"
            label="Téléphone"
            rules={[
              { pattern: /^[+]?[\d\s\-()]+$/, message: 'Please enter a valid phone number' }
            ]}
          >
            <Input placeholder="Enter phone number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter email address" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="address"
        label="Adresse"
      >
        <TextArea rows={2} placeholder="Enter address" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="function"
            label="Fonction"
            rules={[{ required: true, message: 'Please select function' }]}
          >
            <Select placeholder="Select function">
              <Option value="ENSEIGNANT">Enseignant</Option>
              <Option value="DIRECTEUR">Directeur</Option>
              <Option value="SURVEILLANT">Surveillant</Option>
              <Option value="SECRETAIRE">Secrétaire</Option>
              <Option value="COMPTABLE">Comptable</Option>
              <Option value="MAINTENANCE">Maintenance</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="specialization"
            label="Spécialisation"
          >
            <Input placeholder="Enter specialization" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="contractType"
            label="Type de contrat"
            rules={[{ required: true, message: 'Please select contract type' }]}
          >
            <Select placeholder="Select contract type">
              <Option value="CDI">CDI</Option>
              <Option value="CDD">CDD</Option>
              <Option value="VACATAIRE">Vacataire</Option>
              <Option value="BENEVOLAT">Bénévolat</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="baseSalary"
            label="Salaire de base (XAF)"
            rules={[
              { required: true, message: 'Please enter base salary' },
              { type: 'number', min: 0, message: 'Salary must be positive' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter base salary"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="hireDate"
            label="Date d'embauche"
            rules={[{ required: true, message: 'Please select hire date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="endDate"
            label="Date de fin (optionnel)"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      {/* Document uploads */}
      <div style={{ marginTop: 24 }}>
        <h4>Documents</h4>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="cvUrl" label="CV">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>Upload CV</Button>
              </Upload>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="diplomaUrl" label="Diplôme">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>Upload Diploma</Button>
              </Upload>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="contractUrl" label="Contrat">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>Upload Contract</Button>
              </Upload>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="idCardUrl" label="Pièce d'identité">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>Upload ID Card</Button>
              </Upload>
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Form.Item style={{ marginTop: 24 }}>
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={createStaffMutation.isPending || updateStaffMutation.isPending}
          >
            {isEditing ? 'Update' : 'Create'} Staff Member
          </Button>
          {onCancel && (
            <Button onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Space>
      </Form.Item>
    </Form>
  );
};

export default StaffForm;
