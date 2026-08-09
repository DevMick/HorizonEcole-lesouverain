import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Button, message, List, Avatar, Tag, Space } from 'antd';
import { SearchOutlined, UserOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
import { Student, useLinkParentToStudent, useUnlinkParentFromStudent } from '../../lib/hooks/useStudents';
import { useSearchParents } from '../../lib/hooks/useParents';

const { Option } = Select;

interface ParentLinkModalProps {
  visible: boolean;
  student: Student | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const ParentLinkModal: React.FC<ParentLinkModalProps> = ({
  visible,
  student,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParent, setSelectedParent] = useState<any>(null);

  const { data: searchResults, isLoading: isSearching } = useSearchParents(searchQuery);
  const linkParentMutation = useLinkParentToStudent();
  const unlinkParentMutation = useUnlinkParentFromStudent();

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

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleParentSelect = (parent: any) => {
    setSelectedParent(parent);
    form.setFieldsValue({
      relation: parent.relation,
    });
  };

  const handleLinkParent = async (values: any) => {
    if (!student || !selectedParent) {
      message.error('Veuillez sélectionner un parent');
      return;
    }

    try {
      await linkParentMutation.mutateAsync({
        studentId: student.id,
        parentId: selectedParent.id,
        relation: values.relation,
      });
      message.success('Parent lié avec succès');
      onSuccess();
    } catch (error) {
      message.error('Erreur lors de la liaison du parent');
    }
  };

  const handleUnlinkParent = async (parentId: string) => {
    if (!student) return;

    try {
      await unlinkParentMutation.mutateAsync({
        studentId: student.id,
        parentId,
      });
      message.success('Parent dissocié avec succès');
      onSuccess();
    } catch (error) {
      message.error('Erreur lors de la dissociation du parent');
    }
  };

  const resetModal = () => {
    setSearchQuery('');
    setSelectedParent(null);
    form.resetFields();
  };

  useEffect(() => {
    if (!visible) {
      resetModal();
    }
  }, [visible]);

  return (
    <Modal
      title={`Lier des parents - ${student?.firstName} ${student?.lastName}`}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnClose
    >
      <div className="space-y-6">
        {/* Current Parents */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Parents actuels</h3>
          {student?.studentParents && student.studentParents.length > 0 ? (
            <List
              dataSource={student.studentParents}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="unlink"
                      type="link"
                      danger
                      icon={<DisconnectOutlined />}
                      onClick={() => handleUnlinkParent(item.parent.id)}
                      loading={unlinkParentMutation.isPending}
                    >
                      Dissocier
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        src={item.parent.avatarUrl}
                        icon={<UserOutlined />}
                      />
                    }
                    title={`${item.parent.firstName} ${item.parent.lastName}`}
                    description={
                      <Space>
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

        {/* Search and Link New Parent */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Lier un nouveau parent</h3>
          
          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Rechercher un parent par nom, téléphone ou email..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="mb-4"
            />
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="mb-4 max-h-64 overflow-y-auto border rounded p-2">
              {isSearching ? (
                <div className="text-center py-4">Recherche en cours...</div>
              ) : searchResults?.data && searchResults.data.length > 0 ? (
                <List
                  size="small"
                  dataSource={searchResults.data}
                  renderItem={(parent: any) => (
                    <List.Item
                      className="cursor-pointer hover:bg-gray-50 p-2 rounded"
                      onClick={() => handleParentSelect(parent)}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={`${parent.firstName} ${parent.lastName}`}
                        description={
                          <Space>
                            <Tag color={getRelationColor(parent.relation)}>
                              {getRelationText(parent.relation)}
                            </Tag>
                            <span>{parent.phone}</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div className="text-gray-500 text-center py-4">
                  Aucun parent trouvé
                </div>
              )}
            </div>
          )}

          {/* Link Form */}
          {selectedParent && (
            <div className="border rounded p-4 bg-gray-50">
              <h4 className="font-medium mb-3">Parent sélectionné</h4>
              <div className="flex items-center space-x-3 mb-4">
                <Avatar src={selectedParent.avatarUrl} icon={<UserOutlined />} />
                <div>
                  <div className="font-medium">
                    {selectedParent.firstName} {selectedParent.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedParent.phone} • {selectedParent.email}
                  </div>
                </div>
              </div>

              <Form form={form} onFinish={handleLinkParent} layout="vertical">
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

                <Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<LinkOutlined />}
                      loading={linkParentMutation.isPending}
                    >
                      Lier le parent
                    </Button>
                    <Button onClick={() => setSelectedParent(null)}>
                      Annuler
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ParentLinkModal;
