/* =====================================================================
 * Start Work Checks (SWC) and the Last Minute Risk Assessment (LMRA).
 *
 * SWC — done at the job, immediately before work starts, by the person doing
 * the work and confirmed by a second person (verifier). Pick the activity from
 * the dropdown; every safeguard must be in place. Any "No" means STOP.
 * Structure follows the IOGP Life-Saving Rules Start Work Checks and the
 * Shell retail Permit to Work activities.
 *
 * LMRA — the worker's own "Stop · Think · Do" check before any task (free
 * for everyone, no subscription needed).
 * ===================================================================== */

export interface CheckQuestion {
  key: string;
  text: string;
}

export const SWC_COMMON: CheckQuestion[] = [
  { key: 'permit', text: 'The approved permit (PTW / WCF) for this job is at the work site and I have read it' },
  { key: 'scope', text: 'The work matches the scope on the permit — nothing has been added or changed' },
  { key: 'tbt', text: 'Everyone on the job attended the toolbox talk and understands the hazards and controls (JHA)' },
  { key: 'competent', text: 'Everyone doing the work is trained and competent for this activity' },
  { key: 'ppe', text: 'Correct PPE is worn and in good condition (FR coveralls, safety shoes, helmet, glasses, gloves as required)' },
  { key: 'barriers', text: 'The work area is barricaded and signed; customers and the public are kept out' },
  { key: 'simops', text: 'No conflicting activity nearby (fuel delivery, other permits, vehicle movements) — or it is controlled' },
  { key: 'emergency', text: 'Fire extinguisher and spill kit are at hand; everyone knows the emergency stop, muster point and numbers (9991 / 9999)' },
];

export const SWC_ACTIVITIES: { key: string; label: string; questions: CheckQuestion[] }[] = [
  {
    key: 'HOT_WORK', label: 'Hot work (welding, cutting, grinding)', questions: [
      { key: 'gas', text: 'Gas test done by an Authorised Gas Tester and the result is recorded on the permit (0% LEL)' },
      { key: 'sources', text: 'Fuel sources isolated, drains and tank openings covered, flammables removed within 15 m' },
      { key: 'firewatch', text: 'A fire watch is in place with an extinguisher for the whole job and 30 minutes after' },
      { key: 'regas', text: 'Re-testing interval for gas is known and will be followed' },
    ],
  },
  {
    key: 'HEIGHT', label: 'Working at height (canopy, signage, roof)', questions: [
      { key: 'access', text: 'Scaffold / tower / MEWP is inspected and tagged, or the ladder is in good condition and secured' },
      { key: 'fall', text: 'Fall protection is in place: guardrails, or a full-body harness clipped to a rated anchor' },
      { key: 'objects', text: 'Tools are tethered and the area below is barricaded against falling objects' },
      { key: 'rescue', text: 'A rescue plan is in place and the rescue equipment is at site' },
      { key: 'weather', text: 'Wind and weather are within limits for the job' },
    ],
  },
  {
    key: 'CONFINED', label: 'Confined space entry (tanks, chambers, interceptors)', questions: [
      { key: 'isolated', text: 'The space is isolated (lines blinded / disconnected, energy locked out) and ventilated' },
      { key: 'gas', text: 'Atmosphere tested (O₂, LEL, H₂S, CO) by an Authorised Gas Tester, with continuous monitoring' },
      { key: 'attendant', text: 'A trained attendant is at the entry point for the whole entry, with an entry log' },
      { key: 'rescue', text: 'Rescue plan and rescue equipment (tripod, harness, breathing apparatus) are at the entry' },
    ],
  },
  {
    key: 'ISOLATION', label: 'Energy isolation (lock-out / tag-out)', questions: [
      { key: 'points', text: 'All isolation points listed on the isolation certificate have been isolated' },
      { key: 'locks', text: 'Every worker has applied their personal lock and tag' },
      { key: 'zero', text: 'Zero energy has been proven (try-start, voltage test, pressure released, lines drained)' },
    ],
  },
  {
    key: 'EXCAVATION', label: 'Excavation / ground disturbance', questions: [
      { key: 'services', text: 'Underground services and fuel lines are located and marked (drawings + cable detector)' },
      { key: 'protect', text: 'Sides are shored, benched or battered, and spoil is kept at least 1 m back from the edge' },
      { key: 'edge', text: 'Edge protection, safe access / egress and lighting are in place' },
      { key: 'gas', text: 'Gas test done if the excavation is near tanks or fuel lines' },
    ],
  },
  {
    key: 'LIFTING', label: 'Lifting and rigging', questions: [
      { key: 'plan', text: 'A lift plan is approved and the load weight is known' },
      { key: 'equipment', text: 'Crane and lifting gear are certified, inspected and within their safe working load' },
      { key: 'zone', text: 'Exclusion zone is set; nobody stands under the load; overhead lines are clear' },
      { key: 'banksman', text: 'A competent rigger / banksman is directing the lift' },
    ],
  },
  {
    key: 'ELECTRICAL', label: 'Electrical work (de-energised)', questions: [
      { key: 'ap', text: 'The work is authorised by the Authorised Person (AP) and done by a Competent Electrical Person (CEP)' },
      { key: 'dead', text: 'The circuit is isolated, locked and proven dead with a tested voltage detector' },
      { key: 'exzone', text: 'Equipment used in hazardous zones is Ex-rated, or the area is gas-free' },
    ],
  },
  {
    key: 'LIVE_ELECTRICAL', label: 'Live electrical work (only when isolation is not possible)', questions: [
      { key: 'justified', text: 'Live work is justified and specifically approved on the permit' },
      { key: 'tools', text: 'Insulated tools, arc-rated PPE and insulating mats are used' },
      { key: 'second', text: 'A second competent person is present and can isolate and give first aid' },
    ],
  },
  {
    key: 'FUEL_SYSTEM', label: 'Opening the fuel system (tanks, pipework, dispensers)', questions: [
      { key: 'drained', text: 'Product is drained / pumped out and the line or tank is isolated' },
      { key: 'vapour', text: 'Vapour is controlled and a gas test confirms a safe atmosphere' },
      { key: 'ignition', text: 'Ignition sources are removed; non-sparking tools and anti-static measures are used' },
      { key: 'spill', text: 'Drip trays and spill kit are in place; drains are protected' },
    ],
  },
  {
    key: 'GENERAL', label: 'General maintenance on the forecourt', questions: [
      { key: 'zone', text: 'The hazardous area zone of the work location is known and the right equipment is used' },
      { key: 'traffic', text: 'Vehicle traffic is controlled with cones / barriers and a banksman if needed' },
    ],
  },
];

export function swcQuestions(activity: string): CheckQuestion[] {
  const a = SWC_ACTIVITIES.find((x) => x.key === activity);
  return [...SWC_COMMON, ...(a?.questions ?? [])];
}
export const activityLabel = (key?: string) => SWC_ACTIVITIES.find((a) => a.key === key)?.label ?? key ?? '';

export const LMRA_QUESTIONS: CheckQuestion[] = [
  { key: 'job', text: 'I know exactly what I am going to do and how to do it safely' },
  { key: 'same', text: 'The job and the work area are as planned — nothing has changed' },
  { key: 'hazards', text: 'I have looked around for hazards: fuel and vapour, traffic, heat, height, electricity, slips and trips' },
  { key: 'controls', text: 'There is a control in place for every hazard I found' },
  { key: 'tools', text: 'I have the right tools, equipment and PPE, and they are in good condition' },
  { key: 'others', text: 'Customers, colleagues and drivers around me are protected from my work' },
  { key: 'fit', text: 'I am fit, alert and trained for this job' },
  { key: 'emergency', text: 'I know what to do and who to call if something goes wrong (9991 / 9999)' },
];

export type Answer = 'YES' | 'NO' | 'NA';
/** Any "No" means the work must not start. */
export const outcomeOf = (answers: Record<string, Answer>, keys: string[]): 'SAFE_TO_START' | 'STOPPED' =>
  keys.every((k) => answers[k] === 'YES' || answers[k] === 'NA') ? 'SAFE_TO_START' : 'STOPPED';
export const complete = (answers: Record<string, Answer>, keys: string[]) => keys.every((k) => !!answers[k]);
