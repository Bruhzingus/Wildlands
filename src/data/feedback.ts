/** Small presentation-only impacts. Seconds use real active time, never simulation speed. */
export const IMPACT_FEEDBACK = {
 special:{shakeSeconds:.16,amplitude:.075,stopSeconds:.03},
 boss:{shakeSeconds:.19,amplitude:.095,stopSeconds:.04},
 // A special hitting several targets, or a boss ring hitting several allies, is one impact.
 cooldownSeconds:.2,
 maxOffset:.1,
 maxStopSeconds:.045,
} as const;
