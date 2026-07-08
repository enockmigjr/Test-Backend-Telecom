/**
 * Calcule la date limite d'un SLA en prenant en compte le calendrier (24/7 vs heures ouvrables).
 * Heures de bureau par défaut : Lundi au Vendredi, de 8h00 à 18h00.
 */
export function calculateSlaDueDate(
  startDate: Date,
  minutesToAdd: number,
  calendarType: '24_7' | 'BUSINESS_HOURS' = '24_7',
  businessHours?: { start: number; end: number },
  businessDays: number[] = [1, 2, 3, 4, 5],
): Date {
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

  // Ajuster la date de départ aux heures de bureau
  adjustToBusinessHours(current, { start: START_HOUR, end: END_HOUR }, businessDays);

  while (remainingMinutes > 0) {
    const endOfToday = new Date(current.getTime());
    endOfToday.setHours(END_HOUR, 0, 0, 0);

    // Minutes disponibles aujourd'hui
    const availableToday = Math.max(0, Math.floor((endOfToday.getTime() - current.getTime()) / 60000));

    if (remainingMinutes <= availableToday) {
      current = new Date(current.getTime() + remainingMinutes * 60 * 1000);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= availableToday;
      // Avancer au lendemain 8h
      current.setDate(current.getDate() + 1);
      current.setHours(START_HOUR, 0, 0, 0);
      adjustToBusinessHours(current, { start: START_HOUR, end: END_HOUR }, businessDays);
    }
  }

  return current;
}

function adjustToBusinessHours(date: Date, hoursConfig: { start: number; end: number }, businessDays: number[]): void {
  const START_HOUR = hoursConfig.start;
  const END_HOUR = hoursConfig.end;

  // 1. Gérer les jours non ouvrables (week-ends configurables ou jours chômés)
  // On boucle d'un jour en un jour jusqu'à trouver un jour ouvrable
  while (!businessDays.includes(date.getDay())) {
    date.setDate(date.getDate() + 1);
    date.setHours(START_HOUR, 0, 0, 0);
  }

  // 2. Gérer les heures de la journée
  const hours = date.getHours();
  if (hours < START_HOUR) {
    date.setHours(START_HOUR, 0, 0, 0);
  } else if (hours >= END_HOUR) {
    // Fin de journée -> avancer au lendemain 8h
    date.setDate(date.getDate() + 1);
    date.setHours(START_HOUR, 0, 0, 0);
    // Ré-appliquer récursivement la vérification (notamment de jour ouvrable)
    adjustToBusinessHours(date, hoursConfig, businessDays);
  }
}
