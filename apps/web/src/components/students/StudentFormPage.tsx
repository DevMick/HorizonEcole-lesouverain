import {
  Form, Input, Select, Checkbox, Upload, Row, Col, List as AntList, Button as AntButton, Space,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import type { UploadFile } from 'antd/es/upload/interface';
import { UploadOutlined, FilePdfOutlined, FileWordOutlined, FileImageOutlined, FileOutlined } from '@ant-design/icons';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ds';

const API_BASE = 'http://localhost:4001';

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#dc2626', fontSize: 20 }} />;
  if (['doc', 'docx'].includes(ext || '')) return <FileWordOutlined style={{ color: '#2563eb', fontSize: 20 }} />;
  if (['jpg', 'jpeg', 'png'].includes(ext || '')) return <FileImageOutlined style={{ fontSize: 20 }} />;
  return <FileOutlined style={{ fontSize: 20 }} />;
};
const formatDateInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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

export interface StudentFormPageProps {
  form: FormInstance;
  editing: any;
  fileList: UploadFile[];
  onFileListChange: (files: UploadFile[]) => void;
  attachmentsToRemove: string[];
  onRemoveAttachment: (attachment: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Formulaire création/édition élève (§9.3) — page pleine largeur, remplace
 * l'ancienne AntModal « Nouvel élève » : même logique de formulaire (Ant
 * Design, §12.2), habillage de page « Encre & Craie » (en-tête + retour,
 * carte, barre d'actions collante).
 */
export function StudentFormPage(props: StudentFormPageProps) {
  const {
    form, editing, fileList, onFileListChange, attachmentsToRemove, onRemoveAttachment,
    onCancel, onSubmit, submitting,
  } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier l'élève" : 'Nouvel élève'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {editing ? 'Mettez à jour les informations de cet élève.' : "Renseignez les informations pour inscrire un nouvel élève."}
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
            <Col span={12}><Form.Item name="gender" label="Genre" rules={[{ required: true, message: 'Genre requis' }]}><Select placeholder="Sélectionner"><Select.Option value="M">Masculin</Select.Option><Select.Option value="F">Féminin</Select.Option></Select></Form.Item></Col>
            <Col span={12}><Form.Item name="studentNumber" label="Matricule" rules={[{ required: true, message: 'Matricule requis' }]}><Input placeholder="19472697E" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="email" label="Adresse email (optionnel)" rules={[{ type: 'email', message: 'Email invalide' }]}><Input placeholder="exemple@email.com" /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="Contact (optionnel)" initialValue="+225" normalize={(v: string) => formatPhoneInput(v || '')}><Input placeholder="+225 XX XX XX XX XX" maxLength={19} inputMode="tel" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="dateOfBirth" label="Né le" normalize={(v: string) => formatDateInput(v || '')} rules={[{ required: true, message: 'Date de naissance requise' }, { validator: (_, v) => !v || /^\d{2}\/\d{2}\/\d{4}$/.test(v) ? Promise.resolve() : Promise.reject(new Error('Format attendu : JJ/MM/AAAA')) }]}><Input placeholder="JJ/MM/AAAA" maxLength={10} inputMode="numeric" /></Form.Item></Col>
            <Col span={12}><Form.Item name="placeOfBirth" label="Lieu de naissance" rules={[{ required: true, message: 'Lieu de naissance requis' }]}><Input placeholder="Ville de naissance" /></Form.Item></Col>
          </Row>
          <Form.Item name="address" label="Résidence (optionnel)"><Input placeholder="Quartier, ville" /></Form.Item>
          <Form.Item name="isStateAssigned" valuePropName="checked"><Checkbox><strong>Affecté de l'État</strong><span className="ml-2 text-xs text-muted-foreground">(Cocher si l'élève est un affecté de l'état)</span></Checkbox></Form.Item>

          {editing && editing.attachments?.length > 0 && (
            <Form.Item label="Pièces jointes actuelles">
              <AntList size="small" bordered
                dataSource={editing.attachments.filter((a: string) => !attachmentsToRemove.includes(a))}
                renderItem={(attachment: string) => {
                  const filename = attachment.split('/').pop() || 'document';
                  return (
                    <AntList.Item actions={[
                      <AntButton key="view" type="link" size="small" href={`${API_BASE}${attachment}`} target="_blank">Voir</AntButton>,
                      <AntButton key="remove" type="link" danger size="small" onClick={() => onRemoveAttachment(attachment)}>Retirer</AntButton>,
                    ]}><Space>{getFileIcon(filename)}{filename}</Space></AntList.Item>
                  );
                }}
              />
            </Form.Item>
          )}
          <Form.Item label={editing ? 'Ajouter des pièces jointes (optionnel)' : 'Pièces jointes (optionnel)'}>
            <Upload fileList={fileList} onChange={({ fileList }) => onFileListChange(fileList)} beforeUpload={() => false} multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
              <AntButton icon={<UploadOutlined />}>Sélectionner les fichiers</AntButton>
            </Upload>
            <div className="mt-2 text-xs text-muted-foreground">Formats acceptés : PDF, DOC, DOCX, JPG, PNG (10MB max par fichier)</div>
          </Form.Item>
        </Form>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{editing ? 'Modification en cours…' : 'Nouvelle fiche élève'}</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
