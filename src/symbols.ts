// Bibliothèque de symboles, inspirée de l'IEC 60617 et de la pratique AREI.
// Le corps du symbole commence à y=10 sous le point de connexion (0,0) ; le trait 0→10 est ajouté sur l'unifilaire.

const box = (t: string) => `<rect x="-13" y="10" width="26" height="18"/><text class="sym" y="23">${t}</text>`;
const lamp = '<circle cy="18" r="8"/><path d="M-5.7 12.3l11.4 11.4M5.7 12.3l-11.4 11.4"/>';
const socket = '<path d="M-10 20A10 10 0 0 1 10 20"/>';
const earth = '<path d="M-10 10H10"/>';
const sw = '<circle cy="14" r="3"/><path d="M2 16L12 28L15 25"/>';

export interface SymbolDef { group: string; label: string; svg: string }

export const SYMBOLS: Record<string, SymbolDef> = {
  prise: { group: 'Prises', label: 'Prise avec terre', svg: socket + earth },
  prise_sans_terre: { group: 'Prises', label: 'Prise sans terre', svg: socket },
  prise_etanche: { group: 'Prises', label: 'Prise étanche (IP44+)', svg: socket + earth + '<text class="sym" y="31">IP</text>' },
  prise_tri: { group: 'Prises', label: 'Prise triphasée', svg: socket + earth + '<text class="sym" y="31">3~</text>' },
  rj45: { group: 'Prises', label: 'Prise réseau (RJ45)', svg: socket + '<text class="sym" y="31">TP</text>' },
  tv: { group: 'Prises', label: 'Prise TV', svg: socket + '<text class="sym" y="31">TV</text>' },

  lumiere: { group: 'Éclairage', label: 'Point lumineux', svg: lamp },
  applique: { group: 'Éclairage', label: 'Applique murale', svg: lamp + '<path d="M-10 8H10"/>' },
  spot: { group: 'Éclairage', label: 'Spot encastré', svg: '<circle cy="16" r="6"/><path d="M-4.2 11.8l8.4 8.4M4.2 11.8l-8.4 8.4"/>' },
  reglette: { group: 'Éclairage', label: 'Tube / réglette LED', svg: '<path d="M-14 16H14M-14 12V20M14 12V20"/>' },
  secours: { group: 'Éclairage', label: 'Éclairage de secours', svg: lamp + '<circle class="fill" cy="18" r="3"/>' },

  interrupteur: { group: 'Commandes', label: 'Interrupteur simple', svg: sw },
  bipolaire: { group: 'Commandes', label: 'Interrupteur bipolaire', svg: sw + '<path d="M9 24L12 21"/>' },
  va_et_vient: { group: 'Commandes', label: 'Va-et-vient', svg: sw + '<path d="M-2 16L-12 28L-15 25"/>' },
  poussoir: { group: 'Commandes', label: 'Bouton-poussoir', svg: '<circle cy="16" r="6"/><circle cy="16" r="2"/>' },
  variateur: { group: 'Commandes', label: 'Variateur', svg: sw + '<path d="M-12 28L-4 20M-4 20l-4 1M-4 20l-1 4"/>' },
  detecteur: { group: 'Commandes', label: 'Détecteur de mouvement', svg: box('PIR') },
  telerupteur: { group: 'Commandes', label: 'Télérupteur', svg: box('TL') },
  minuterie: { group: 'Commandes', label: 'Minuterie', svg: box('MT') },
  thermostat: { group: 'Commandes', label: 'Thermostat', svg: box('θ') },
  sonnette: { group: 'Commandes', label: 'Sonnette', svg: '<path d="M-9 24A9 9 0 0 1 9 24Z"/>' },
  volet: { group: 'Commandes', label: 'Volet / store motorisé', svg: box('VR') },

  taque: { group: 'Appareils', label: 'Taque de cuisson', svg: '<rect x="-13" y="10" width="26" height="18"/><circle cx="-6" cy="15" r="2.5"/><circle cx="6" cy="15" r="2.5"/><circle cx="-6" cy="23" r="2.5"/><circle cx="6" cy="23" r="2.5"/>' },
  four: { group: 'Appareils', label: 'Four', svg: box('F') },
  micro_ondes: { group: 'Appareils', label: 'Micro-ondes', svg: box('MO') },
  lave_linge: { group: 'Appareils', label: 'Lave-linge', svg: '<rect x="-13" y="10" width="26" height="18"/><circle cy="19" r="6"/>' },
  seche_linge: { group: 'Appareils', label: 'Sèche-linge', svg: box('SL') },
  lave_vaisselle: { group: 'Appareils', label: 'Lave-vaisselle', svg: box('LV') },
  frigo: { group: 'Appareils', label: 'Réfrigérateur', svg: box('FR') },
  congelateur: { group: 'Appareils', label: 'Congélateur', svg: box('CG') },
  hotte: { group: 'Appareils', label: 'Hotte', svg: box('H') },
  chauffe_eau: { group: 'Appareils', label: 'Chauffe-eau / boiler', svg: box('CE') },
  radiateur: { group: 'Appareils', label: 'Chauffage électrique', svg: '<rect x="-13" y="10" width="26" height="18"/><path d="M-7 10V28M0 10V28M7 10V28"/>' },
  vmc: { group: 'Appareils', label: 'Ventilation (VMC)', svg: box('VMC') },
  moteur: { group: 'Appareils', label: 'Moteur', svg: '<circle cy="19" r="9"/><text class="sym" y="23">M</text>' },
  appareil: { group: 'Appareils', label: 'Autre appareil', svg: '<rect x="-13" y="10" width="26" height="18"/>' },
  tableau: { group: 'Appareils', label: 'Tableau divisionnaire', svg: '<rect x="-14" y="10" width="28" height="16"/><path d="M-14 26L14 10"/><path class="fill" d="M-14 26L14 10L14 26Z"/>' },

  pv: { group: 'Énergie & solaire', label: 'Panneaux photovoltaïques', svg: '<rect x="-13" y="10" width="26" height="18"/><path d="M-13 28L13 10M-18 2l5 5M-13 0l5 5"/>' },
  onduleur: { group: 'Énergie & solaire', label: 'Onduleur', svg: '<rect x="-12" y="10" width="24" height="24"/><path d="M-12 34L12 10"/><text class="sym" x="-5" y="20">=</text><text class="sym" x="5" y="31">~</text>' },
  batterie: { group: 'Énergie & solaire', label: 'Batterie de stockage', svg: '<path d="M0 10V14M-12 14H12M-6 19H6M-12 24H12M-6 29H6"/>' },
  sectionneur_dc: { group: 'Énergie & solaire', label: 'Sectionneur DC', svg: '<path d="M0 10V14L8 26M0 28V32M-4 14H4"/><text class="sym" x="13" y="22">=</text>' },
  parafoudre: { group: 'Énergie & solaire', label: 'Parafoudre', svg: '<rect x="-6" y="10" width="12" height="20"/><path d="M0 12V24M-3 21L0 24L3 21"/>' },
  optimiseur: { group: 'Énergie & solaire', label: 'Optimiseur PV', svg: box('OPT') },
  compteur: { group: 'Énergie & solaire', label: 'Compteur (kWh)', svg: box('kWh') },
  compteur_bidir: { group: 'Énergie & solaire', label: 'Compteur bidirectionnel', svg: box('±kWh') },
  borne_ve: { group: 'Énergie & solaire', label: 'Borne de recharge VE', svg: box('VE') },
  pac: { group: 'Énergie & solaire', label: 'Pompe à chaleur', svg: box('PAC') },
  terre: { group: 'Énergie & solaire', label: 'Prise de terre', svg: '<path d="M0 10V18M-10 18H10M-6 22H6M-2 26H2"/>' },
};

export const symbol = (kind: string) => SYMBOLS[kind] ?? SYMBOLS.appareil;
