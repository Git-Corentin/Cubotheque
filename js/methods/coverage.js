// « Quel outil pour quel puzzle ? » : la carte des familles de casse-têtes et de l'outil de fiche adapté.
export const COVERAGE = [
  ['Cubes 2x2 à 9x9', 'Rubik\'s Cube et toutes les tailles', 'Diagramme de cube (dessus, 3D, patron, flèches calculées) ; lecteur 3D jusqu\'au 13x13.'],
  ['Cuboïdes', '2x2x3 Tower, 3x3x2 Domino, 3x3x4, 3x3x5, 2x3x4, 1x3x3 Floppy…', 'Diagramme de cube en mode cuboïde : demi-tours seulement sur les faces rectangulaires, mouvements impossibles refusés.'],
  ['Void, Spy Cube', 'Cubes sans centres', 'Diagramme avec le masque « Void » ou la pastille trou.'],
  ['Mirror Blocks', 'Mirror 2x2, 3x3, 4x4…', 'Diagramme en rendu « relief Mirror » : chaque pièce garde sa taille et sa saillie d\'origine.'],
  ['Shape mods du 3x3', 'Axis, Ghost, Fisher, Windmill, Penrose, Pillow, Barrel, Megamorphix…', 'Logique du 3x3 en diagramme ; forme réelle sur photo ou planche libre ; centres orientés : algorithme dédié dans la bibliothèque.'],
  ['Tétraèdres', 'Pyraminx, Master/Professor/Royal/Emperor Pyraminx, Tetraminx, Jing\'s, Pyramorphix, Mastermorphix', 'Lecteur 3D (géométries cubing.js), gabarits triangle de la planche libre.'],
  ['Rotation par les coins', 'Skewb, Master/Professor Skewb, Compy, Dino, Rex, Redi Cube, Ivy', 'Lecteur 3D (Skewb, Dino, Redi, Compy…), gabarits Skewb, Dino, Redi/Rex.'],
  ['Rotation par les arêtes', 'Helicopter, Curvy Copter, Little Chop, Big Chop', 'Lecteur 3D en géométrie nommée ; courbes exactes : tracé libre sur photo.'],
  ['Octaèdres', 'FTO, Baby/Master FTO, Skewb Diamond, Christopher\'s Jewel, Octastar, Trajber', 'Lecteur 3D ; gabarit triangle.'],
  ['Dodécaèdres', 'Megaminx, Kilominx, Gigaminx, Teraminx… Yottaminx, Pentultimate, Starminx, Pyraminx Crystal, Chopasaurus', 'Lecteur 3D ; gabarits Megaminx, Kilominx, Gigaminx.'],
  ['Icosaèdres', 'Eitan\'s Star, Radio Chop, Icosamate, Astrominx, Icosaminx', 'Lecteur 3D en géométrie nommée.'],
  ['Hybrides', '2x2x2 + Dino, Megaminx + Chopasaurus, et toute combinaison de coupes', 'Lecteur 3D « géométrie libre » : forme + coupes (ex. « c f 0 v 0.577 »).'],
  ['Square-1 et changeurs de forme', 'Square-1, Square-2, Mastermorphix, Bandaged', 'Lecteur 3D (Square-1) ; gabarit de couche Square-1 ; tracé libre pour les formes atypiques.'],
  ['Clock', 'Rubik\'s Clock', 'Bloc Clock : 18 cadrans, pins, coins liés, cadrans surlignés.'],
  ['Puzzles à engrenages et circulaires', 'Gear Cube, Gear Pyraminx, Crazy/Circle Cubes, Siamese, Rubik\'s 360', 'Planche libre : gabarits disque à secteurs, tracé libre par-dessus une photo, flèches courbes et pastilles.'],
  ['Tout le reste', 'Puzzles 2D, labyrinthes, prototypes, pièces uniques', 'Photos + planche libre en calque + extrait de vidéo avec QR code dans le PDF.'],
];
