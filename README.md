# Carte des institutions abonnées à Philharmonie à la demande

Carte Leaflet affichant les institutions abonnées, à partir de
`https://med-api.philharmoniedeparis.fr/Maps/FullPAD`.
Même apparence que la carte des actions (`../carte/`).

## Fichiers

- `index.html` : structure de la page (titre, panneau de filtres, carte)
- `css/style.css` : styles (repris de `../carte/`, avec un bloc « CARTE PAD » à la fin)
- `js/map.js` : tout le fonctionnement de la carte
- `js/fullscreen`, `js/markerCluster`, `js/responsivePopup` : plugins Leaflet (ne pas modifier)

## Réglages courants (en haut de `js/map.js`)

| Pour…                                   | Modifier            |
|-----------------------------------------|---------------------|
| Changer la couleur d'un type            | `TYPE_COLORS`       |
| Ajouter ou recadrer un pays             | `COUNTRY_BOUNDS`    |
| Changer le pays affiché à l'ouverture   | `DEFAULT_COUNTRY`   |
| Zoomer plus ou moins sur une ville      | `CITY_ZOOM`         |
| Changer les libellés des services       | `SERVICES_LABELS`   |

La liste des pays du sélecteur vient directement de l'API (`filters.countries`).
Un pays absent de `COUNTRY_BOUNDS` est cadré automatiquement sur ses institutions.

## Règles d'affichage

- Les têtes de réseau (`role = "head"`) ne sont pas affichées.
- Les institutions sans coordonnées (`location` vide) ne sont pas affichées.
- Les institutions sans type sont classées dans « Autre ».
- Les marqueurs sont toujours affichés, quel que soit le pays choisi : le pays sert uniquement à déplacer la carte.

## Recherche de ville (France uniquement)

Les suggestions viennent de l'API officielle `https://geo.api.gouv.fr/communes`. Chaque suggestion affiche le nom de la commune, ses codes postaux et son département.

## Tester en local

Le dossier doit être servi par un serveur web, car un double-clic sur `index.html` ne suffit pas. Par exemple, utilisez l'extension « Live Server » de VS Code ou lancez `python -m http.server` dans ce dossier.
