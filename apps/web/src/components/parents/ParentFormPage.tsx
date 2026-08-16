import {
  Form, Input, Select, Checkbox, Upload, Row, Col, List as AntList, Button as AntButton, Space,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import type { UploadFile } from 'antd/es/upload/interface';
import { UploadOutlined, FilePdfOutlined, FileWordOutlined, FileImageOutlined, FileOutlined } from '@ant-design/icons';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button, Card } from '../ds';

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#dc2626', fontSize: 20 }} />;
  if (['doc', 'docx'].includes(ext || '')) return <FileWordOutlined style={{ color: '#2563eb', fontSize: 20 }} />;
  if (['jpg', 'jpeg', 'png'].includes(ext || '')) return <FileImageOutlined style={{ fontSize: 20 }} />;
  return <FileOutlined style={{ fontSize: 20 }} />;
};

const formatPhoneInput = (value: string): string => {
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, '');
  
  // Remove the country code 225 if it's at the start
  if (digits.startsWith('225')) {
    digits = digits.slice(3);
  }
  
  // Limit to 10 digits (after country code)
  digits = digits.slice(0, 10);
  
  // If no digits, return just the country code
  if (digits.length === 0) {
    return '+225';
  }
  
  // Build the formatted string
  let formatted = '+225';
  
  // Add first group (2 digits)
  formatted += ' ' + digits.slice(0, 2);
  
  // Add subsequent groups if they exist
  if (digits.length > 2) {
    formatted += ' ' + digits.slice(2, 4);
  }
  if (digits.length > 4) {
    formatted += ' ' + digits.slice(4, 6);
  }
  if (digits.length > 6) {
    formatted += ' ' + digits.slice(6, 8);
  }
  if (digits.length > 8) {
    formatted += ' ' + digits.slice(8, 10);
  }
  
  return formatted;
};

export interface StudentOption { id: string; label: string }
export interface LinkedStudent { studentId: string; name: string; studentNumber?: string; className?: string; relation: string }

export interface ParentFormPageProps {
  form: FormInstance;
  editing: any;
  fileList: UploadFile[];
  onFileListChange: (files: UploadFile[]) => void;
  attachmentsToRemove: string[];
  onRemoveAttachment: (attachment: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  studentOptions?: StudentOption[];
  studentsLoading?: boolean;
  selectedStudentIds?: string[];
  onSelectedStudentsChange?: (ids: string[]) => void;
  linkedStudents?: LinkedStudent[];
  onDissociate?: (studentId: string) => void;
  dissociatingId?: string | null;
}

/**
 * Formulaire création/édition parent — page pleine largeur, similaire à StudentFormPage
 */
const RELATION_OPTIONS = [
  { value: 'PERE', label: 'Père' },
  { value: 'MERE', label: 'Mère' },
  { value: 'TUTEUR', label: 'Tuteur' },
  { value: 'AUTRE', label: 'Autre' },
];
const RELATION_LABEL: Record<string, string> = { PERE: 'Père', MERE: 'Mère', TUTEUR: 'Tuteur', AUTRE: 'Autre' };

export function ParentFormPage(props: ParentFormPageProps) {
  const {
    form, editing, fileList, onFileListChange, attachmentsToRemove, onRemoveAttachment,
    onCancel, onSubmit, submitting,
    studentOptions = [], studentsLoading, selectedStudentIds = [], onSelectedStudentsChange,
    linkedStudents = [], onDissociate, dissociatingId,
  } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier le parent" : 'Nouveau parent'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {editing ? 'Mettez à jour les informations de ce parent.' : "Renseignez les informations pour ajouter un nouveau parent."}
          </p>
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="lastName" label="Nom" rules={[{ required: true, message: 'Nom requis' }, { min: 2, message: 'Minimum 2 caractères' }]}><Input placeholder="Nom de famille" /></Form.Item></Col>
            <Col span={12}><Form.Item name="firstName" label="Prénom" rules={[{ required: true, message: 'Prénom requis' }, { min: 2, message: 'Minimum 2 caractères' }]}><Input placeholder="Prénom" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="phone" label="Contact" rules={[{ required: true, message: 'Contact requis' }]} initialValue="+225" normalize={(v: string) => formatPhoneInput(v || '')}><Input placeholder="+225 XX XX XX XX XX" maxLength={19} inputMode="tel" /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="Adresse email (optionnel)" rules={[{ type: 'email', message: 'Email invalide' }]}><Input placeholder="exemple@email.com" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="relation" label="Relation" rules={[{ required: true, message: 'Relation requise' }]}>
                <Select placeholder="Sélectionner" options={RELATION_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card className="mt-4">
        <p className="mb-1 font-display text-[.96rem] font-bold text-ds-text">Élèves rattachés</p>
        <p className="mb-3 text-[.82rem] text-ds-text-secondary">
          {editing
            ? 'Dissociez un élève ou ajoutez-en de nouveaux (enregistré à la mise à jour).'
            : "Sélectionnez les élèves dont ce parent s'occupe (optionnel)."}
        </p>

        {editing && linkedStudents.length > 0 && (
          <ul className="ds-detail-list mb-3">
            {linkedStudents.map((s) => (
              <li key={s.studentId} className="ds-parent-row">
                <span className="min-w-0">
                  <strong className="block truncate text-[.86rem] text-ds-text">{s.name}</strong>
                  <span className="font-mono text-[.74rem] text-ds-text-tertiary">{s.studentNumber || '—'}</span>
                </span>
                {s.className && <span className="ds-badge ds-badge-role">{s.className}</span>}
                <span className="ds-badge ds-badge-neutral">{RELATION_LABEL[s.relation] || s.relation}</span>
                <Button
                  variant="ghost" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label="Dissocier"
                  loading={dissociatingId === s.studentId}
                  onClick={() => onDissociate?.(s.studentId)}
                />
              </li>
            ))}
          </ul>
        )}

        <label className="ds-field">
          <span>Ajouter des élèves</span>
          <Select
            mode="multiple"
            placeholder="Rechercher un élève…"
            showSearch
            optionFilterProp="label"
            loading={studentsLoading}
            value={selectedStudentIds}
            onChange={(ids) => onSelectedStudentsChange?.(ids)}
            options={studentOptions.map((s) => ({ value: s.id, label: s.label }))}
            style={{ width: '100%' }}
          />
        </label>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{editing ? 'Modification en cours…' : 'Nouvelle fiche parent'}</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
