import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Space,
  Row,
  Col,
  Typography,
  Table,
  Tag,
  message,
  Popconfirm,
  DatePicker,
  Divider,
  Card,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface TeacherRemunerationTabProps {
  teacherId: string;
}

export default function TeacherRemunerationTab({ teacherId }: TeacherRemunerationTabProps) {
  const [remunerationForm] = Form.useForm();
  const [allowanceForm] = Form.useForm();
  const [isEditingRemuneration, setIsEditingRemuneration] = useState(false);
  const [isAddingAllowance, setIsAddingAllowance] = useState(false);
  const [editingAllowanceId, setEditingAllowanceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch remuneration data
  const { data: remunerationData, isLoading: remunerationLoading } = useQuery({
    queryKey: ['teacher-remuneration', teacherId],
    queryFn: async () => {
      const response = await api.get(`/teacher-remuneration/${teacherId}`);
      return response.data.data;
    },
    enabled: !!teacherId,
  });

  // Fetch allowances
  const { data: allowancesData, isLoading: allowancesLoading } = useQuery({
    queryKey: ['teacher-allowances', teacherId],
    queryFn: async () => {
      const response = await api.get(`/teacher-remuneration/${teacherId}/allowances`);
      return response.data.data || [];
    },
    enabled: !!teacherId,
  });

  // Update remuneration mutation
  const updateRemunerationMutation = useMutation({
    mutationFn: async (values: any) => {
      // Convertir les noms de champs de snake_case vers camelCase pour le backend
      const formattedValues = {
        modeRemuneration: values.mode_remuneration,
        tauxHoraire: values.taux_horaire,
        heuresHebdo: values.heures_hebdo,
        forfaitMensuel: values.forfait_mensuel,
        periodeFacturation: values.periode_facturation,
        cnpsApplicable: values.cnps_applicable,
        compteBancaire: values.compte_bancaire,
        modePaiement: values.mode_paiement,
      };
      const response = await api.put(`/teacher-remuneration/${teacherId}`, formattedValues);
      return response.data;
    },
    onSuccess: () => {
      message.success('Rémunération mise à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['teacher-remuneration', teacherId] });
      setIsEditingRemuneration(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  // Create allowance mutation
  const createAllowanceMutation = useMutation({
    mutationFn: async (values: any) => {
      const response = await api.post(`/teacher-remuneration/${teacherId}/allowances`, values);
      return response.data;
    },
    onSuccess: () => {
      message.success('Prime/Indemnité ajoutée avec succès');
      queryClient.invalidateQueries({ queryKey: ['teacher-allowances', teacherId] });
      allowanceForm.resetFields();
      setIsAddingAllowance(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Erreur lors de l\'ajout');
    },
  });

  // Update allowance mutation
  const updateAllowanceMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const response = await api.put(`/teacher-remuneration/allowances/${id}`, values);
      return response.data;
    },
    onSuccess: () => {
      message.success('Prime/Indemnité mise à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['teacher-allowances', teacherId] });
      setEditingAllowanceId(null);
      allowanceForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  // Delete allowance mutation
  const deleteAllowanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/teacher-remuneration/allowances/${id}`);
      return response.data;
    },
    onSuccess: () => {
      message.success('Prime/Indemnité supprimée avec succès');
      queryClient.invalidateQueries({ queryKey: ['teacher-allowances', teacherId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  // Populate form when data is loaded
  useEffect(() => {
    if (remunerationData) {
      remunerationForm.setFieldsValue({
        mode_remuneration: remunerationData.mode_remuneration,
        taux_horaire: remunerationData.taux_horaire ? Number(remunerationData.taux_horaire) : undefined,
        heures_hebdo: remunerationData.heures_hebdo,
        forfait_mensuel: remunerationData.forfait_mensuel ? Number(remunerationData.forfait_mensuel) : undefined,
        periode_facturation: remunerationData.periode_facturation || 'MENSUELLE',
        cnps_applicable: remunerationData.cnps_applicable,
        compte_bancaire: remunerationData.compte_bancaire,
        mode_paiement: remunerationData.mode_paiement,
      });
    }
  }, [remunerationData, remunerationForm]);

  const handleRemunerationSubmit = (values: any) => {
    updateRemunerationMutation.mutate(values);
  };

  const handleAllowanceSubmit = (values: any) => {
    // Convertir les noms de champs de snake_case vers camelCase pour le backend
    const formattedValues = {
      title: values.title,
      amount: values.amount,
      typeMontant: values.type_montant, // Convertir type_montant -> typeMontant
      isRecurring: values.is_recurring, // Convertir is_recurring -> isRecurring
      isTaxable: values.is_taxable, // Convertir is_taxable -> isTaxable
      category: values.category,
      effectiveFrom: values.effective_from ? values.effective_from.format('YYYY-MM-DD') : undefined, // Convertir effective_from -> effectiveFrom et formater la date
      effectiveTo: values.effective_to ? values.effective_to.format('YYYY-MM-DD') : undefined, // Convertir effective_to -> effectiveTo et formater la date
      notes: values.notes,
      condition: values.condition,
    };

    if (editingAllowanceId) {
      updateAllowanceMutation.mutate({ id: editingAllowanceId, values: formattedValues });
    } else {
      createAllowanceMutation.mutate(formattedValues);
    }
  };

  const handleEditAllowance = (allowance: any) => {
    setEditingAllowanceId(allowance.id);
    setIsAddingAllowance(true);
    allowanceForm.setFieldsValue({
      title: allowance.title,
      amount: Number(allowance.amount),
      type_montant: allowance.type_montant,
      is_recurring: allowance.is_recurring,
      is_taxable: allowance.is_taxable,
      category: allowance.category,
      effective_from: dayjs(allowance.effective_from),
      effective_to: allowance.effective_to ? dayjs(allowance.effective_to) : undefined,
      notes: allowance.notes,
      condition: allowance.condition,
    });
  };

  const handleCancelAllowance = () => {
    setIsAddingAllowance(false);
    setEditingAllowanceId(null);
    allowanceForm.resetFields();
  };

  const allowanceColumns = [
    {
      title: 'Titre',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Montant',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => {
        if (record.type_montant === 'POURCENTAGE_DU_BRUT') {
          return `${amount}%`;
        }
        return `${Number(amount).toLocaleString('fr-FR')} FCFA`;
      },
    },
    {
      title: 'Catégorie',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const colors: { [key: string]: string } = {
          INDEMNITE: 'blue',
          PRIME: 'green',
          AVANTAGE: 'orange',
          AVANTAGE_EN_NATURE: 'purple',
        };
        return <Tag color={colors[category] || 'default'}>{category}</Tag>;
      },
    },
    {
      title: 'Récurrente',
      dataIndex: 'is_recurring',
      key: 'is_recurring',
      render: (isRecurring: boolean) => (
        <Tag color={isRecurring ? 'green' : 'default'}>
          {isRecurring ? 'Oui' : 'Non'}
        </Tag>
      ),
    },
    {
      title: 'Taxable',
      dataIndex: 'is_taxable',
      key: 'is_taxable',
      render: (isTaxable: boolean) => (
        <Tag color={isTaxable ? 'red' : 'default'}>
          {isTaxable ? 'Oui' : 'Non'}
        </Tag>
      ),
    },
    {
      title: 'Période',
      key: 'period',
      render: (_: any, record: any) => {
        const from = dayjs(record.effective_from).format('DD/MM/YYYY');
        const to = record.effective_to ? dayjs(record.effective_to).format('DD/MM/YYYY') : 'En cours';
        return `${from} - ${to}`;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditAllowance(record)}
          >
            Modifier
          </Button>
          <Popconfirm
            title="Êtes-vous sûr de vouloir supprimer cette prime/indemnité ?"
            onConfirm={() => deleteAllowanceMutation.mutate(record.id)}
            okText="Oui"
            cancelText="Non"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              Supprimer
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Paramètres de rémunération */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarOutlined style={{ color: 'rgb(var(--role-primary))' }} />
            Paramètres de rémunération
          </Title>
          {!isEditingRemuneration && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setIsEditingRemuneration(true)}
            >
              Modifier
            </Button>
          )}
        </div>

        <Form
          form={remunerationForm}
          layout="vertical"
          onFinish={handleRemunerationSubmit}
          disabled={!isEditingRemuneration}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="mode_remuneration"
                label="Mode de rémunération"
                rules={[{ required: true, message: 'Veuillez sélectionner un mode' }]}
              >
                <Select>
                  <Option value="HORAIRE">Horaire</Option>
                  <Option value="FORFAIT_MENSUEL">Forfait mensuel</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="periode_facturation"
                label="Période de facturation"
              >
                <Select>
                  <Option value="MENSUELLE">Mensuelle</Option>
                  <Option value="HEBDOMADAIRE">Hebdomadaire</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.mode_remuneration !== currentValues.mode_remuneration
            }
          >
            {({ getFieldValue }) => {
              const mode = getFieldValue('mode_remuneration');
              if (mode === 'HORAIRE') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="taux_horaire"
                        label="Taux horaire (FCFA)"
                        rules={[{ required: true, message: 'Veuillez saisir le taux horaire' }]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                      parser={(value) => (parseFloat(value!.replace(/\s?/g, '')) || 0) as any}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="heures_hebdo"
                        label="Heures par semaine"
                        rules={[{ required: true, message: 'Veuillez saisir le nombre d\'heures' }]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          max={40}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              } else if (mode === 'FORFAIT_MENSUEL') {
                return (
                  <Form.Item
                    name="forfait_mensuel"
                    label="Forfait mensuel (FCFA)"
                    rules={[{ required: true, message: 'Veuillez saisir le forfait mensuel' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                      parser={(value) => (parseFloat(value!.replace(/\s?/g, '')) || 0) as any}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="compte_bancaire"
                label="Compte bancaire"
              >
                <Input placeholder="Numéro de compte" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="mode_paiement"
                label="Mode de paiement"
              >
                <Select placeholder="Sélectionner un mode">
                  <Option value="VIREMENT">Virement</Option>
                  <Option value="CHEQUE">Chèque</Option>
                  <Option value="ESPECES">Espèces</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="cnps_applicable"
            valuePropName="checked"
            label="CNPS applicable"
          >
            <Switch />
          </Form.Item>

          {isEditingRemuneration && (
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={updateRemunerationMutation.isPending}
                >
                  Enregistrer
                </Button>
                <Button onClick={() => {
                  setIsEditingRemuneration(false);
                  remunerationForm.resetFields();
                }}>
                  Annuler
                </Button>
              </Space>
            </Form.Item>
          )}
        </Form>
      </div>

      <Divider />

      {/* Primes et indemnités */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={5} style={{ margin: 0 }}>
            Primes et Indemnités
          </Title>
          {!isAddingAllowance && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsAddingAllowance(true)}
            >
              Ajouter une prime/indemnité
            </Button>
          )}
        </div>

        {isAddingAllowance && (
          <Card style={{ marginBottom: '16px', background: '#fafafa' }}>
            <Form
              form={allowanceForm}
              layout="vertical"
              onFinish={handleAllowanceSubmit}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="title"
                    label="Titre"
                    rules={[{ required: true, message: 'Veuillez saisir un titre' }]}
                  >
                    <Input placeholder="Ex: Indemnité transport" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="category"
                    label="Catégorie"
                    rules={[{ required: true, message: 'Veuillez sélectionner une catégorie' }]}
                  >
                    <Select>
                      <Option value="INDEMNITE">Indemnité</Option>
                      <Option value="PRIME">Prime</Option>
                      <Option value="AVANTAGE">Avantage</Option>
                      <Option value="AVANTAGE_EN_NATURE">Avantage en nature</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="type_montant"
                    label="Type de montant"
                    rules={[{ required: true }]}
                  >
                    <Select>
                      <Option value="MONTANT_FIXE">Montant fixe</Option>
                      <Option value="POURCENTAGE_DU_BRUT">Pourcentage du brut</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="amount"
                    label="Montant"
                    rules={[{ required: true, message: 'Veuillez saisir un montant' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                      parser={(value) => (parseFloat(value!.replace(/\s?/g, '')) || 0) as any}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="is_recurring"
                    valuePropName="checked"
                    label="Récurrente"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="is_taxable"
                    valuePropName="checked"
                    label="Taxable"
                  >
                    <Switch defaultChecked />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="effective_from"
                    label="Date de début"
                    rules={[{ required: true }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="effective_to"
                    label="Date de fin (optionnel)"
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="notes"
                label="Notes"
              >
                <TextArea rows={2} placeholder="Notes ou conditions" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={createAllowanceMutation.isPending || updateAllowanceMutation.isPending}
                  >
                    {editingAllowanceId ? 'Modifier' : 'Ajouter'}
                  </Button>
                  <Button onClick={handleCancelAllowance}>
                    Annuler
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

        <Table
          columns={allowanceColumns}
          dataSource={allowancesData || []}
          loading={allowancesLoading}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </div>
    </div>
  );
}

