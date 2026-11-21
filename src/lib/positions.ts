/**
 * Positions people pick from on their profile, so job titles stay consistent
 * (no made-up positions). Grouped for the dropdown.
 */
export const POSITION_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Management & supervision', items: ['Project Manager', 'Site Manager', 'Site Engineer', 'Site Supervisor', 'Foreman', 'Station Manager'] },
  { group: 'HSSE', items: ['HSE Manager', 'HSE Officer', 'HSE Supervisor', 'Authorized Gas Tester', 'Fire Watch', 'First Aider'] },
  { group: 'Electrical & instruments', items: ['Electrical Engineer', 'Electrician', 'Electrical Technician', 'Instrument Technician', 'Pump / Dispenser Technician'] },
  { group: 'Mechanical & civil', items: ['Mechanical Technician', 'Welder', 'Fabricator', 'Fitter', 'Plumber', 'Mason', 'Carpenter', 'Painter', 'Scaffolder'] },
  { group: 'Lifting & equipment', items: ['Rigger', 'Banksman / Signalman', 'Crane Operator', 'Heavy Equipment Operator'] },
  { group: 'Driving & logistics', items: ['Driver', 'Tanker Driver', 'Storekeeper'] },
  { group: 'General', items: ['Helper / Labourer', 'Station Attendant', 'Cleaner', 'Administration'] },
];

export const POSITIONS = POSITION_GROUPS.flatMap((g) => g.items);
