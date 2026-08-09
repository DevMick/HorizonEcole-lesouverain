import { useEffect, useState } from 'react';
import { BookOpen, Crown, Hash, Pencil } from 'lucide-react';
import { Button, Card } from '../components/ds';
import { cn } from '../lib/utils';
import { withTransitionsSuppressed } from '../lib/utils';

/** Prévisualisation des 3 écrans relationnels §10 (dev only) — Coefficients, Affectations matières, Affectations enseignants. */

const SUBJECTS = ['Mathématiques', 'Français', 'Anglais', 'Physique-Chimie', 'SVT', 'H.G'];

export default function DesignSystemRelationalPreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [coeffs, setCoeffs] = useState<Record<string, number>>(Object.fromEntries(SUBJECTS.map((s, i) => [s, (i % 4) + 1])));
  const [checked, setChecked] = useState<string[]>(['Mathématiques', 'Français']);

  useEffect(() => { document.documentElement.setAttribute('data-role', 'admin'); return () => document.documentElement.removeAttribute('data-role'); }, []);
  useEffect(() => { withTransitionsSuppressed(() => { document.documentElement.setAttribute('data-theme', theme); document.documentElement.classList.toggle('dark', theme === 'dark'); }); }, [theme]);

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex max-w-5xl justify-end gap-1 rounded-md bg-surface-subtle p-1" style={{ width: 'fit-content' }}>
        <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
        <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
      </div>

      <div className="mx-auto max-w-5xl space-y-8">
        {/* Coefficients */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ds-text">Coefficients</h2>
          <Card padded={false}>
            <div className="ds-coeff-head"><span>Matière — 6ème 1</span><span>Coefficient</span></div>
            <ul className="ds-coeff-list">
              {SUBJECTS.map((s) => (
                <li key={s} className="ds-coeff-row">
                  <span className="ds-coeff-name"><BookOpen width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} /><strong>{s}</strong></span>
                  <input type="number" min={1} max={20} className="ds-input font-mono ds-coeff-input" value={coeffs[s]} onChange={(e) => setCoeffs((p) => ({ ...p, [s]: Number(e.target.value) }))} />
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Affectation matières */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ds-text">Affectation des matières</h2>
          <Card>
            <div className="ds-check-grid">
              {SUBJECTS.map((s) => {
                const on = checked.includes(s);
                return (
                  <label key={s} className={cn('ds-check', on && 'ds-check-on')}>
                    <input type="checkbox" checked={on} onChange={() => setChecked((p) => on ? p.filter((x) => x !== s) : [...p, s])} />
                    <BookOpen width={16} height={16} aria-hidden />
                    <span className="min-w-0 truncate">{s}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Affectation enseignant (carte) */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ds-text">Affectations enseignants</h2>
          <div className="ds-entity-grid">
            <Card accent className="flex flex-col">
              <div className="border-b border-ds-border pb-3">
                <strong className="font-display text-[.98rem] font-bold text-ds-text">Amadou Traoré</strong>
                <div className="mt-2 flex flex-wrap gap-1.5"><span className="ds-chip ds-chip-mini">Anglais</span><span className="ds-chip ds-chip-mini">Communication</span></div>
              </div>
              <div className="mt-3 flex-1 space-y-2">
                <div className="rounded-md border border-ds-border bg-surface-subtle px-3 py-2">
                  <div className="text-[.82rem] font-semibold" style={{ color: 'var(--role-accent-700)' }}>6ème 1</div>
                  <div className="mt-1 flex flex-wrap gap-1"><span className="ds-chip ds-chip-mini">Anglais</span></div>
                </div>
                <div className="rounded-md border border-ds-border bg-surface-subtle px-3 py-2">
                  <div className="text-[.82rem] font-semibold" style={{ color: 'var(--role-accent-700)' }}>5ème 2</div>
                  <div className="mt-1 flex flex-wrap gap-1"><span className="ds-chip ds-chip-mini">Anglais</span></div>
                </div>
              </div>
              <span className="ds-badge ds-badge-warning mt-3 self-start"><Crown width={12} height={12} aria-hidden /> Prof. principal : 6ème 1</span>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-ds-border pt-3">
                <Button variant="outline" size="sm" icon={<Crown aria-hidden />}>Prof. principal</Button>
                <Button variant="ghost" size="sm" iconOnly icon={<Pencil aria-hidden />} aria-label="Modifier" />
              </div>
            </Card>
            <Card accent className="flex flex-col">
              <div className="border-b border-ds-border pb-3"><strong className="font-display text-[.98rem] font-bold text-ds-text">Fatou Diallo</strong></div>
              <div className="mt-3 flex-1"><p className="text-[.78rem] italic text-ds-text-tertiary">Aucune affectation</p></div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-ds-border pt-3">
                <Button variant="outline" size="sm" icon={<Crown aria-hidden />}>Prof. principal</Button>
                <Button variant="ghost" size="sm" iconOnly icon={<Pencil aria-hidden />} aria-label="Modifier" />
              </div>
            </Card>
          </div>
          <p className="mt-2 text-xs text-ds-text-tertiary"><Hash width={12} height={12} className="mr-1 inline" aria-hidden />Les 2 modales d'édition restent en Ant Design (§12.2).</p>
        </section>
      </div>
    </div>
  );
}
