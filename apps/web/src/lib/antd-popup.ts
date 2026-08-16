/** Format de date français, homogène sur les formulaires. */
export const DATE_FORMAT = 'DD/MM/YYYY';

/**
 * Note sur le placement des calendriers Ant Design.
 *
 * Quand la place manque sous le champ, antd bascule le panneau vers le haut et
 * il recouvre le formulaire. La tentation est d'ancrer le panneau au champ via
 * `getPopupContainer` : c'est contre-productif ici. L'ajustement anti-débordement
 * se calcule alors contre le conteneur du champ, bien plus petit que la fenêtre,
 * et le panneau sort carrément de l'écran (mesuré à `top: -37px` sur le
 * formulaire trimestre).
 *
 * La solution retenue est de laisser antd positionner le panneau par rapport à
 * la fenêtre (comportement par défaut) et de garantir la place nécessaire sous
 * les champs de date — voir la marge basse de SemesterFormPage.
 */
