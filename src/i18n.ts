// Traduction : les textes sont écrits en français dans le code et traduits à l'affichage.
// _() marque un texte traduit plus tard (constantes), t() le traduit tout de suite.

export type Lang = 'fr' | 'nl';
let lang: Lang = 'fr';
export const setLang = (l: Lang) => { lang = l; };
export const getLang = () => lang;

/** Marque un texte à traduire au moment de l'affichage (il est retrouvé par le test de couverture). */
export const _ = (fr: string) => fr;

/** Traduit un texte français ; {x} est remplacé par vars.x. */
export function t(fr: string, vars: Record<string, unknown> = {}): string {
  const s = lang === 'nl' ? NL[fr] ?? fr : fr;
  return s.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''));
}

export const NL: Record<string, string> = {
  // Barre d'outils et onglets
  'Nouveau': 'Nieuw', 'Ouvrir': 'Openen', 'Enregistrer': 'Opslaan', 'Enregistrer sous': 'Opslaan als',
  'Exporter en PDF': 'Exporteren naar PDF', 'Aide RGIE': 'Hulp AREI', 'Nouveau projet': 'Nieuw project',
  'Schéma unifilaire': 'Eendraadschema', '+ Plan vierge': '+ Leeg plan', '+ Importer un plan': '+ Plan importeren',
  'Matériel': 'Materiaal', 'Mesures': 'Metingen', 'Fermer': 'Sluiten',
  // Éditeur
  'Projet': 'Project', 'Titre': 'Titel', 'Propriétaire': 'Eigenaar', 'Adresse installation': 'Adres installatie',
  'Organisme de contrôle': 'Keuringsorganisme', 'Date': 'Datum', 'Réseau': 'Net', 'Disjoncteur de branchement': 'Aansluitautomaat',
  'Installateur (cartouche)': 'Installateur (titelblok)', 'Nom / société': 'Naam / bedrijf', 'Adresse': 'Adres',
  'Téléphone': 'Telefoon', 'E-mail': 'E-mail', 'TVA / BCE': 'Btw / KBO', 'Logo :': 'Logo:', 'Retirer': 'Verwijderen',
  'Changer': 'Wijzigen', 'Choisir une image': 'Afbeelding kiezen', 'Différentiel général': 'Hoofddifferentieel',
  'Différentiel': 'Differentieel', 'Calibre': 'Kaliber', 'Sensibilité': 'Gevoeligheid', 'Type': 'Type',
  '+ Circuit': '+ Kring', '+ Différentiel': '+ Differentieel', '+ Circuit type…': '+ Standaardkring…',
  'Circuit {n}': 'Kring {n}', 'Nom': 'Naam', 'Câble': 'Kabel', 'Disjoncteur': 'Automaat', 'Phase': 'Fase',
  'Puissance': 'Vermogen', '+ Point': '+ Punt', 'Pièce': 'Ruimte', 'Courbe': 'Curve',
  'Supprimer le point': 'Punt verwijderen', 'Supprimer le circuit': 'Kring verwijderen', 'Supprimer le différentiel': 'Differentieel verwijderen',
  'Dupliquer le circuit': 'Kring dupliceren', 'Monter': 'Omhoog', 'Descendre': 'Omlaag',
  'Tableau principal': 'Hoofdverdeelbord', 'Tableau divisionnaire': 'Onderverdeelbord', 'Tableau {name}': 'Bord {name}',
  'Alimenté par': 'Gevoed door', 'Supprimer le tableau': 'Bord verwijderen', '0 = sans différentiel': '0 = zonder differentieel',
  'Répartition prévue : {v}': 'Voorziene verdeling: {v}', 'Type de point': 'Type punt',
  // Questions
  'Supprimer cet élément et tout son contenu ?': 'Dit element en de volledige inhoud verwijderen?',
  'Abandonner les modifications non enregistrées ?': 'Niet-opgeslagen wijzigingen verwerpen?',
  "Impossible d'ouvrir {f} : ce n'est pas un projet Electrik valide.": 'Kan {f} niet openen: dit is geen geldig Electrik-project.',
  'PDF illisible : {f}': 'Onleesbare PDF: {f}', 'Image illisible : {f}': 'Onleesbare afbeelding: {f}', 'DXF illisible : {f}': 'Onleesbare DXF: {f}',
  "Tapez d'abord le texte à placer.": 'Typ eerst de tekst die u wilt plaatsen.',
  'Tapez la longueur réelle en mètres dans le champ texte.': 'Typ de werkelijke lengte in meter in het tekstveld.',
  'Un projet non enregistré du {d} a été retrouvé. Le récupérer ?': 'Er werd een niet-opgeslagen project van {d} teruggevonden. Herstellen?',
  // Plan
  'Points': 'Punten', 'Liaison': 'Verbinding', 'Mur': 'Muur', 'Porte': 'Deur', 'Fenêtre': 'Raam', 'Texte': 'Tekst',
  'Cote': 'Maat', 'Escalier': 'Trap', 'Déplacer': 'Verplaatsen', 'Gomme': 'Gom', 'Échelle': 'Schaal', 'Tableau': 'Verdeelbord',
  'Annuler': 'Ongedaan maken', 'Texte à placer': 'Te plaatsen tekst', 'Nom du plan': 'Naam van het plan', 'Supprimer ce plan': 'Dit plan verwijderen',
  'Zoom 100 %': 'Zoom 100 %', 'Plan {n}': 'Plan {n}',
  '{a}/{b} points reportés': '{a}/{b} punten geplaatst',
  'Cliquez sur un point de la liste puis sur le plan pour le poser. Faites glisser un symbole pour le déplacer, clic droit pour le retirer.':
    'Klik op een punt in de lijst en daarna op het plan om het te plaatsen. Sleep een symbool om het te verplaatsen, rechtsklik om het te verwijderen.',
  "Cliquez sur un interrupteur puis sur le point lumineux qu'il commande (répétez pour chaque point). La Gomme supprime une liaison.":
    'Klik op een schakelaar en daarna op het lichtpunt dat hij bedient (herhaal voor elk punt). De gom verwijdert een verbinding.',
  'Cliquez chaque angle du mur. Double-clic, Entrée ou clic droit pour terminer.': 'Klik op elke hoek van de muur. Dubbelklik, Enter of rechtsklik om te beëindigen.',
  'Cliquez deux coins opposés de la pièce.': 'Klik op twee tegenoverliggende hoeken van de ruimte.',
  "Cliquez la charnière puis l'autre côté de l'ouverture. L'ordre des clics choisit le sens d'ouverture.":
    'Klik op het scharnier en daarna op de andere kant van de opening. De volgorde van de klikken bepaalt de draairichting.',
  'Cliquez les deux extrémités de la fenêtre.': 'Klik op beide uiteinden van het raam.',
  'Tapez le texte puis cliquez sur le plan pour le placer.': 'Typ de tekst en klik daarna op het plan om hem te plaatsen.',
  'Cliquez les deux extrémités de la cote.': 'Klik op beide uiteinden van de maatlijn.',
  "Cliquez deux coins opposés de l'escalier ; la flèche monte dans le sens du plus long côté.": 'Klik op twee tegenoverliggende hoeken van de trap; de pijl loopt volgens de langste zijde.',
  'Faites glisser un mur, une porte, une fenêtre, un texte ou une cote pour le déplacer.': 'Sleep een muur, deur, raam, tekst of maatlijn om hem te verplaatsen.',
  'Cliquez sur un mur, une porte, une fenêtre, un texte ou une liaison pour le supprimer.': 'Klik op een muur, deur, raam, tekst of verbinding om hem te verwijderen.',
  "Tapez la longueur réelle (m) dans le champ texte, puis cliquez les deux extrémités d'une distance connue.":
    'Typ de werkelijke lengte (m) in het tekstveld en klik daarna op beide uiteinden van een gekende afstand.',
  "Cliquez à l'endroit du tableau : les longueurs de câble sont mesurées depuis ce point.": 'Klik op de plaats van het verdeelbord: de kabellengtes worden vanaf dit punt gemeten.',
  'Molette : zoom · bouton du milieu ou Espace + glisser : déplacer la vue.': 'Muiswiel: zoom · middelste knop of spatie + slepen: weergave verschuiven.',
  // Matériel / mesures
  'Liste de matériel': 'Materiaallijst', 'Exporter (Excel / CSV)': 'Exporteren (Excel / CSV)', 'Étiquettes du tableau (PDF)': 'Etiketten verdeelbord (PDF)',
  'Catégorie': 'Categorie', 'Désignation': 'Omschrijving', 'Quantité': 'Aantal', 'Unité': 'Eenheid',
  'Longueurs et chutes de tension': 'Lengtes en spanningsval', 'Longueur': 'Lengte', 'Chute de tension': 'Spanningsval',
  "Placez le tableau et les points sur un plan à l'échelle pour calculer les longueurs.": 'Plaats het verdeelbord en de punten op een plan op schaal om de lengtes te berekenen.',
  'Points par pièce': 'Punten per ruimte', 'Sans pièce': 'Zonder ruimte',
  'Résistance de dispersion de la prise de terre': 'Spreidingsweerstand van de aardverbinding', "Résistance d'isolement": 'Isolatieweerstand',
  'Continuité des liaisons équipotentielles': 'Continuïteit van de equipotentiaalverbindingen', 'Appareil de mesure': 'Meettoestel', 'Remarques': 'Opmerkingen',
  'Essai des différentiels': 'Test van de differentieelschakelaars', 'Courant de déclenchement': 'Uitschakelstroom', 'Temps de déclenchement': 'Uitschakeltijd',
  'Fiche de mesures': 'Meetfiche', 'Valeur mesurée': 'Gemeten waarde', 'Limite indicative': 'Indicatieve grens',
  'Différentiel {r}': 'Differentieel {r}',
  // Catégories de la liste de matériel
  'Disjoncteurs': 'Automaten', 'Différentiels': 'Differentieelschakelaars', 'Interrupteurs généraux': 'Hoofdschakelaars',
  'Câbles': 'Kabels', 'pc': 'st', 'm': 'm', 'circuit(s)': 'kring(en)', 'modules': 'modules',
  'longueur à mesurer': 'lengte te meten', 'Modules DIN (18 mm)': 'DIN-modules (18 mm)',
  // Feuilles
  'Plan de position': 'Situatieschema', 'Installateur': 'Installateur', "Adresse de l'installation": 'Adres van de installatie',
  'Tension réseau': 'Netspanning', 'Signature': 'Handtekening', 'Folio': 'Blad', 'Logo': 'Logo',
  'Alimenté par {pt}': 'Gevoed door {pt}', 'Général {a} A': 'Hoofdschakelaar {a} A', 'TVA / BCE {v}': 'Btw / KBO {v}',
  'Étiquettes du tableau – {name}': 'Etiketten verdeelbord – {name}',
  // Vérifications
  'Circuit {n} : phase « {ph} » impossible sur un réseau {net}': 'Kring {n}: fase « {ph} » onmogelijk op een net {net}',
  'Circuit {n} : câble {c} insuffisant en {p} ({k} conducteurs, terre comprise)': 'Kring {n}: kabel {c} onvoldoende in {p} ({k} geleiders, aarding inbegrepen)',
  'Circuit {n} : prise triphasée sur un circuit monophasé': 'Kring {n}: driefasig stopcontact op een eenfasige kring',
  'Circuit {n} : disjoncteur {a} A trop élevé pour {s} mm² (max {m} A)': 'Kring {n}: automaat {a} A te hoog voor {s} mm² (max {m} A)',
  'Circuit {n} : {k} points de prises (max 8)': 'Kring {n}: {k} stopcontactpunten (max 8)',
  "Circuit {n} : l'onduleur doit être sur un circuit dédié": 'Kring {n}: de omvormer moet op een aparte kring staan',
  "Différentiel {a} A {s} mA : 2P en amont d'un circuit triphasé (4P nécessaire)": 'Differentieel {a} A {s} mA: 2P vóór een driefasige kring (4P nodig)',
  'Phases déséquilibrées : {v}': 'Fasen niet in evenwicht: {v}',
  '{k} point(s) pas encore reporté(s) sur un plan : {v}': '{k} punt(en) nog niet op een plan geplaatst: {v}',
  'Point {pt} ({room}) sans différentiel 30 mA': 'Punt {pt} ({room}) zonder differentieel 30 mA',
  'Point {pt} ({kind}) sans différentiel 30 mA': 'Punt {pt} ({kind}) zonder differentieel 30 mA',
  'Circuit {n} : chute de tension estimée {v} % (> 5 %)': 'Kring {n}: geschatte spanningsval {v} % (> 5 %)',
  "{name} : point d'alimentation non choisi": '{name}: voedingspunt niet gekozen',
  'Prise de terre {v} Ω (> 30 Ω)': 'Aardverbinding {v} Ω (> 30 Ω)',
  'Différentiel {r} : déclenche à {v} mA (> {s} mA)': 'Differentieel {r}: schakelt uit bij {v} mA (> {s} mA)',
  'Différentiel {r} : temps de déclenchement {v} ms (> 300 ms)': 'Differentieel {r}: uitschakeltijd {v} ms (> 300 ms)',
  // Modèles de circuits
  'Éclairage': 'Verlichting', 'Prises': 'Stopcontacten', 'Prises cuisine': 'Stopcontacten keuken', 'Taque': 'Kookplaat',
  'Four': 'Oven', 'Lave-linge': 'Wasmachine', 'Sèche-linge': 'Droogkast', 'Lave-vaisselle': 'Vaatwasser', 'Chauffe-eau': 'Boiler',
  'Borne de recharge VE': 'Laadpaal EV', 'Photovoltaïque': 'Zonnepanelen', 'Pompe à chaleur': 'Warmtepomp', 'Ventilation (VMC)': 'Ventilatie',
  'Volets': 'Rolluiken',
  // Pièces proposées
  'Séjour': 'Woonkamer', 'Cuisine': 'Keuken', 'Salle de bain': 'Badkamer', 'Chambre': 'Slaapkamer', 'WC': 'Toilet', 'Hall': 'Hal',
  'Buanderie': 'Wasplaats', 'Garage': 'Garage', 'Bureau': 'Bureau', 'Grenier': 'Zolder', 'Cave': 'Kelder', 'Extérieur': 'Buiten',
  // Groupes et symboles
  'Commandes': 'Bediening', 'Appareils': 'Toestellen', 'Énergie & solaire': 'Energie & zon',
  'Prise avec terre': 'Stopcontact met aarding', 'Prise sans terre': 'Stopcontact zonder aarding', 'Prise étanche (IP44+)': 'Waterdicht stopcontact (IP44+)',
  'Prise triphasée': 'Driefasig stopcontact', 'Prise réseau (RJ45)': 'Netwerkaansluiting (RJ45)', 'Prise TV': 'TV-aansluiting',
  'Point lumineux': 'Lichtpunt', 'Applique murale': 'Wandlicht', 'Spot encastré': 'Inbouwspot', 'Tube / réglette LED': 'TL / LED-armatuur',
  'Éclairage de secours': 'Noodverlichting', 'Interrupteur simple': 'Enkelpolige schakelaar', 'Interrupteur bipolaire': 'Tweepolige schakelaar',
  'Va-et-vient': 'Wisselschakelaar', 'Bouton-poussoir': 'Drukknop', 'Variateur': 'Dimmer', 'Détecteur de mouvement': 'Bewegingsmelder',
  'Télérupteur': 'Teleruptor', 'Minuterie': 'Trappenhuisautomaat', 'Thermostat': 'Thermostaat', 'Sonnette': 'Bel',
  'Volet / store motorisé': 'Gemotoriseerd rolluik / zonnescherm', 'Taque de cuisson': 'Kookplaat', 'Micro-ondes': 'Microgolfoven',
  'Réfrigérateur': 'Koelkast', 'Congélateur': 'Diepvriezer', 'Hotte': 'Dampkap', 'Chauffe-eau / boiler': 'Boiler',
  'Chauffage électrique': 'Elektrische verwarming', 'Moteur': 'Motor', 'Autre appareil': 'Ander toestel',
  'Panneaux photovoltaïques': 'Zonnepanelen', 'Onduleur': 'Omvormer', 'Batterie de stockage': 'Thuisbatterij', 'Sectionneur DC': 'DC-scheider',
  'Parafoudre': 'Overspanningsbeveiliging', 'Optimiseur PV': 'PV-optimizer', 'Compteur (kWh)': 'Teller (kWh)',
  'Compteur bidirectionnel': 'Bidirectionele teller', 'Prise de terre': 'Aardverbinding',
};
