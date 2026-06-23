import { useState, useCallback } from "react";
import { createTour, TOUR_DONE_KEY } from "../lib/tour";

export function useTour() {
  const [hasDoneTour, setHasDoneTour] = useState(
    () => localStorage.getItem(TOUR_DONE_KEY) === "true"
  );

  const startTour = useCallback(() => {
    const tourInstance = createTour(() => setHasDoneTour(true));
    tourInstance.drive();
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_DONE_KEY);
    setHasDoneTour(false);
    const tourInstance = createTour(() => setHasDoneTour(true));
    tourInstance.drive();
  }, []);

  return { startTour, resetTour, hasDoneTour };
}
