function looksLikeGenericDayTitle(title: string | null | undefined): boolean {
  const t = normalizeTitre(title);

  return (
    /^jour\s+\d+$/.test(t) ||
    /^jour\s+\d+\s+[a-z ]+$/.test(t) ||
    /^jour\s+\d+\s+rio/.test(t) ||
    /^jour\s+\d+\s+salvador/.test(t) ||
    /^jour\s+\d+\s+paraty/.test(t) ||
    /^jour\s+\d+\s+foz/.test(t) ||
    /^j\s*\d+$/.test(t)
  );
}

function isTransportOnlyDay(items: JourExtrait[]): boolean {
  if (items.length === 0) return false;

  return items.every((item) => looksLikeFlightOrTransferDay(item.titre, item.description));
}

function rebuildProgramTimeline(
  jours: JourExtrait[],
  dateDepart: string | null,
  dateRetour: string | null,
): JourExtrait[] {
  if (jours.length === 0) return [];

  const sortedRaw = [...jours].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

  const withDates = sortedRaw.map((j) => {
    const alignedDate = alignPdfDateToTrip(j.date_jour, dateDepart, dateRetour);

    const computedDate =
      !alignedDate && dateDepart && typeof j.ordre === "number" && j.ordre >= 1
        ? addDaysISO(dateDepart, j.ordre - 1)
        : null;

    return {
      ...j,
      date_jour: alignedDate ?? computedDate,
    };
  });

  const byDate = new Map<string, JourExtrait[]>();
  const undated: JourExtrait[] = [];

  for (const j of withDates) {
    if (isISODate(j.date_jour)) {
      const arr = byDate.get(j.date_jour) ?? [];
      arr.push(j);
      byDate.set(j.date_jour, arr);
    } else {
      undated.push(j);
    }
  }

  const dates: string[] = [];

  if (dateDepart && dateRetour && dateRetour >= dateDepart) {
    const count = diffDaysISO(dateDepart, dateRetour) + 1;

    for (let i = 0; i < count; i++) {
      dates.push(addDaysISO(dateDepart, i));
    }
  } else {
    dates.push(...Array.from(byDate.keys()).sort());
  }

  let currentHotel: string | null = null;
  let currentLieu: string | null = null;

  const rebuilt: JourExtrait[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    const items = (byDate.get(date) ?? []).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

    for (const item of items) {
      const lieu = cityFromTitleOrLieu(item);

      if (lieu && !looksLikeFlightOrTransferDay(item.titre, item.description)) {
        currentLieu = lieu;
      }

      const explicitHotel = clampText(item.hotel_nom);

      if (explicitHotel) {
        currentHotel = explicitHotel;
      }
    }

    if (items.length === 0) {
      rebuilt.push({
        ordre: i + 1,
        titre: makeFreeDayTitle(currentLieu, i + 1),
        lieu: currentLieu,
        date_jour: date,
        description: null,
        hotel_nom: currentHotel,
        inclusions: currentHotel ? ["Hébergement"] : null,
      });

      continue;
    }

    const transportDay = isTransportOnlyDay(items);

    const meaningfulItems = items.filter((item) => {
      if (transportDay) return true;

      return !looksLikeGenericDayTitle(item.titre) || clampText(item.description);
    });

    const primary = meaningfulItems[0] ?? items[0];

    const nonGenericTitles = meaningfulItems
      .map((item) => clampText(item.titre))
      .filter((title): title is string => !!title && !looksLikeGenericDayTitle(title));

    const title = nonGenericTitles.length > 1 ? nonGenericTitles.join(" • ") : (nonGenericTitles[0] ?? primary.titre);

    const explicitLieu = items.map(cityFromTitleOrLieu).find((v) => !!v && v.trim().length > 0) ?? null;

    const lieu = explicitLieu ?? currentLieu;

    const explicitHotel = items.map((item) => clampText(item.hotel_nom)).find(Boolean) ?? null;

    const hotel = explicitHotel ?? currentHotel;

    if (explicitLieu && !looksLikeFlightOrTransferDay(title, primary.description)) {
      currentLieu = explicitLieu;
    }

    if (hotel) {
      currentHotel = hotel;
    }

    rebuilt.push({
      ordre: i + 1,
      titre: title,
      lieu: lieu ?? null,
      date_jour: date,

      description: mergeUniqueStrings(items.map((item) => item.description)),

      hotel_nom: hotel ?? null,

      inclusions: mergeInclusions(items.map((item) => item.inclusions)) ?? (hotel ? ["Hébergement"] : null),
    });
  }

  for (const item of undated) {
    rebuilt.push({
      ...item,
      ordre: rebuilt.length + 1,
      hotel_nom: clampText(item.hotel_nom) ?? currentHotel,
    });
  }

  return rebuilt;
}
