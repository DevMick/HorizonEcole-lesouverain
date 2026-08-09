import { Input as AntInput } from 'antd';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { Button, Card } from '../ds';
import { cn } from '../../lib/utils';
import { MENU_CATALOG } from '../../lib/navigation/menu-catalog';

const { TextArea } = AntInput;

export interface RoleFormPageProps {
  editing: any;
  name: string;
  onNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  selectedKeys: string[];
  onToggleKey: (key: string) => void;
  onSelectGroup: (groupKeys: string[]) => void;
  onClearGroup: (groupKeys: string[]) => void;
  nameError?: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Formulaire création/édition de rôle personnalisé : nom + description +
 * cases à cocher des menus (reprend le motif ds-check-grid de
 * SubjectAssignmentPage), groupées par section du sidebar.
 */
export function RoleFormPage(props: RoleFormPageProps) {
  const {
    editing, name, onNameChange, description, onDescriptionChange,
    selectedKeys, onToggleKey, onSelectGroup, onClearGroup, nameError,
    onCancel, onSubmit, submitting,
  } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? 'Modifier le rôle' : 'Nouveau rôle'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Choisissez les menus visibles dans le sidebar pour les comptes ayant ce rôle.
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <label className="ds-field mb-3">
          <span>Nom du rôle</span>
          <span className="ds-input-wrap">
            <input className="ds-input" placeholder="Ex. Secrétariat" value={name} onChange={(e) => onNameChange(e.target.value)} />
          </span>
          {nameError && <span className="mt-1 text-xs text-ds-danger">{nameError}</span>}
        </label>
        <label className="ds-field">
          <span>Description (optionnel)</span>
          <TextArea rows={2} placeholder="Rôle destiné à…" value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
        </label>
      </Card>

      {MENU_CATALOG.map((group) => {
        const groupKeys = group.items.map((i) => i.key);
        const selectedInGroup = groupKeys.filter((k) => selectedKeys.includes(k)).length;
        return (
          <Card key={group.key} className="mb-4">
            <div className="mb-3 flex items-center justify-between">
              <strong className="font-display text-ds-text">{group.label}</strong>
              <span className="flex items-center gap-2">
                <span className="ds-badge ds-badge-role">{selectedInGroup} / {group.items.length}</span>
                <Button variant="ghost" size="sm" onClick={() => onSelectGroup(groupKeys)}>Tout</Button>
                <Button variant="ghost" size="sm" onClick={() => onClearGroup(groupKeys)}>Aucune</Button>
              </span>
            </div>
            <div className="ds-check-grid">
              {group.items.map((item) => {
                const on = selectedKeys.includes(item.key);
                return (
                  <label key={item.key} className={cn('ds-check', on && 'ds-check-on')}>
                    <input type="checkbox" checked={on} onChange={() => onToggleKey(item.key)} />
                    <Shield width={16} height={16} aria-hidden />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        );
      })}

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{selectedKeys.length} menu(s) sélectionné(s)</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button icon={<Save aria-hidden />} loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
