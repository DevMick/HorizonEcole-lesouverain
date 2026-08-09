import {
  Form, Input, Row, Col,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ds';

export interface SchoolSubjectFormPageProps {
  form: FormInstance;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Formulaire création matière — page pleine largeur, même logique
 * que ClassroomFormPage : formulaire Ant Design, habillage de page « Encre & Craie »
 * (en-tête + retour, carte, barre d'actions collante).
 */
export function SchoolSubjectFormPage(props: SchoolSubjectFormPageProps) {
  const {
    form, onCancel, onSubmit, submitting,
  } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            Nouvelle matière
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Renseignez les informations pour ajouter une nouvelle matière.
          </p>
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="Nom de la matière"
                rules={[{ required: true, message: 'Nom requis' }, { min: 2, message: 'Minimum 2 caractères' }]}
              >
                <Input placeholder="Ex : Mathématiques, Français, Anglais…" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="code"
                label="Code"
                rules={[
                  { required: true, message: 'Code requis' },
                  { pattern: /^[A-Za-z0-9]{2,10}$/, message: '2 à 10 caractères alphanumériques' },
                ]}
                normalize={(value) => (typeof value === 'string' ? value.toUpperCase() : value)}
              >
                <Input placeholder="Ex : ANG, MATH, EPS…" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">Nouvelle fiche matière</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>Enregistrer</Button>
      </div>
    </div>
  );
}
