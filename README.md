# Electrik

Logiciel **libre et gratuit** pour Windows qui produit le dossier électrique d'une habitation (RGIE/AREI, Belgique) : **schémas unifilaires**, **plans de position**, liste de matériel, étiquettes du tableau et fiche de mesures. Interface en français et en néerlandais.

On décrit le tableau dans le panneau de gauche (différentiels, circuits, points) et le schéma se dessine tout seul.

**Schéma unifilaire**
- numérotation automatique des circuits (A, B, …) et des points (A1, A2, …) ;
- **circuits types** en un clic (éclairage, prises, cuisine, taque, four, lave-linge, borne VE, PV, pompe à chaleur…), adaptés au réseau ; duplication et réordonnancement des circuits ;
- **monophasé et triphasé** : réseaux 2 × 230 V, 3 × 230 V et 3N × 400 V, phase et pôles par circuit (1P+N, 2P, 3P, 4P), répartition prévue par phase et alerte de déséquilibre ;
- **tableaux divisionnaires** alimentés depuis un circuit du tableau principal, chacun sur sa feuille ;
- environ 45 symboles : prises, éclairage, commandes, appareils, **photovoltaïque, onduleur, batterie, borne VE, pompe à chaleur**….

**Plans de position**
- import d'un plan **PDF, PNG, JPG ou DXF** (AutoCAD), ou **dessin dans l'application** : plan vierge à l'échelle 1:100, murs, pièces, portes, fenêtres, escaliers, cotes, textes ; déplacement, gomme, annulation (Ctrl+Z) ;
- **zoom** (molette) et déplacement de la vue (bouton du milieu ou Espace + glisser) ;
- report de chaque point d'un clic : le logiciel enchaîne sur le point suivant et liste ceux qui restent à placer ; points déplaçables par glisser-déposer ;
- **liaisons de commande** interrupteur → points lumineux ;
- **échelle** d'un plan importé (deux clics sur une distance connue) et position du **tableau** : Electrik en déduit la **longueur des câbles** et la **chute de tension**.

**Dossier**
- feuilles A4 paysage avec cadre à repères et **cartouche** (logo et coordonnées de l'installateur, adresse, propriétaire, organisme de contrôle, date et signature, folio) ;
- **liste de matériel** exportable vers Excel (CSV) : différentiels, disjoncteurs, câbles, points, modules DIN ;
- **étiquettes du tableau** à imprimer (18 mm par module) ;
- **fiche de mesures** : prise de terre, isolement, continuité, essai de chaque différentiel ;
- **pièces** par point : liste par pièce et contrôle du 30 mA en salle de bain ;
- vérifications : calibre et section, conducteurs en triphasé, 8 points de prises maximum, 30 mA pour salles de bain et lave-linge / sèche-linge / lave-vaisselle, onduleur sur circuit dédié, chute de tension, mesures hors limites, points non reportés ;
- **aide RGIE** intégrée ;
- enregistrement des projets (`.elk`, du JSON qui contient aussi les plans), **sauvegarde automatique** et récupération après un plantage, export PDF de toutes les feuilles.

> Les vérifications et les calculs sont indicatifs. Electrik ne remplace ni le RGIE ni le contrôle par un organisme agréé.

## Installer

Télécharger `Electrik-Setup-x.y.z.exe` dans les [Releases](https://github.com/Coolbreeze88/electrik/releases) et le lancer.

L'installateur n'est pas encore signé : au premier lancement, Windows affiche « Windows a protégé votre ordinateur ». Cliquer sur **Informations complémentaires** puis **Exécuter quand même**. L'installation ne demande pas de droits administrateur et l'application se met ensuite à jour toute seule.

## Développer

Il faut Node.js 22 ou plus récent.

```sh
npm install
npm start      # lance l'application
npm test       # tests
npm run dist   # crée l'installateur dans release/
```

| Fichier | Rôle |
|---|---|
| `src/schema.ts` | modèle du projet, numérotation, vérifications, calculs et rendu SVG des feuilles (sans DOM, testé) |
| `src/symbols.ts` | bibliothèque de symboles |
| `src/i18n.ts` | traductions (les textes sont écrits en français dans le code ; un test vérifie qu'ils ont tous leur traduction NL) |
| `src/dxf.ts` | conversion d'un plan DXF |
| `src/app.ts` | interface : éditeur, onglets, outils de plan |
| `src/main.ts` | processus Electron : fenêtre, fichiers, PDF, sauvegarde automatique, lecture DXF, mises à jour |
| `static/index.html` | page et texte de l'aide RGIE (FR et NL) |

### Publier une version

`git tag v0.1.0 && git push --tags` : GitHub Actions lance les tests, construit l'installateur et crée la release.

**Mises à jour automatiques** : l'application vérifie au démarrage les releases GitHub du dépôt déclaré dans `package.json` (`build.publish`).

**Signature de l'installateur** (évite l'avertissement « éditeur inconnu » de Windows) : acheter un certificat de signature de code, puis l'ajouter aux secrets du dépôt GitHub `CSC_LINK` (fichier .pfx encodé en base64) et `CSC_KEY_PASSWORD`. Le workflow les utilise automatiquement.

Les contributions sont bienvenues : nouveaux symboles, règles RGIE, traduction en allemand.

## Licence

[GPL-3.0](LICENSE). Electrik n'a aucun lien avec Trikker ni avec Bluebits.
