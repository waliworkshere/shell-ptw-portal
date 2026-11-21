/**
 * Pre-job checklists, worded as on the contractors' paper forms in the
 * permit packs (PPE, hand tools, first aid, fire, work at height, LOTO).
 */
export interface ChecklistDef {
  key: string;
  title: string;
  /** Header label for the person, as printed on the form. */
  byLabel?: string;
  items: string[];
  notes?: string[];
}

export const CHECKLISTS: ChecklistDef[] = [
  {
    key: 'PPE',
    title: 'PPE inspection checklist',
    items: [
      'Has the PPE appropriateness and adequacy been reviewed and found in order?',
      'Are all personnel wearing safety helmets and safety shoes in the red zone?',
      'Are personnel aware of the need to use PPE?',
      'Does all PPE provided to personnel conform to the relevant standards?',
      'Are employees working at height wearing full body harnesses hooked on to an appropriate anchor point with an appropriate connection device?',
      'Is all PPE inspected for damage before every use?',
      'Are all welders wearing a welding helmet and welder’s gloves?',
      'Are steel fixers and workers handling materials wearing chrome leather / canvas gloves?',
      'Is the electrician wearing electrically rated rubber gloves?',
      'Are workers wearing safety shoes with their foot fully inside the shoe (not wearing the rear portion folded)?',
      'Are there knots in life lines and lanyards?',
    ],
  },
  {
    key: 'TOOLS',
    title: 'Portable electrical & hand tools inspection checklist',
    items: [
      'Are proper tools being used for the job?',
      'Are damaged tools repaired or replaced promptly?',
      'Is there proper earthing for portable electrical tools, or are the tools double insulated?',
      'Are electrical cords free of joints?',
      'Do all hand tools have proper handles?',
      'Is regular testing of portable power tools carried out to ensure there is no earth leakage?',
      'Is appropriate PPE worn while using portable / hand tools?',
      'Are electrical tools pulled out from plugs by yanking the cords instead of the plugs?',
      'Is the right tool used for the right job?',
    ],
  },
  {
    key: 'FIRST_AID',
    title: 'First aid inspection checklist',
    items: [
      'Are first aid facilities, equipment, supplies and personnel available whenever site work is carried out?',
      'Are the people responsible for the first aid programme trained?',
      'Are emergency first aid training and facilities provided when a first aider is available?',
      'Are facilities available to transport the injured to hospital (standby vehicle and phone)?',
      'Does the first aid kit contain all the required items?',
      'Is the first aider aware of the potential injuries and the first aid treatment to give?',
      'Is someone responsible for maintaining (replenishing) the first aid box contents?',
    ],
  },
  {
    key: 'FIRE',
    title: 'Fire prevention & protection checklist',
    items: [
      'Are portable fire extinguishers available at site, manufactured to local standards?',
      'Are the required fire extinguishers available at site (DCP 10 kg – 2, CO₂ 2–5 kg – 1, or as required for the job)?',
      'Is a DCP extinguisher kept near welding / gas cutting areas?',
      'Are workers trained in selecting and using fire extinguishers?',
      'Are all potential fire sources and the type of extinguisher needed identified?',
      'Are portable fire extinguishers inspected as required?',
    ],
  },
  {
    key: 'WAH',
    title: 'Work at height inspection checklist',
    items: [
      'Have personnel had a toolbox talk on the safe work procedures?',
      'Has a communication system for work and emergency response been set up and explained to all work personnel?',
      'Is adequate lighting provided at the workplace?',
      'Was the workplace inspected before starting the job?',
      'Has the area below the work been barricaded at least 1.2 m from the base, especially if hot work is carried out?',
      'Do all personnel have a means of carrying tools to height so both hands are free when accessing the work area?',
      'Are hand tools secured in place?',
      'Are all work platforms of adequate strength and ergonomically suitable?',
      'Is work at more than one level in the same section of the scaffold prohibited?',
      'Are walkways provided with handrails?',
      'Are internal ladders inspected and maintained in good condition?',
      'Are internal ladders angled for access (1:4) rather than vertical?',
      'Are internal ladders secured to prevent slipping, sliding or falling?',
      'Are built-up ladders made of sound materials?',
      'Are metal ladders kept away from electrical hazards?',
      'Are landings provided with handrails, mid-rails and toe boards?',
      'Canopy work: are all workers wearing a full body harness with double lanyards and energy absorber when outside scaffold protection?',
      'Canopy work: is a horizontal life line (16 mm PP / 14 mm polyamide / 8 mm steel wire rope) provided for movement on the canopy?',
      'Has a competent person inspected the PPE, anchor posts and life lines before work at height starts?',
      'Is a work at height permit in place?',
      'Have crawler boards been used on fragile roofs?',
      'Have the user and supervisor inspected all fall protection devices and found them fit for use?',
    ],
    notes: [
      'Work from a certified mobile scaffold with a fully boarded platform and guard rails all round is acceptable fall prevention; other fall protection is then not needed.',
      'A harness lanyard must be secured to an anchor point able to withstand at least 2,300 kg of force.',
    ],
  },
  {
    key: 'LOTO',
    title: 'Lock-out / tag-out (LOTO) checklist',
    byLabel: 'Prepared by',
    items: [
      'Lock: a locking device is placed on the energy isolation device so the equipment cannot be operated until it is removed.',
      'Tag: a tag is placed on the energy isolation device to show the equipment may not be operated.',
      'Test: the energy source has been tried out to confirm there is no energy present.',
      'Equipment was shut down in the proper sequence using normal shutdown procedures.',
      'The machine is shut down before adjustment or repair.',
      'Wait until it stops.',
      'Elevated rams and other mechanisms are blocked so they cannot operate.',
      'Air and hydraulic pressure lines are blocked.',
      'The main switch is locked out.',
      'A tag with your name, the date and the reason the equipment is out of service is attached.',
      'All sources of energy supplying the equipment have been identified.',
      'All correct isolation points have been identified.',
      'Permission to isolate has been given.',
      'Locked off with a unique padlock.',
      'Only you have the key.',
      'You keep the key with you at all times.',
      'Isolation points are tagged with warning signs.',
    ],
  },
];

export const TBT_KEY = 'TBT';
export const CHECKLIST_LABEL: Record<string, string> = Object.fromEntries([...CHECKLISTS.map((c) => [c.key, c.title]), [TBT_KEY, 'Toolbox talk record']]);
export const checklistDef = (key?: string) => CHECKLISTS.find((c) => c.key === key);
