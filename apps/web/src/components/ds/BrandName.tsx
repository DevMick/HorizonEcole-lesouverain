/**
 * Nom de la marque en deux tons : « Horizon » bleu nuit, « Ecole » ambre.
 *
 * Les couleurs sont fixes plutôt que dérivées de `--role-accent` : l'accent
 * change avec le rôle de l'utilisateur connecté (administrateur, enseignant,
 * parent…), alors que l'identité de la marque ne doit pas bouger.
 *
 * La teinte de « Horizon » est éclaircie en mode sombre (cf. index.css), où le
 * bleu nuit serait illisible sur fond foncé.
 */

export interface BrandNameProps {
  /** Classe appliquée à l'élément englobant (taille, graisse, espacement). */
  className?: string;
}

export function BrandName({ className }: BrandNameProps) {
  return (
    <span className={className}>
      <span className="ds-brand-horizon">Horizon</span>
      <span className="ds-brand-ecole">Ecole</span>
    </span>
  );
}
