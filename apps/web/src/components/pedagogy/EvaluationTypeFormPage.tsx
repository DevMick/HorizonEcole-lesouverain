import { useEffect, useState } from 'react';
import {
  Form, InputNumber, Select, Row, Col,
} from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button, Card, Field, Input, Modal } from '../ds';

/** Noms de types d'évaluation proposés par défaut dans le select. */
export const DEFAULT_EVALUATION_TYPE_NAMES = [
  'DEVOIR',
  'INTERROGATION',
  'DEVOIR DE NIVEAU',
  'EXAMEN BLANC',
] as const;

export interface EvalTypeLite { name: string; number?: number | null }

/** Une option du select « Coefficient » (défaut applicatif ou créée par l'enseignant). */
export interface CoefficientOption {
  id: string | null;
  value: number;
  label: string;
  isDefault: boolean;
}

/** Options de repli tant que l'API n'a pas répondu : les deux coefficients par défaut. */
export const DEFAULT_COEFFICIENT_OPTIONS: CoefficientOption[] = [
  { id: null, value: 1, label: '1 (normal)', isDefault: true },
  { id: null, value: 2, label: '2 (coefficientée ×2)', isDefault: true },
];

export interface EvaluationTypeFormPageProps {
  form: FormInstance;
  editing: any;
  /** Types existants (déjà filtrés par classe/matière) — sert à calculer le prochain numéro par nom. */
  existingTypes?: EvalTypeLite[];
  /** Contexte du type : « Classe · MATIÈRE · Année » (affiché sous le titre). */
  scopeLabel?: string;
  /** Coefficients proposés : les 2 défauts + ceux créés par l'enseignant. */
  coefficientOptions?: CoefficientOption[];
  /** Création d'un coefficient personnalisé (bouton « + »). Doit résoudre à la valeur créée. */
  onAddCoefficient?: (value: number) => Promise<number | void>;
  addingCoefficient?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/** Prochain numéro (séquentiel par nom) pour l'enseignant. */
export function nextNumberForName(types: EvalTypeLite[], name?: string): number {
  if (!name) return 1;
  const max = types
    .filter((t) => t.name === name)
    .reduce((m, t) => Math.max(m, t.number ?? 0), 0);
  return max + 1;
}

/**
 * Formulaire création/édition type d'évaluation — page pleine largeur « Encre & Craie ».
 * Le type porte désormais tout le paramétrage d'une colonne de notes : nom, numéro
 * (auto, par nom), barème « Note sur » (10/20) et coefficient (1 ou 2). Ces réglages
 * sont réutilisés tels quels sur la page de saisie des notes.
 */
export function EvaluationTypeFormPage(props: EvaluationTypeFormPageProps) {
  const {
    form, editing, existingTypes = [], scopeLabel, onCancel, onSubmit, submitting,
    coefficientOptions = DEFAULT_COEFFICIENT_OPTIONS, onAddCoefficient, addingCoefficient,
  } = props;

  // Modale « Nouveau coefficient » ouverte par le bouton « + » du champ Coefficient.
  const [coefModalOpen, setCoefModalOpen] = useState(false);
  const [newCoefValue, setNewCoefValue] = useState('');
  const [coefError, setCoefError] = useState<string | null>(null);

  const openCoefModal = () => {
    setNewCoefValue('');
    setCoefError(null);
    setCoefModalOpen(true);
  };

  const submitNewCoefficient = async () => {
    const value = Number(newCoefValue);
    if (!newCoefValue.trim() || !Number.isInteger(value)) {
      setCoefError('Saisissez un nombre entier.');
      return;
    }
    if (value < 1 || value > 20) {
      setCoefError('Le coefficient doit être compris entre 1 et 20.');
      return;
    }
    if (coefficientOptions.some((o) => o.value === value)) {
      setCoefError(`Le coefficient ${value} est déjà proposé.`);
      return;
    }
    setCoefError(null);
    try {
      await onAddCoefficient?.(value);
      // Le nouveau coefficient devient la valeur sélectionnée du formulaire.
      form.setFieldsValue({ coefficient: value });
      setCoefModalOpen(false);
    } catch (e: any) {
      setCoefError(e?.response?.data?.error || 'Impossible de créer ce coefficient.');
    }
  };

  // Le select propose les noms par défaut ; en édition, on injecte le nom
  // existant s'il ne fait pas partie de la liste, pour ne pas le perdre.
  const nameOptions = [...DEFAULT_EVALUATION_TYPE_NAMES] as string[];
  if (editing?.name && !nameOptions.includes(editing.name)) {
    nameOptions.unshift(editing.name);
  }

  // Numéro : auto et grisé. En création il suit le nom choisi (prochain numéro
  // pour ce nom) ; en édition on garde le numéro existant du type.
  const watchedName = Form.useWatch('name', form);
  useEffect(() => {
    if (editing) return; // en édition, le numéro reste figé
    form.setFieldsValue({ number: nextNumberForName(existingTypes, watchedName) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName, editing]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            {editing ? "Modifier le type d'évaluation" : 'Nouveau type d\'évaluation'}
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {editing
              ? "Modifiez le nom, le barème et le coefficient de ce type d'évaluation."
              : 'Créez un type d\'évaluation (devoir, interrogation…) : nom, barème « Note sur » et coefficient. Ce paramétrage crée automatiquement la colonne correspondante dans la saisie des notes.'}
          </p>
          {scopeLabel && (
            <p className="mt-1 text-[.8rem] font-semibold text-role-accent">{scopeLabel}</p>
          )}
        </div>
      </div>

      <Card>
        <Form form={form} layout="vertical" preserve={false} initialValues={{ coefficient: 1, maxNote: 20 }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label="Nom du type d'évaluation"
                rules={[{ required: true, message: 'Nom requis' }]}
              >
                <Select
                  placeholder="Sélectionner un type…"
                  showSearch
                  optionFilterProp="label"
                  options={nameOptions.map((n) => ({ value: n, label: n }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="number"
                label="Numéro"
                tooltip="Attribué automatiquement (séquentiel par nom : Devoir N°1, N°2…)."
              >
                <InputNumber disabled style={{ width: '100%' }} placeholder="—" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maxNote"
                label="Note sur (barème)"
                rules={[{ required: true, message: 'Barème requis' }]}
                tooltip="Barème de saisie de la note. Toutes les notes sont ramenées sur /20 pour la moyenne."
              >
                <Select
                  options={[
                    { value: 20, label: '20' },
                    { value: 10, label: '10' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Coefficient"
                tooltip="1 = la note compte une fois. 2 = la note compte double (ex. 9/10 coefficienté → 18/20). Le bouton « + » permet de créer vos propres coefficients."
              >
                {/* Le select porte la valeur du formulaire (noStyle) ; le bouton
                    « + » vit à côté, dans le même champ. */}
                <div className="flex items-center gap-2">
                  <Form.Item name="coefficient" noStyle>
                    <Select
                      className="flex-1"
                      options={coefficientOptions.map((o) => ({ value: o.value, label: o.label }))}
                      // Raccourci également proposé au bas du menu déroulant.
                      dropdownRender={(menu) => (
                        <>
                          {menu}
                          <div className="border-t border-ds-border p-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              block
                              icon={<Plus aria-hidden />}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={openCoefModal}
                            >
                              Nouveau coefficient
                            </Button>
                          </div>
                        </>
                      )}
                    />
                  </Form.Item>
                  <Button
                    variant="outline"
                    iconOnly
                    icon={<Plus aria-hidden />}
                    onClick={openCoefModal}
                    aria-label="Créer un nouveau coefficient"
                    title="Créer un nouveau coefficient"
                  />
                </div>
              </Form.Item>
            </Col>
          </Row>
          <p className="text-sm text-ds-text-tertiary">
            Le coefficient pondère la note dans la moyenne de la matière : une note à coefficient 2 compte
            comme deux notes. Le barème (10 ou 20) ne sert qu'à normaliser la note sur /20.
            Les coefficients 1 et 2 sont toujours proposés ; ceux que vous créez avec « + » vous sont propres
            et s'ajoutent à la liste.
          </p>
        </Form>
      </Card>

      <Modal
        open={coefModalOpen}
        onClose={() => setCoefModalOpen(false)}
        title="Nouveau coefficient"
        width={420}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCoefModalOpen(false)}>Annuler</Button>
            <Button loading={addingCoefficient} onClick={submitNewCoefficient}>Créer</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ds-text-secondary">
            Créez un coefficient qui vous est propre. Il s'ajoutera à la liste sans remplacer les
            coefficients 1 et 2, toujours proposés.
          </p>
          <Field
            label="Valeur du coefficient"
            htmlFor="new-coefficient-value"
            error={coefError || undefined}
            hint="Nombre entier entre 1 et 20."
          >
            <Input
              id="new-coefficient-value"
              type="number"
              min={1}
              max={20}
              step={1}
              value={newCoefValue}
              onChange={(e) => { setNewCoefValue(e.target.value); setCoefError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewCoefficient(); }}
              placeholder="Ex. 3"
              autoFocus
              error={!!coefError}
            />
          </Field>
        </div>
      </Modal>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">{editing ? 'Modification en cours…' : 'Nouvelle fiche type d\'évaluation'}</span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} onClick={onSubmit}>{editing ? 'Mettre à jour' : 'Enregistrer'}</Button>
      </div>
    </div>
  );
}
