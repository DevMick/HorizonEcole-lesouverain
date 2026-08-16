import {
  Form, DatePicker, Row, Col,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ds';

export interface AcademicYearFormPageProps {
  form: FormInstance;
  editing: any;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Formulaire création/édition année scolaire — page pleine largeur, même logique
 * que TeacherFormPage : formulaire Ant Design, habillage de page « Encre & Craie »
 * (en-tête + retour, carte, barre d'actions collante).
 *
 * Le nom affiché (ex. « 2025-2026 ») n'est pas saisi à la main : il est généré
 * automatiquement, à l'enregistrement, à partir de l'année de début et de
 * l'année de fin (sélection d'année seule, pas de date complète).
 */
export function AcademicYearFormPage(props: AcademicYearFormPageProps) {
  const {
    form, editing, onCancel, onSubmit, submitting,
  } = props;

  const startYear = Form.useWatch('startYear', form);
  const endYear = Form.useWatch('endYear', form);
  const previewName = startYear && endYear ? `${startYear.year()}-${endYear.year()}` : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier l'année scolaire" : 'Nouvelle année scolaire'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {editing
              ? "Mettez à jour l'année de début et l'année de fin de cette année scolaire."
              : 'Sélectionnez l\'année de début et l\'année de fin : le nom (ex. « 2025-2026 ») sera généré automatiquement.'}
          </p>
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startYear"
                label="Année de début"
                rules={[{ required: true, message: 'Année de début requise' }]}
              >
                <DatePicker
                  picker="year"
                  placeholder="Ex : 2025"
                  style={{ width: '100%' }}
                  placement="bottomLeft"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endYear"
                label="Année de fin"
                rules={[{ required: true, message: 'Année de fin requise' }]}
              >
                <DatePicker
                  picker="year"
                  placeholder="Ex : 2026"
                  style={{ width: '100%' }}
                  placement="bottomLeft"
                />
              </Form.Item>
            </Col>
          </Row>
          <p className="text-sm text-ds-text-tertiary">
            Nom généré automatiquement : <strong className="font-mono text-ds-text">{previewName || '—'}</strong>
          </p>
        </Form>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{editing ? 'Modification en cours…' : 'Nouvelle fiche année scolaire'}</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
