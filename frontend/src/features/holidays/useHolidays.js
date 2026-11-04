import { useEffect, useState } from "react";
import { holidays as holidaysApi } from "../../shared/lib/api.js";

/* Holidays for a year as { "YYYY-MM-DD": [holiday, ...] }, limited to the categories switched on */
export function useHolidays(year, toggles, refresh = 0) {
  const [holidays, setHolidays] = useState({});
  const { federal, observance, religious } = toggles;

  useEffect(() => {
    const categories = [];
    if (federal) categories.push("federal");
    if (observance) categories.push("observance");
    if (religious) categories.push("religious");

    if (categories.length === 0) {
      setHolidays({});
      return;
    }

    holidaysApi.forYear(year, categories)
      .then(list => {
        const byDate = {};
        for (const h of list) (byDate[h.date] ??= []).push(h);
        setHolidays(byDate);
      })
      .catch(err => console.error("Failed to load holidays:", err));
  }, [year, federal, observance, religious, refresh]);

  return holidays;
}
