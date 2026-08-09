import { useEffect, useState } from 'react';
import { Input, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import { Button, Modal } from '../ds';

export interface EntityField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  colSpan?: 1 | 2;
  disabled?: boolean;
  help?: string;
}

export interface EntityFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: EntityField[];
  initial?: Record<string, any> | null;
  submitLabel?: string;
  submitting?: boolean;
  width?: number;
  onSubmit: (values: Record<string, any>) => void;
}

/**
 * Modale de formulaire générique « Encre & Craie » (§5.8/§5.2) pour l'étape 5.
 * Config par `fields` (texte/nombre/select/zone) : évite de réécrire un
 * formulaire CRUD par module. Validation minimale (requis + longueur mini).
 */
export function EntityFormModal({ open, onClose, title, fields, initial, submitLabel, submitting, width = 520, onSubmit }: EntityFormModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setValues(initial ? { ...initial } : {}); setErrors({}); }
  }, [open, initial]);

  const set = (name: string, v: any) => setValues((s) => ({ ...s, [name]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const raw = values[f.name];
      const val = typeof raw === 'string' ? raw.trim() : raw;
      if (f.required && (val === undefined || val === null || val === '')) { e[f.name] = 'Ce champ est requis.'; continue; }
      if (f.type !== 'select' && f.min && typeof val === 'string' && val.length > 0 && val.length < f.min) e[f.name] = `Minimum ${f.min} caractères.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => { if (validate()) onSubmit(values); };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={width}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={submitting} onClick={submit}>{submitLabel || 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {fields.map((f) => (
          <label key={f.name} className={`ds-field ${f.colSpan === 2 || !f.colSpan ? 'col-span-2' : 'col-span-1'}`}>
            <span>{f.label}{f.required ? ' *' : ''}</span>
            {f.type === 'select' ? (
              <Select
                placeholder={f.placeholder || 'Sélectionner…'}
                value={values[f.name] ?? undefined}
                disabled={f.disabled}
                onChange={(v) => set(f.name, v)}
                options={f.options || []}
                style={{ width: '100%' }}
              />
            ) : f.type === 'textarea' ? (
              <Input.TextArea
                rows={3}
                value={values[f.name] ?? ''}
                disabled={f.disabled}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)}
              />
            ) : f.type === 'date' ? (
              <DatePicker
                value={values[f.name] ? dayjs(values[f.name]) : null}
                disabled={f.disabled}
                placeholder={f.placeholder}
                onChange={(date) => set(f.name, date ? date.format('YYYY-MM-DD') : '')}
                style={{ width: '100%' }}
              />
            ) : (
              <Input
                type={f.type === 'number' ? 'number' : 'text'}
                value={values[f.name] ?? ''}
                disabled={f.disabled}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                onPressEnter={() => submit()}
              />
            )}
            {errors[f.name] ? <span className="ds-field-error">{errors[f.name]}</span> : f.help ? <span className="text-[.72rem] text-ds-text-tertiary">{f.help}</span> : null}
          </label>
        ))}
      </div>
    </Modal>
  );
}
