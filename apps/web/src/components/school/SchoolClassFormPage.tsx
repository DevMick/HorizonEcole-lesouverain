import {
  Form, Input, Row, Col,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ds';

export interface SchoolClassFormPageProps {
  form: FormInstance;
  editing: any;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Édition d'une classe — page pleine largeur (renommer une classe). La
 * création se fait exclusivement via le générateur de divisions par niveau
 * (ClassGeneratorPage), donc ce formulaire ne sert plus qu'à l'édition.
 */
export function SchoolClassFormPage(props: SchoolClassFormPageProps) {
  const { form, editing, onCancel, onSubmit, submitting } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier la classe" : 'Nouvelle classe'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Mettez à jour les informations de cette classe.
          </p>
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="Nom de la classe"
                rules={[{ required: true, message: 'Nom requis' }, { min: 2, message: 'Minimum 2 caractères' }]}
              >
                <Input placeholder="Ex : 6ème A, 5ème B, Terminale C…" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">Modification en cours…</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>Mettre à jour</Button>
      </div>
    </div>
  );
}
