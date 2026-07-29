/**
 * ============================================================================
 * FICHIER : src/common/helpers/sla.helper.ts
 * RÔLE : Moteur de calcul des échéances SLA (Service Level Agreement).
 * EXPLICATION :
 * Ce module calcule la date et l'heure limites de traitement (1ère réponse ou résolution) d'un ticket :
 * 1. Mode `24_7` : Ajout direct des minutes au temps UNIX (incidents critiques / 24h/24 7j/7).
 * 2. Mode `BUSINESS_HOURS` : Addition progressive de minutes en sautant automatiquement les heures non-ouvrables
 *    (ex: en dehors de 8h-18h) ainsi que les jours non ouvrés (week-ends et jours fériés).
 * ============================================================================
 */

/**
 * Calcule la date limite d'échéance SLA à partir d'une date de départ et d'une durée en minutes.
 *
 * @param startDate Date et heure de création ou de reprise du ticket.
 * @param minutesToAdd Nombre de minutes SLA à ajouter (ex: 240 minutes pour 4 heures).
 * @param calendarType Mode de calendrier ('24_7' ou 'BUSINESS_HOURS').
 * @param businessHours Plage horaire d'ouverture (ex: { start: 8, end: 18 }).
 * @param businessDays Jours ouvrés de la semaine (ex: [1, 2, 3, 4, 5] pour Lundi à Vendredi).
 * @returns La date exacte d'expiration du SLA.
 */
export function calculateSlaDueDate(
  startDate: Date,
  minutesToAdd: number,
  calendarType: '24_7' | 'BUSINESS_HOURS' = '24_7',
  businessHours?: { start: number; end: number },
  businessDays: number[] = [1, 2, 3, 4, 5],
): Date {
  // Mode 24/7 : calcul direct sans pause de nuit ni de week-end
  if (calendarType === '24_7') {
    return new Date(startDate.getTime() + minutesToAdd * 60 * 1000);
  }

  let current = new Date(startDate.getTime());
  let remainingMinutes = minutesToAdd;

  const START_HOUR =
    businessHours?.start ??
    (process.env['BUSINESS_HOURS_START'] ? parseInt(process.env['BUSINESS_HOURS_START'], 10) : 8);
  const END_HOUR =
    businessHours?.end ?? (process.env['BUSINESS_HOURS_END'] ? parseInt(process.env['BUSINESS_HOURS_END'], 10) : 18);

  // Positionner la date de départ sur le premier créneau ouvré valide
  adjustToBusinessHours(current, { start: START_HOUR, end: END_HOUR }, businessDays);

  // Consommer le nombre de minutes restantes sur les plages de bureau disponibles
  while (remainingMinutes > 0) {
    const endOfToday = new Date(current.getTime());
    endOfToday.setHours(END_HOUR, 0, 0, 0);

    // Calcul des minutes disponibles d'ici la fermeture de la journée en cours
    const availableToday = Math.max(0, Math.floor((endOfToday.getTime() - current.getTime()) / 60000));

    if (remainingMinutes <= availableToday) {
      // Les minutes restantes s'inscrivent dans la journée en cours
      current = new Date(current.getTime() + remainingMinutes * 60 * 1000);
      remainingMinutes = 0;
    } else {
      // Déduire le reste de la journée et basculer à l'ouverture du jour ouvré suivant
      remainingMinutes -= availableToday;
      current.setDate(current.getDate() + 1);
      current.setHours(START_HOUR, 0, 0, 0);
      adjustToBusinessHours(current, { start: START_HOUR, end: END_HOUR }, businessDays);
    }
  }

  return current;
}

/**
 * Fonction interne replaçant une date donnée au début de la prochaine plage ouvrée valide.
 *
 * @param date Date à ajuster (mutée directement sur place).
 * @param hoursConfig Heures de début et de fin de bureau.
 * @param businessDays Tableau des jours ouvrés (0 = Dimanche, 1 = Lundi, ...).
 */
function adjustToBusinessHours(date: Date, hoursConfig: { start: number; end: number }, businessDays: number[]): void {
  const START_HOUR = hoursConfig.start;
  const END_HOUR = hoursConfig.end;

  // 1. Sauter les jours non ouvrables (ex: Samedi/Dimanche)
  while (!businessDays.includes(date.getDay())) {
    date.setDate(date.getDate() + 1);
    date.setHours(START_HOUR, 0, 0, 0);
  }

  // 2. Ajuster l'heure si en dehors de la plage d'ouverture
  const hours = date.getHours();
  if (hours < START_HOUR) {
    date.setHours(START_HOUR, 0, 0, 0);
  } else if (hours >= END_HOUR) {
    // Après la fermeture -> avancer au lendemain matin 8h et ré-évaluer
    date.setDate(date.getDate() + 1);
    date.setHours(START_HOUR, 0, 0, 0);
    adjustToBusinessHours(date, hoursConfig, businessDays);
  }
}
