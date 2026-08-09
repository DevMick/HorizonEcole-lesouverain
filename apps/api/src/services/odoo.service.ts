/**
 * Synchronisation des contacts "Parents d'élève" vers Odoo (module Contacts /
 * CRM), via l'API JSON-RPC exposée nativement par Odoo (endpoint /jsonrpc).
 *
 * Best-effort : toute erreur (Odoo éteint, identifiants invalides, etc.) est
 * capturée par l'appelant et ne doit jamais faire échouer la création/mise à
 * jour d'un parent côté application école.
 */

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

function getOdooConfig(): OdooConfig | null {
  const url = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const username = process.env.ODOO_USERNAME;
  const password = process.env.ODOO_PASSWORD;

  if (!url || !db || !username || !password) {
    return null;
  }
  return { url, db, username, password };
}

let cachedUid: number | null = null;

async function jsonRpcCall<T>(url: string, service: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch(`${url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { service, method, args },
      id: Math.floor(Math.random() * 1_000_000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo JSON-RPC HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    result?: T;
    error?: { message?: string; data?: { message?: string } };
  };
  if (json.error) {
    const message = json.error.data?.message || json.error.message || 'Erreur Odoo inconnue';
    throw new Error(`Odoo JSON-RPC: ${message}`);
  }
  return json.result as T;
}

async function authenticate(config: OdooConfig): Promise<number> {
  if (cachedUid !== null) return cachedUid;

  const uid = await jsonRpcCall<number | false>(config.url, 'common', 'authenticate', [
    config.db,
    config.username,
    config.password,
    {},
  ]);

  if (!uid) {
    throw new Error('Authentification Odoo refusée (identifiants invalides ?)');
  }
  cachedUid = uid;
  return uid;
}

async function executeKw<T>(config: OdooConfig, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<T> {
  const uid = await authenticate(config);
  return jsonRpcCall<T>(config.url, 'object', 'execute_kw', [
    config.db,
    uid,
    config.password,
    model,
    method,
    args,
    kwargs,
  ]);
}

/** Retente une fois après ré-authentification si le uid mis en cache a expiré. */
async function executeKwWithRetry<T>(config: OdooConfig, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<T> {
  try {
    return await executeKw<T>(config, model, method, args, kwargs);
  } catch (err) {
    cachedUid = null;
    return executeKw<T>(config, model, method, args, kwargs);
  }
}

export interface ParentForOdoo {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  relation: string;
  odooPartnerId?: number | null;
  children?: Array<{ id: string; firstName: string; lastName: string; className?: string | null }>;
}

const PARENT_TAG_NAME = "Parents d'élève";
let cachedParentTagId: number | null = null;

async function getParentTagId(config: OdooConfig): Promise<number | null> {
  if (cachedParentTagId !== null) return cachedParentTagId;

  const existing = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'res.partner.category',
    'search_read',
    [[['name', '=', PARENT_TAG_NAME]]],
    { fields: ['id'], limit: 1 }
  );

  if (existing.length > 0) {
    cachedParentTagId = existing[0].id;
    return cachedParentTagId;
  }

  const newId = await executeKwWithRetry<number>(config, 'res.partner.category', 'create', [
    { name: PARENT_TAG_NAME },
  ]);
  cachedParentTagId = newId;
  return newId;
}

function buildComment(parent: ParentForOdoo): string {
  return `Relation : ${parent.relation}`;
}

/**
 * Commandes One2many pour `csl_child_ids` : on vide la liste (5, 0, 0) puis on
 * réinjecte les enfants à jour, ce qui rend la synchronisation idempotente
 * (ajouts/retraits d'enfants côté app école sans doublons côté Odoo).
 */
function buildChildCommands(parent: ParentForOdoo): unknown[] {
  const commands: unknown[] = [[5, 0, 0]];
  for (const child of parent.children || []) {
    commands.push([0, 0, {
      external_student_id: child.id,
      name: `${child.firstName} ${child.lastName}`.trim(),
      class_name: child.className || false,
    }]);
  }
  return commands;
}

/**
 * Crée ou met à jour le contact Odoo (res.partner) correspondant à un parent.
 * Résolution des doublons, dans l'ordre : odoo_partner_id connu > email > téléphone.
 * Retourne l'id du partner Odoo (à conserver dans parents.odoo_partner_id).
 */
export async function syncParentToOdoo(parent: ParentForOdoo): Promise<number | null> {
  const config = getOdooConfig();
  if (!config) return null; // Intégration non configurée (dev sans Odoo, prod, etc.)

  const values: Record<string, unknown> = {
    name: `${parent.firstName} ${parent.lastName}`.trim(),
    phone: parent.phone || false,
    email: parent.email || false,
    comment: buildComment(parent),
    // customer_rank > 0 fait apparaître le contact dans le menu CRM > Ventes >
    // Clients, qui filtre par défaut dessus (sinon les parents restent
    // invisibles tant qu'on ne retire pas ce filtre à la main).
    customer_rank: 1,
    csl_child_ids: buildChildCommands(parent),
  };

  const tagId = await getParentTagId(config);
  if (tagId) {
    values.category_id = [[4, tagId]]; // (4, id) = ajouter le tag sans retirer les existants
  }

  // 1) id déjà connu : on vérifie qu'il existe toujours avant d'écrire dessus.
  if (parent.odooPartnerId) {
    const stillExists = await executeKwWithRetry<Array<{ id: number }>>(
      config,
      'res.partner',
      'search_read',
      [[['id', '=', parent.odooPartnerId]]],
      { fields: ['id'], limit: 1 }
    );
    if (stillExists.length > 0) {
      await executeKwWithRetry(config, 'res.partner', 'write', [[parent.odooPartnerId], values]);
      return parent.odooPartnerId;
    }
  }

  // 2) recherche par email puis téléphone pour éviter les doublons.
  const domain: unknown[] = [];
  if (parent.email) domain.push(['email', '=', parent.email]);
  if (parent.phone) domain.push(['phone', '=', parent.phone]);

  let found: Array<{ id: number }> = [];
  if (domain.length > 0) {
    found = await executeKwWithRetry<Array<{ id: number }>>(
      config,
      'res.partner',
      'search_read',
      [domain.length > 1 ? ['|', ...domain] : domain],
      { fields: ['id'], limit: 1 }
    );
  }

  if (found.length > 0) {
    await executeKwWithRetry(config, 'res.partner', 'write', [[found[0].id], values]);
    return found[0].id;
  }

  // 3) aucun contact trouvé : création.
  const newId = await executeKwWithRetry<number>(config, 'res.partner', 'create', [values]);
  return newId;
}

export interface TeacherForOdoo {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  contractType: string;
  hireDate?: string | Date | null;
  specialties?: string | null;
  qualifications?: string | null;
  odooPartnerId?: number | null;
}

const TEACHER_TAG_NAME = 'Enseignants';
let cachedTeacherTagId: number | null = null;

async function getTeacherTagId(config: OdooConfig): Promise<number | null> {
  if (cachedTeacherTagId !== null) return cachedTeacherTagId;

  const existing = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'res.partner.category',
    'search_read',
    [[['name', '=', TEACHER_TAG_NAME]]],
    { fields: ['id'], limit: 1 }
  );

  if (existing.length > 0) {
    cachedTeacherTagId = existing[0].id;
    return cachedTeacherTagId;
  }

  const newId = await executeKwWithRetry<number>(config, 'res.partner.category', 'create', [
    { name: TEACHER_TAG_NAME },
  ]);
  cachedTeacherTagId = newId;
  return newId;
}

function formatHireDate(hireDate?: string | Date | null): string | null {
  if (!hireDate) return null;
  const date = typeof hireDate === 'string' ? new Date(hireDate) : hireDate;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildTeacherComment(teacher: TeacherForOdoo): string {
  const lines = [`Type de contrat : ${teacher.contractType}`];
  const hireDate = formatHireDate(teacher.hireDate);
  if (hireDate) lines.push(`Date d'embauche : ${hireDate}`);
  if (teacher.qualifications) lines.push(`Qualifications : ${teacher.qualifications}`);
  return lines.join('\n');
}

/**
 * Crée ou met à jour le contact Odoo (res.partner) correspondant à un
 * enseignant. Même logique de résolution des doublons que pour les parents :
 * odoo_partner_id connu > email > téléphone.
 * Retourne l'id du partner Odoo (à conserver dans teachers.odoo_partner_id).
 */
export async function syncTeacherToOdoo(teacher: TeacherForOdoo): Promise<number | null> {
  const config = getOdooConfig();
  if (!config) return null;

  const values: Record<string, unknown> = {
    name: `${teacher.firstName} ${teacher.lastName}`.trim(),
    phone: teacher.phone || false,
    email: teacher.email || false,
    function: teacher.specialties || false,
    comment: buildTeacherComment(teacher),
  };

  const tagId = await getTeacherTagId(config);
  if (tagId) {
    values.category_id = [[4, tagId]];
  }

  if (teacher.odooPartnerId) {
    const stillExists = await executeKwWithRetry<Array<{ id: number }>>(
      config,
      'res.partner',
      'search_read',
      [[['id', '=', teacher.odooPartnerId]]],
      { fields: ['id'], limit: 1 }
    );
    if (stillExists.length > 0) {
      await executeKwWithRetry(config, 'res.partner', 'write', [[teacher.odooPartnerId], values]);
      return teacher.odooPartnerId;
    }
  }

  const domain: unknown[] = [];
  if (teacher.email) domain.push(['email', '=', teacher.email]);
  if (teacher.phone) domain.push(['phone', '=', teacher.phone]);

  let found: Array<{ id: number }> = [];
  if (domain.length > 0) {
    found = await executeKwWithRetry<Array<{ id: number }>>(
      config,
      'res.partner',
      'search_read',
      [domain.length > 1 ? ['|', ...domain] : domain],
      { fields: ['id'], limit: 1 }
    );
  }

  if (found.length > 0) {
    await executeKwWithRetry(config, 'res.partner', 'write', [[found[0].id], values]);
    return found[0].id;
  }

  const newId = await executeKwWithRetry<number>(config, 'res.partner', 'create', [values]);
  return newId;
}

export interface SchoolClassForOdoo {
  id: string;
  name: string;
}

/**
 * Déduit le niveau (« 6ème », « 5ème »...) à partir du nom d'une classe
 * (« 6ème 1 », « 6ème 2 »...) en retirant le numéro de section final. Les
 * produits sont affectés au niveau, pas à la classe : toutes les sections
 * d'un même niveau héritent donc automatiquement des mêmes produits.
 */
function deriveLevelName(className: string): string {
  const match = className.match(/^(.*?)\s*\d+\s*$/);
  return (match ? match[1] : className).trim();
}

/**
 * Crée ou met à jour la classe (`csl.school.class`) correspondante dans Odoo,
 * ainsi que son niveau (`csl.school.level`) si nécessaire. Résolution des
 * doublons via `external_class_id` (id de la classe côté app école), qui ne
 * change jamais contrairement au nom.
 * Retourne l'id Odoo de la classe (informatif ; non persisté côté app école,
 * la résolution se refait par `external_class_id` à chaque synchronisation).
 */
export async function syncClassToOdoo(schoolClass: SchoolClassForOdoo): Promise<number | null> {
  const config = getOdooConfig();
  if (!config) return null;

  const levelName = deriveLevelName(schoolClass.name);

  const existingLevel = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'csl.school.level',
    'search_read',
    [[['name', '=', levelName]]],
    { fields: ['id'], limit: 1 }
  );
  const levelId = existingLevel.length > 0
    ? existingLevel[0].id
    : await executeKwWithRetry<number>(config, 'csl.school.level', 'create', [{ name: levelName }]);

  const values: Record<string, unknown> = { name: schoolClass.name, level_id: levelId };

  const existingClass = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'csl.school.class',
    'search_read',
    [[['external_class_id', '=', schoolClass.id]]],
    { fields: ['id'], limit: 1 }
  );

  if (existingClass.length > 0) {
    await executeKwWithRetry(config, 'csl.school.class', 'write', [[existingClass[0].id], values]);
    return existingClass[0].id;
  }

  const newId = await executeKwWithRetry<number>(config, 'csl.school.class', 'create', [
    { ...values, external_class_id: schoolClass.id },
  ]);
  return newId;
}

export interface AcademicYearForOdoo {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
}

/**
 * Crée ou met à jour l'année scolaire (`csl.school.year`) correspondante dans
 * Odoo. Résolution des doublons via `external_year_id` (id de l'année côté
 * app école, ne change jamais contrairement au nom). Si `isCurrent` est vrai,
 * Odoo garantit lui-même qu'une seule année reste marquée « en cours » (voir
 * `CslSchoolYear._make_current`), donc marquer une nouvelle année courante
 * démarque automatiquement l'ancienne côté Odoo.
 * Retourne l'id Odoo de l'année (informatif ; non persisté côté app école, la
 * résolution se refait par `external_year_id` à chaque synchronisation).
 */
export async function syncAcademicYearToOdoo(year: AcademicYearForOdoo): Promise<number | null> {
  const config = getOdooConfig();
  if (!config) return null;

  const values: Record<string, unknown> = {
    name: year.name,
    date_start: `${year.startYear}-09-01`,
    date_end: `${year.endYear}-08-31`,
    is_current: year.isCurrent,
  };

  const existing = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'csl.school.year',
    'search_read',
    [[['external_year_id', '=', year.id]]],
    { fields: ['id'], limit: 1 }
  );

  if (existing.length > 0) {
    await executeKwWithRetry(config, 'csl.school.year', 'write', [[existing[0].id], values]);
    return existing[0].id;
  }

  const newId = await executeKwWithRetry<number>(config, 'csl.school.year', 'create', [
    { ...values, external_year_id: year.id },
  ]);
  return newId;
}

const SALES_JOURNAL_CODE = 'VESC';
let cachedSalesJournalId: number | null = null;

/** Journal de vente dédié aux frais de scolarité (« Ventes Scolarités » / VESC), avec repli sur le premier journal de vente trouvé. */
async function getSalesJournalId(config: OdooConfig): Promise<number | null> {
  if (cachedSalesJournalId !== null) return cachedSalesJournalId;

  const byCode = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'account.journal',
    'search_read',
    [[['code', '=', SALES_JOURNAL_CODE]]],
    { fields: ['id'], limit: 1 }
  );
  if (byCode.length > 0) {
    cachedSalesJournalId = byCode[0].id;
    return cachedSalesJournalId;
  }

  const fallback = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'account.journal',
    'search_read',
    [[['type', '=', 'sale']]],
    { fields: ['id'], limit: 1 }
  );
  if (fallback.length > 0) {
    cachedSalesJournalId = fallback[0].id;
    return cachedSalesJournalId;
  }
  return null;
}

const CASH_JOURNAL_CODE = 'CSH1';
let cachedCashJournalId: number | null = null;

/** Journal d'encaissement par défaut (« Caisse Collège » / CSH1), avec repli sur le premier journal cash puis banque trouvé. */
async function getCashJournalId(config: OdooConfig): Promise<number | null> {
  if (cachedCashJournalId !== null) return cachedCashJournalId;

  const byCode = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'account.journal',
    'search_read',
    [[['code', '=', CASH_JOURNAL_CODE]]],
    { fields: ['id'], limit: 1 }
  );
  if (byCode.length > 0) {
    cachedCashJournalId = byCode[0].id;
    return cachedCashJournalId;
  }

  for (const type of ['cash', 'bank']) {
    const fallback = await executeKwWithRetry<Array<{ id: number }>>(
      config,
      'account.journal',
      'search_read',
      [[['type', '=', type]]],
      { fields: ['id'], limit: 1 }
    );
    if (fallback.length > 0) {
      cachedCashJournalId = fallback[0].id;
      return cachedCashJournalId;
    }
  }
  return null;
}

/**
 * Encaisse (best-effort) la première tranche de l'échéancier d'une facture
 * tout juste validée : trouve l'échéance la plus proche (la « versement #1 »
 * si un échéancier multi-tranches est appliqué, sinon la ligne receivable
 * unique = le montant total), et enregistre un paiement pour ce montant exact
 * via le wizard natif Odoo (mêmes reconciliation/état que la fonction
 * « Enregistrer un paiement » de l'interface), sur le journal de caisse par
 * défaut. Ne bloque jamais la facturation en cas d'échec.
 */
async function collectFirstInstallment(config: OdooConfig, moveId: number): Promise<void> {
  const dueLines = await executeKwWithRetry<Array<{ id: number; debit: number }>>(
    config,
    'account.move.line',
    'search_read',
    [[['move_id', '=', moveId], ['account_id.account_type', '=', 'asset_receivable']]],
    { fields: ['debit'], order: 'date_maturity asc, id asc', limit: 1 }
  );
  if (dueLines.length === 0) return;
  const firstLine = dueLines[0];

  const cashJournalId = await getCashJournalId(config);
  if (!cashJournalId) return;

  const wizardId = await executeKwWithRetry<number>(
    config,
    'account.payment.register',
    'create',
    [{
      amount: firstLine.debit,
      journal_id: cashJournalId,
      payment_date: new Date().toISOString().slice(0, 10),
    }],
    { context: { active_model: 'account.move.line', active_ids: [firstLine.id] } }
  );

  await executeKwWithRetry(config, 'account.payment.register', 'action_create_payments', [[wizardId]]);
}

export interface InscriptionInvoiceData {
  studentName: string;
  /** Id de l'élève côté app école (= `students.id`), pour résoudre `csl.partner.child`. */
  studentExternalId: string;
  className: string;
  /** Id de la classe côté app école (= `classes.id`), pour résoudre `csl.school.class`. */
  classExternalId: string;
  academicYear: AcademicYearForOdoo;
  /** Id du contact Odoo (res.partner) du parent responsable financier. */
  partnerId: number;
}

/**
 * Résout l'id `csl.partner.child` de l'élève, sous le contact du parent
 * facturé : un même élève (même `external_student_id`) peut exister en
 * plusieurs exemplaires côté Odoo, un par parent l'ayant dans ses
 * `csl_child_ids` — on veut précisément celui rattaché au partner facturé.
 */
async function findStudentChildId(config: OdooConfig, studentExternalId: string, partnerId: number): Promise<number | null> {
  const found = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'csl.partner.child',
    'search_read',
    [[['external_student_id', '=', studentExternalId], ['partner_id', '=', partnerId]]],
    { fields: ['id'], limit: 1 }
  );
  return found.length > 0 ? found[0].id : null;
}

/**
 * Vérifie qu'aucune facture n'a déjà été générée pour cet élève sur cette
 * année scolaire (idempotence : `invoiceInOdoo` peut être ré-appelée sans
 * risque de doublon — ex. nouvelle tentative après une erreur transitoire).
 */
async function findExistingInvoiceId(config: OdooConfig, studentChildId: number, schoolYearId: number): Promise<number | null> {
  const found = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'account.move',
    'search_read',
    [[
      ['move_type', '=', 'out_invoice'],
      ['state', '!=', 'cancel'],
      ['csl_student_id', '=', studentChildId],
      ['csl_school_year_id', '=', schoolYearId],
    ]],
    { fields: ['id'], limit: 1 }
  );
  return found.length > 0 ? found[0].id : null;
}

/** Résout l'id `csl.school.class` déjà synchronisé (voir `syncClassToOdoo`). */
async function findSchoolClassId(config: OdooConfig, classExternalId: string): Promise<number | null> {
  const found = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'csl.school.class',
    'search_read',
    [[['external_class_id', '=', classExternalId]]],
    { fields: ['id'], limit: 1 }
  );
  return found.length > 0 ? found[0].id : null;
}

const SCHOOL_ANALYTIC_ACCOUNT_NAME = 'Collège';
let cachedSchoolAnalyticAccountId: number | null = null;

/**
 * Compte analytique « Collège » (axe « Activités & Services ») auquel toutes
 * les lignes de produit des factures de scolarité doivent être rattachées.
 */
async function getSchoolAnalyticAccountId(config: OdooConfig): Promise<number | null> {
  if (cachedSchoolAnalyticAccountId !== null) return cachedSchoolAnalyticAccountId;

  const found = await executeKwWithRetry<Array<{ id: number }>>(
    config,
    'account.analytic.account',
    'search_read',
    [[['name', '=', SCHOOL_ANALYTIC_ACCOUNT_NAME]]],
    { fields: ['id'], limit: 1 }
  );
  if (found.length > 0) {
    cachedSchoolAnalyticAccountId = found[0].id;
  }
  return cachedSchoolAnalyticAccountId;
}

/**
 * Crée et valide automatiquement une facture client (account.move) dans Odoo
 * suite à une inscription : une ligne par produit affecté au NIVEAU de la
 * classe (`csl.school.level.product_ids`), avec l'échéancier du niveau s'il
 * est configuré. Encaisse ensuite automatiquement la première tranche de cet
 * échéancier (voir `collectFirstInstallment`). Retourne l'id de la facture
 * créée, ou `null` si Odoo n'est pas configuré/joignable, ou si aucun produit
 * n'est affecté à ce niveau (rien à facturer — on ne crée pas une facture vide).
 */
export async function createInscriptionInvoice(data: InscriptionInvoiceData): Promise<number | null> {
  const config = getOdooConfig();
  if (!config) return null;

  const levelName = deriveLevelName(data.className);
  const levels = await executeKwWithRetry<Array<{
    id: number;
    product_ids: number[];
    payment_term_id: [number, string] | false;
  }>>(
    config,
    'csl.school.level',
    'search_read',
    [[['name', '=', levelName]]],
    { fields: ['product_ids', 'payment_term_id'], limit: 1 }
  );

  if (levels.length === 0 || levels[0].product_ids.length === 0) {
    return null;
  }
  const level = levels[0];

  const products = await executeKwWithRetry<Array<{ id: number; name: string; list_price: number }>>(
    config,
    'product.template',
    'read',
    [level.product_ids],
    { fields: ['name', 'list_price'] }
  );

  const journalId = await getSalesJournalId(config);

  // Résolutions best-effort : une facturation ne doit jamais échouer parce
  // qu'un élève/classe/année n'est pas (encore) synchronisé côté Odoo — on
  // omet simplement le champ correspondant si la résolution échoue.
  const [studentChildId, schoolClassId, schoolYearId, analyticAccountId] = await Promise.all([
    findStudentChildId(config, data.studentExternalId, data.partnerId).catch(() => null),
    findSchoolClassId(config, data.classExternalId).catch(() => null),
    syncAcademicYearToOdoo(data.academicYear).catch(() => null),
    getSchoolAnalyticAccountId(config).catch(() => null),
  ]);
  const analyticDistribution = analyticAccountId ? { [String(analyticAccountId)]: 100 } : undefined;

  // Idempotence : si l'élève (résolu) a déjà une facture pour cette année
  // scolaire, on ne recrée pas de doublon — on renvoie l'id existant.
  if (studentChildId && schoolYearId) {
    const existingInvoiceId = await findExistingInvoiceId(config, studentChildId, schoolYearId);
    if (existingInvoiceId) return existingInvoiceId;
  }

  const invoiceLineCommands: unknown[] = [
    [0, 0, { display_type: 'line_section', name: `Scolarité ${data.studentName} (${data.className} - ${data.academicYear.name})` }],
    ...products.map((p) => [0, 0, {
      product_id: p.id,
      name: p.name,
      quantity: 1,
      price_unit: p.list_price,
      ...(analyticDistribution ? { analytic_distribution: analyticDistribution } : {}),
    }]),
  ];

  const moveVals: Record<string, unknown> = {
    move_type: 'out_invoice',
    partner_id: data.partnerId,
    invoice_date: new Date().toISOString().slice(0, 10),
    invoice_line_ids: invoiceLineCommands,
  };
  if (journalId) moveVals.journal_id = journalId;
  if (level.payment_term_id) moveVals.invoice_payment_term_id = level.payment_term_id[0];
  if (studentChildId) moveVals.csl_student_id = studentChildId;
  if (schoolClassId) moveVals.csl_school_class_id = schoolClassId;
  if (schoolYearId) moveVals.csl_school_year_id = schoolYearId;

  const moveId = await executeKwWithRetry<number>(config, 'account.move', 'create', [moveVals]);
  await executeKwWithRetry(config, 'account.move', 'action_post', [[moveId]]);
  await collectFirstInstallment(config, moveId);
  return moveId;
}
