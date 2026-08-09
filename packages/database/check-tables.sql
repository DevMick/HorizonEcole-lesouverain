-- Script SQL pour vérifier si les tables de paie existent
-- Exécutez ce script dans PostgreSQL (psql ou pgAdmin)

-- Vérifier les tables de paie
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'teacher_remuneration',
            'teacher_allowances',
            'payroll_settings',
            'monthly_payrolls',
            'payroll_items',
            'payroll_payments',
            'advance_payments',
            'payroll_correction_requests'
        ) THEN '✅ Table de paie'
        ELSE 'Autre table'
    END as type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'teacher_remuneration',
    'teacher_allowances',
    'payroll_settings',
    'monthly_payrolls',
    'payroll_items',
    'payroll_payments',
    'advance_payments',
    'payroll_correction_requests'
)
ORDER BY table_name;

-- Compter les tables de paie
SELECT 
    COUNT(*) as nombre_tables_paie,
    CASE 
        WHEN COUNT(*) = 8 THEN '✅ Toutes les tables sont créées'
        WHEN COUNT(*) > 0 THEN '⚠️  Certaines tables manquent'
        ELSE '❌ Aucune table de paie trouvée'
    END as statut
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'teacher_remuneration',
    'teacher_allowances',
    'payroll_settings',
    'monthly_payrolls',
    'payroll_items',
    'payroll_payments',
    'advance_payments',
    'payroll_correction_requests'
);

-- Vérifier les enums créés
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as valeurs
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN (
    'RemunerationMode',
    'AllowanceType',
    'AllowanceCategory',
    'PayrollStatus',
    'SeniorityRuleType',
    'ProrataRule'
)
GROUP BY t.typname
ORDER BY t.typname;

