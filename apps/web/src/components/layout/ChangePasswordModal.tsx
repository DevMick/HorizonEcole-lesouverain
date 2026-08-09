import { Form, Input, Modal, message } from 'antd';
import { Lock } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePasswordModal({ open, onClose, onSuccess }: ChangePasswordModalProps) {
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.post('/auth/change-password', data);
      return response.data;
    },
    onSuccess: () => {
      form.resetFields();
      onSuccess();
    },
  });

  const handleOk = async () => {
    const values = await form.validateFields();
    mutation.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
          Changer le mot de passe
        </span>
      }
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={mutation.isPending}
      okText="Modifier"
      cancelText="Annuler"
      width={500}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="currentPassword"
          label="Mot de passe actuel"
          rules={[{ required: true, message: 'Veuillez saisir votre mot de passe actuel' }]}
        >
          <Input.Password placeholder="Mot de passe actuel" size="large" />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="Nouveau mot de passe"
          rules={[
            { required: true, message: 'Veuillez saisir un nouveau mot de passe' },
            { min: 8, message: 'Le mot de passe doit contenir au moins 8 caractères' },
          ]}
        >
          <Input.Password placeholder="Nouveau mot de passe" size="large" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirmer le nouveau mot de passe"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Veuillez confirmer le nouveau mot de passe' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Les mots de passe ne correspondent pas'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="Confirmer le nouveau mot de passe" size="large" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
