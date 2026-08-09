import { Form, Input, Select, Row, Col, Switch } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ds';

export interface PersonnelUserFormPageProps {
  form: FormInstance;
  editing: any;
  roles: { id: string; name: string }[];
  resetPassword: boolean;
  onResetPasswordChange: (v: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

const PASSWORD_RULES = [
  { pattern: /^\d+$/, message: 'Le mot de passe doit être uniquement numérique' },
  { min: 6, message: 'Le mot de passe doit contenir au moins 6 chiffres' },
];

/**
 * Formulaire création/édition d'un compte personnel : identité + rôle
 * (détermine à la fois les menus visibles et les droits API réels — le rôle
 * protégé « Administrateur » donne l'accès complet) + mot de passe numérique
 * (§ règle métier).
 */
export function PersonnelUserFormPage(props: PersonnelUserFormPageProps) {
  const { form, editing, roles, resetPassword, onResetPasswordChange, onCancel, onSubmit, submitting } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {editing ? 'Mettez à jour ce compte personnel.' : 'Créez un compte pour un membre du personnel.'}
          </p>
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="lastName" label="Nom" rules={[{ required: true, message: 'Nom requis' }, { min: 2, message: 'Minimum 2 caractères' }]}>
                <Input placeholder="Nom de famille" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstName" label="Prénom" rules={[{ required: true, message: 'Prénom requis' }, { min: 2, message: 'Minimum 2 caractères' }]}>
                <Input placeholder="Prénom" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Adresse email" rules={[{ required: true, message: 'Email requis' }, { type: 'email', message: 'Email invalide' }]}>
                <Input placeholder="exemple@email.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Téléphone (optionnel)">
                <Input placeholder="+225 XX XX XX XX XX" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="roleId" label="Rôle" rules={[{ required: true, message: 'Rôle requis' }]}>
                <Select
                  placeholder="Sélectionner un rôle"
                  showSearch
                  optionFilterProp="label"
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isActive" label="Compte actif" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          {editing ? (
            <>
              <Form.Item label="Mot de passe">
                <Switch checked={resetPassword} onChange={onResetPasswordChange} className="mb-2" />
                <span className="ml-2 text-sm text-ds-text-secondary">Réinitialiser le mot de passe</span>
              </Form.Item>
              {resetPassword && (
                <Form.Item name="password" label="Nouveau mot de passe" rules={[{ required: true, message: 'Mot de passe requis' }, ...PASSWORD_RULES]}>
                  <Input.Password placeholder="6 chiffres minimum" inputMode="numeric" maxLength={20} />
                </Form.Item>
              )}
            </>
          ) : (
            <Form.Item name="password" label="Mot de passe" rules={[{ required: true, message: 'Mot de passe requis' }, ...PASSWORD_RULES]}>
              <Input.Password placeholder="6 chiffres minimum" inputMode="numeric" maxLength={20} />
            </Form.Item>
          )}
        </Form>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{editing ? 'Modification en cours…' : 'Nouveau compte personnel'}</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
