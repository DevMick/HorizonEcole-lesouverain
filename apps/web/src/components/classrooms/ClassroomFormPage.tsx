import {
  Form, Input, Row, Col,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ds';

export interface ClassroomFormPageProps {
  form: FormInstance;
  editing: any;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Formulaire création/édition salle de classe — page pleine largeur, même logique
 * que TeacherFormPage : formulaire Ant Design, habillage de page « Encre & Craie »
 * (en-tête + retour, carte, barre d'actions collante).
 */
export function ClassroomFormPage(props: ClassroomFormPageProps) {
  const {
    form, editing, onCancel, onSubmit, submitting,
  } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier la salle" : 'Nouvelle salle'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {editing ? 'Mettez à jour les informations de cette salle.' : "Renseignez les informations pour ajouter une nouvelle salle."}
          </p>
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                name="name" 
                label="Nom de la salle" 
                rules={[{ required: true, message: 'Nom requis' }, { min: 2, message: 'Minimum 2 caractères' }]}
              >
                <Input placeholder="Ex : Salle A1, Labo 2…" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{editing ? 'Modification en cours…' : 'Nouvelle fiche salle'}</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
