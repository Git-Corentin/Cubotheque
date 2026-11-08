# Cubothèque

Site pour présenter et gérer une collection de casse-têtes rotatifs, avec chronomètre, mosaïques en cubes, bibliothèque de méthodes vérifiées et atelier de fiches de résolution.

Le site est **statique** (HTML, CSS, JavaScript). Il s'héberge gratuitement (GitHub Pages, Netlify, Cloudflare Pages) et, branché sur une base **Supabase** gratuite, il devient :

- **consultable par tout le monde**, en lecture seule ;
- **modifiable uniquement par vous**, depuis l'ordinateur comme depuis le téléphone, après connexion ;
- **installable sur le téléphone** comme une application (menu du navigateur, « Ajouter à l'écran d'accueil »), avec prise de photo directe.

Sans base configurée, il fonctionne entièrement dans le navigateur (mode local).

---

## Mise en ligne en 4 étapes (30 minutes environ)

### 1. Créer la base (Supabase, gratuit)
1. Créez un compte sur supabase.com, puis **New project** (région Europe, mot de passe de base au choix).
2. **SQL Editor → New query** : collez tout le fichier `supabase/schema.sql`, puis **Run**. Il crée les tables, le stockage d'images et les règles d'accès (lecture publique, écriture réservée aux administrateurs).
3. **Authentication → Users → Add user** : votre adresse et un mot de passe (cochez « Auto confirm »).
4. **Authentication → Sign In / Providers** : désactivez **Allow new users to sign up**. Personne d'autre ne pourra créer de compte.
5. **SQL Editor** : lancez la dernière ligne du script avec votre adresse :
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'vous@exemple.fr';
   ```
6. **Project Settings → API Keys** : notez l'**URL du projet** et la **clé publique** (`sb_publishable_…`, ou l'ancienne clé `anon`). N'utilisez jamais la clé *secret* / *service_role* dans le site.

### 2. Brancher le site
Ouvrez `js/config.js` et remplissez :
```js
export const SUPABASE = {
  url: 'https://votre-projet.supabase.co',
  key: 'sb_publishable_…',
};
```
Astuce : Réglages → *Base en ligne* contient un assistant qui teste l'adresse et la clé, et génère ce bloc.

> Ces deux valeurs sont publiques par conception : la sécurité vient des règles de la base. Un visiteur qui bricolerait le code ne peut toujours rien écrire, la base refuse.

### 3. Héberger
**GitHub Pages** (recommandé) : créez un dépôt, envoyez-y le contenu de ce dossier (`index.html` à la racine), puis *Settings → Pages → Branch : main, / (root)*. Le site est à `https://votre-nom.github.io/nom-du-depot/`.
Autres choix : **Netlify Drop** (glisser le dossier sur app.netlify.com/drop) ou **Cloudflare Pages** (*Upload assets*).

L'adresse doit être en **https** : c'est obligatoire pour la caméra et l'installation sur téléphone (les trois hébergeurs le font d'office).

### 4. Garder la base éveillée
Sur l'offre gratuite, un projet Supabase **sans aucune activité pendant 7 jours est mis en pause** (les données restent, il faut le relancer depuis le tableau de bord). Si le site est hébergé sur GitHub, le fichier `.github/workflows/supabase-keepalive.yml` le contacte deux fois par semaine : ajoutez juste deux secrets au dépôt (*Settings → Secrets and variables → Actions*) : `SUPABASE_URL` et `SUPABASE_KEY` (la clé publique).

### Déjà des données dans le navigateur ?
Une fois connecté, Réglages → *Base en ligne* propose **« Les envoyer dans la base en ligne »**. Une sauvegarde `.zip` peut aussi être importée.

---

## Utilisation

| Section | Ce qu'on y fait |
|---|---|
| **Collection** | Présentoir, vue *à l'échelle* (objets dessinés à leur taille réelle), registre. Filtres, recherche, tri par couleur, fiche détaillée avec les méthodes liées et des liens vers tutos, wiki Speedsolving et musée TwistyPuzzles. |
| **Ajout** | Formulaire, **photo prise au téléphone**, *studio photo* avec cadre de visée, recherche d'images libres (Wikimedia Commons + Openverse), import, glisser-déposer, **coller une image copiée (Ctrl+V)**. Détourage automatique, recadrage, teinte calculée. |
| **Ajout en série** | Un nom par ligne, puis l'atelier photo fait défiler les objets sans image. |
| **Chrono** | Mélanges officiels (cubing.js), inspection WCA, une série par objet, moyennes, courbe. Les temps des visiteurs restent sur leur appareil. |
| **Méthodes** | Bibliothèque intégrée + vos fiches. Export PDF. |
| **Mosaïque** | Image → fresque de cubes, plan de montage imprimable. |
| **Chiffres** | Statistiques, mur de couleurs, records. |
| **Réglages** | Visibles seulement une fois connecté. Apparence, base en ligne, sauvegarde `.zip`, export CSV. |

L'accès propriétaire se trouve en bas de page : **Espace propriétaire**.

---

## Méthodes

### Bibliothèque intégrée (14 fiches)
3x3 débutant, CFOP 2 temps, **les 57 OLL**, **les 21 PLL**, 2x2 Ortega, 4x4 (réduction et parités), 5x5 et plus, Pyraminx, Skewb, Megaminx, Square-1, Clock, shape mods du 3x3 (Mirror, Axis, Fisher, Windmill, Ghost, Void…), cuboïdes.

**Chaque algorithme a été vérifié par calcul**, pas recopié de mémoire :
- cubes et cuboïdes : moteur du site (les 57 OLL donnent 57 cas distincts qui préservent les deux premières couches, les 21 PLL 21 cas distincts) ;
- Pyraminx, Skewb, Megaminx, Square-1 : modèles de puzzle de cubing.js (on vérifie quelles pièces bougent).

Une fiche de la bibliothèque se copie dans vos fiches pour être adaptée.

### Blocs d'une fiche
| Bloc | Pour quoi |
|---|---|
| **Diagramme de cube** | 2x2 à 9x9 et cuboïdes AxBxC : vue de dessus (OLL/PLL), 3D, patron. L'algorithme calcule le cas ; flèches de permutation automatiques ; masques OLL, PLL, F2L, croix, première couche, Void ; rendu **relief Mirror** ; peinture libre, trou pour les Void. |
| **Lecteur 3D** | 19 puzzles classiques + **70 géométries nommées** (Mastermorphix, Master Skewb, Helicopter, Curvy Copter, Gigaminx à Yottaminx, Starminx, Pyraminx Crystal, Eitan's Star, hybrides…) + géométrie libre. Photo, ou photo de chaque étape. |
| **Clock** | 18 cadrans, pins, coins liés comme sur le vrai, cadrans surlignés. |
| **Planche libre** | Gabarits de faces générés (NxN, cuboïde, Pyraminx, Megaminx, Gigaminx, Kilominx, Skewb, Dino, Redi/Rex, FTO, Square-1, disque à secteurs, ou découpe sur mesure), **tracé libre de pièces** par-dessus une photo, flèches, pastilles, texte. |
| **Vidéo** | Lien YouTube avec passage (début/fin), **QR code dans le PDF** ; capture d'images clés depuis une vidéo de l'appareil. |
| **Photos** | Photos de votre exemplaire, prises au téléphone. |
| **Texte** | Explications (`**gras**`, liens). |

La page Méthodes contient le tableau **« Quel outil pour quel puzzle ? »**, famille par famille.

**Notation des diagrammes** : `R U F L D B`, `'` inverse, `2` demi-tour, `Rw`/`r` deux couches, `3Rw` trois couches, `2R` 2ᵉ couche seule, `M E S`, `x y z`, `(R U R' U')3`. Sur un cuboïde, les faces rectangulaires n'acceptent que des demi-tours.

---

## Importer l'ancien inventaire Excel (une seule fois)
L'import tourne en tâche de fond avec une barre de progression en bas de l'écran ; on peut changer de page pendant ce temps. S'il est interrompu (onglet fermé, téléphone mis en veille), choisissez à nouveau le même fichier : le site propose de reprendre là où il s'était arrêté, sans doublons.

Le fichier `cubotheque-import-inventaire.zip` (fourni à part) contient les 135 objets de l'inventaire avec leurs photos déjà détourées. Réglages → Sauvegarde → choisir le fichier → **Remplacer tout** (ou « Ajouter à l'existant »). En mode en ligne, connectez-vous d'abord : les images partent dans la base pendant l'import. Rien n'est ajouté au site : c'est une restauration de sauvegarde ordinaire.

Le script qui a produit ce fichier (`outils/import_inventaire.py`, fourni à part, hors du site) peut être relancé sur une nouvelle version du tableur.

## Images et détourage
- **Atelier de détourage** : s'ouvre à chaque nouvelle image. Trois méthodes :
  - **IA précise** : modèle RMBG-1.4 exécuté dans le navigateur (transformers.js ; téléchargé une fois depuis huggingface.co, puis gardé en cache), avec IMG.LY en secours. Qualité Rapide / Équilibrée / Maximale.
  - **Couleur du fond** : calibrable. La pipette ajoute des couleurs de fond en cliquant dessus, la tolérance règle la sévérité, et l'option « relié aux bords » protège les pièces de la même couleur que le fond.
  - **Garder le fond**.
- Retouches : gomme de zone (un clic efface une plage de fond oubliée), pinceaux Effacer / Restaurer, dureté et lissage du contour, suppression des reflets colorés du fond, suppression des îlots détachés. Aperçu sur damier, blanc, noir ou couleur.
- Si l'IA ne se charge pas, l'atelier affiche la raison exacte et bascule sur « Couleur du fond ». Causes habituelles : bloqueur de publicité ou réseau filtrant huggingface.co, ou navigateur trop ancien.
- En mode en ligne, chaque image est envoyée en deux tailles (900 px et miniature 380 px) pour économiser la bande passante (5 Go/mois sur l'offre gratuite).
- Pour des photos homogènes : fond uni clair, lumière diffuse, vue de trois quarts, même cadrage. Le *studio photo* affiche un cadre de visée.
- Relais d'images facultatif : `worker/cors-proxy.js` (Cloudflare Workers, gratuit).

## Capacité de l'offre gratuite Supabase
500 Mo de base et 1 Go de fichiers. 200 objets avec deux tailles d'image ≈ 30 Mo : très large. Pas de sauvegarde automatique : téléchargez un `.zip` de temps en temps (Réglages).

## Bibliothèques utilisées (CDN)
cubing.js (MPL/GPL), @imgly/background-removal (**AGPL** : sans souci pour un site personnel au code public), supabase-js (MIT), JSZip, qrcode-generator, police Archivo.

## Structure
```
index.html, sw.js, manifest.webmanifest, icons/
css/app.css
js/config.js            adresse et clé publique Supabase
js/backend.js           base locale (IndexedDB) ou en ligne (Supabase)
js/store.js             données, droits, sauvegardes, migration
js/cube.js              moteur NxN et cuboïdes, rendus SVG, relief Mirror
js/gabarit.js, sketch.js  gabarits de faces et planche libre
js/methods/             blocs, bibliothèque, puzzles 3D, Clock, tableau de couverture
js/views/               une vue par section (dont login.js)
supabase/schema.sql     tables, stockage et règles d'accès
.github/workflows/      maintien en éveil de la base
worker/cors-proxy.js    relais d'images facultatif
```
