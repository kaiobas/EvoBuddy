import { useCallback } from "react";
import { createTour, TOUR_DONE_KEY } from "../lib/tour";

export function useTour() {
  const hasDoneTour = localStorage.getItem(TOUR_DONE_KEY) === "true";

  const startTour = useCallback(() => {
    const tourInstance = createTour();
    tourInstance.drive();
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_DONE_KEY);
    const tourInstance = createTour();
    tourInstance.drive();
  }, []);

  return { startTour, resetTour, hasDoneTour };
}
