import {
  Form, Select, DatePicker, Row, Col,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import dayjs from 'dayjs';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ds';
import { DATE_FORMAT } from '../../lib/antd-popup';

/** Une année scolaire compte 3 trimestres — liste fixe plutôt que saisie libre. */
export const SEMESTER_NAME_OPTIONS = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'];

export interface SemesterFormPageProps {
  form: FormInstance;
  editing: any;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  /** Noms déjà utilisés par d'autres trimestres de cette année (à exclure du select). */
  usedNames?: string[];
}

/**
 * Formulaire création/édition trimestre — page pleine largeur, même logique
 * que AcademicYearFormPage : formulaire Ant Design, habillage de page « Encre & Craie »
 * (en-tête + retour, carte, barre d'actions collante).
 */
export function SemesterFormPage(props: SemesterFormPageProps) {
  const {
    form, editing, onCancel, onSubmit, submitting, usedNames = [],
  } = props;

  // Exclut les noms déjà pris par d'autres trimestres de l'année ; garde
  // toujours la valeur courante en édition (même si le libellé est un
  // ancien nom saisi librement, avant l'introduction de cette liste).
  const nameOptions = (() => {
    const available = SEMESTER_NAME_OPTIONS.filter((n) => n === editing?.name || !usedNames.includes(n));
    if (editing?.name && !available.includes(editing.name)) available.unshift(editing.name);
    return available.map((n) => ({ value: n, label: n }));
  })();

  return (
    // Marge basse volontairement généreuse : les deux derniers champs sont des
    // dates, et le calendrier fait ~350px. Sans cette réserve, antd manque de
    // place sous le champ, bascule le panneau vers le haut et recouvre tout le
    // formulaire. La barre d'actions étant collante, cet espace ne se voit pas.
    <div className="mx-auto max-w-3xl pb-[380px]">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier le trimestre" : 'Nouveau trimestre'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {editing ? 'Mettez à jour les informations de ce trimestre.' : "Renseignez les informations pour ajouter un nouveau trimestre."}
          </p>
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="Nom du trimestre"
                rules={[{ required: true, message: 'Nom requis' }]}
              >
                <Select
                  placeholder="Sélectionner un trimestre…"
                  options={nameOptions}
                  notFoundContent="Les 3 trimestres de cette année sont déjà créés."
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="startDate" 
                label="Date de début" 
                rules={[{ required: true, message: 'Date de début requise' }]}
              >
                <DatePicker
                  placeholder="Date de début"
                  style={{ width: '100%' }}
                  format={DATE_FORMAT}
                  placement="bottomLeft"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="endDate" 
                label="Date de fin" 
                rules={[{ required: true, message: 'Date de fin requise' }]}
              >
                <DatePicker
                  placeholder="Date de fin"
                  style={{ width: '100%' }}
                  format={DATE_FORMAT}
                  placement="bottomLeft"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{editing ? 'Modification en cours…' : 'Nouvelle fiche trimestre'}</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
