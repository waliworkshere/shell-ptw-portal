/* =====================================================================
 * Start Work Checks (SWC) and the Last Minute Risk Assessment (LMRA).
 *
 * SWC — word for word from the 10 Shell "Start-Work Checks" forms
 * (Save Your Life Actions). Each action is initialled by the person(s)
 * performing the work AND by the Start-Work Verifier. "Stop and seek help if
 * any of the above safeguards are not in place." The "How to (examples)"
 * page of each form is shown as guidance under every action, and the form's
 * numbered illustration is shown next to the checklist.
 *
 * LMRA — the picture form "Last Minute Risk Assessment": four rows of seven
 * pictures (energy release, PPE, tool use, your position). Free for everyone.
 * ===================================================================== */

export interface CheckQuestion {
  key: string;
  text: string;
}

/** A Yes / No question printed inside an action (e.g. "Does Confined Space Entry require IHE?"). */
export interface SwcChoice {
  question: string;
  yes: string;
  no?: string;
  /** Answering Yes adds this activity's Start-Work Checks to the same check. */
  addActivity?: string;
}

export interface SwcItem {
  n: number;
  key: string;
  text: string;
  /** Lines printed under the action on the form (sub-points, limits). */
  details?: string[];
  choice?: SwcChoice;
  /** Gas readings are recorded for "The atmosphere is within allowed limits…". */
  gas?: boolean;
  howTo: string[];
}

export interface SwcSection {
  title?: string;
  /** Printed hold point before this section (Excavation). */
  holdPoint?: string;
  items: SwcItem[];
}

export interface SwcForm {
  key: string;
  label: string;
  /** Title as printed on the form after "Start-Work Checks |". */
  title: string;
  image: string;
  doc: string;
  sections: SwcSection[];
}

const IMG = (f: string) => `/training/swc/${f}.jpg`;
const DOC = (f: string) => `/docs/swc/start-work-checks-${f}.docx`;

export const GAS_LIMITS = { o2: [19.5, 23.5] as const, lel: 10, h2s: 5 };

export const SWC_FORMS: SwcForm[] = [
  {
    key: 'HEIGHT', label: 'Working at Heights', title: 'Working at Heights', image: IMG('working-at-heights'), doc: DOC('working-at-heights'),
    sections: [{ items: [
      { n: 1, key: 'h1', text: 'Fall protection equipment (fall arrest and fall restraint) is certified, inspected and rated for the task.', howTo: [
        'Check every strap, buckle, fitting and/or grommet for signs of wear.',
        'Destroy fall protection equipment if the inspection shows evidence of excessive wear/damage or a mechanical malfunction.',
        'Confirm fall protection equipment has been inspected and certified within the past 2 years.',
        'Note: Fall arrest contains a self-retracting lifeline and is a system designed to support and hold a person in the event of a fall. Fall restraint contains a fixed lifeline that prevents workers from falling.',
      ] },
      { n: 2, key: 'h2', text: 'Rescue plan has been reviewed with work crew and rescue equipment is available.', howTo: [
        'Confirm the crew has discussed the rescue plan, including: how to contact responders; location of rescue equipment and responders.',
      ] },
      { n: 3, key: 'h3', text: 'Fall protection equipment is adjusted to fit the worker.', howTo: [
        'Confirm only full body harnesses are used (use of body belts is not allowed).',
        'Confirm crew are wearing PPE properly: straps are not twisted; body straps are adjusted for correct fit.',
      ] },
      { n: 4, key: 'h4', text: 'Work crew agreed to be 100% tied off to the identified, approved anchorage point(s).', howTo: [
        'Confirm the anchor point selected has been approved by a Competent Person (for reference the anchor point must withstand a 22.2 kilonewtons [5,000 lb force]).',
        'Pull on lanyard to test if attachment is secure.',
        'Confirm the worker will not be placed in a fall path that contains hazards.',
        'Confirm the workers know they must be 100% tied off at all times (e.g., at least one hook must be anchored at all times).',
      ] },
      { n: 5, key: 'h5', text: 'Fall path is clear of obstructions or mitigations have been implemented to address hazards.', howTo: [
        'Measure the potential fall distance and ensure fall arrest is shorter than the fall distance.',
        'If obstructions are in the fall path, mitigate the obstructions. If obstructions cannot be mitigated, select fall restraint protection equipment.',
      ] },
      { n: 6, key: 'h6', text: 'Potential dropped objects have been identified and mitigated.', howTo: [
        'Perform a potential dropped object review and erect barricades as necessary to provide protection to workers in the area.',
        'Where possible, use debris nets, lanyards, etc., to prevent objects from falling to grade below.',
      ] },
      { n: 7, key: 'h7', text: 'Work crew has agreed that no team member will work at height alone.', howTo: [
        'Confirm someone on the crew has been assigned to be a standby/spotter.',
      ] },
    ] }],
  },
  {
    key: 'DEMOLITION', label: 'Decommissioning & Demolition', title: 'Decommissioning & Demolition', image: IMG('decommissioning-demolition'), doc: DOC('decommissioning-demolition'),
    sections: [{ items: [
      { n: 1, key: 'd1', text: 'Equipment to be demolished is emptied/cleared of hazardous materials.', howTo: ['(e.g. hydrocarbons, chemicals, contaminants, NORM, etc.)'] },
      { n: 2, key: 'd2', text: 'All energy sources are identified, isolated and marked / colour coded.', howTo: ['(e.g. electrical, pressure, gravity, etc.)'] },
      { n: 3, key: 'd3', text: 'Equipment that may have stored energy is identified and marked.', howTo: ['(e.g. spring-loaded equipment, bent or obstructed materials, valves, pipe, suspensions, loading arms)'] },
      { n: 4, key: 'd4', text: 'Safe areas, out of the line of fire are identified, with barriers in place where practical.', howTo: ['Unforeseen equipment, materials movement.'] },
      { n: 5, key: 'd5', text: 'Work area is assessed for potential dropped or unsecure objects, and potential objects have been removed or secured.', howTo: ['Objects that may become loose / unsecure during the demolition process and have the potential to cause harm.'] },
      { n: 6, key: 'd6', text: 'Residual contaminants have been identified, and appropriate PPE and work methods provided.', howTo: ["(e.g. Lead, Asbestos, PCB's, etc.)"] },
    ] }],
  },
  {
    key: 'HOT_WORK', label: 'Hot Work', title: 'Hot Work', image: IMG('hot-work'), doc: DOC('hot-work'),
    sections: [
      { title: 'Isolation of Hazardous Energy', items: [
        { n: 1, key: 'hw1', text: 'Hot work has been evaluated for Isolation of Hazardous Energy (IHE) requirements.',
          choice: { question: 'Does hot work require IHE?', yes: 'Complete IHE Start-Work Checks.', no: 'Continue to Step 2.', addActivity: 'ISOLATION' }, howTo: [
          'Confirm all potential energy sources have been identified, isolated, and locked and tagged.',
          'Confirm the system has been flushed, drained or purged to remove explosive materials or gases.',
        ] },
      ] },
      { title: 'Hot Work', items: [
        { n: 2, key: 'hw2', text: 'The atmosphere is within allowed limits for entry.', gas: true, details: ['Oxygen: between 19.5–23.5%', 'LEL: less than 10%', 'H₂S: less than 5 ppm', 'Other gas tested:'], howTo: [
          'Ask Qualified Gas Tester to explain how they know the gas meter is working as designed.',
          'Watch the initial gas testing and confirm results are within acceptable limits.',
          'Confirm Qualified Gas Tester has performed atmospheric testing, including: at all openings below and above the hot work area; at a minimum of 15 meters (50 feet) around the hot work area.',
        ] },
        { n: 3, key: 'hw3', text: 'Gas testing frequency has been established.', howTo: [
          'Confirm follow-up frequency has been established by reviewing the Hot Work Permit/Certificate.',
          'Confirm that no more than 30 minutes will pass after the initial gas testing before starting hot work.',
        ] },
        { n: 4, key: 'hw4', text: 'Drains, openings and vents are sealed.', howTo: [
          'Look for drains within the hot work area and verify they are sealed and/or covered.',
          'Look for vents within the hot work area and verify they are routed away from the work area or are isolated.',
          'Walk surrounding area to identify gaps and openings in tanks or piping and verify they are sealed.',
        ] },
        { n: 5, key: 'hw5', text: 'All combustible materials have been removed, covered or drenched.', howTo: [
          'Walk the surrounding 15 meters (50 feet) area and ensure all combustible materials have been removed or that measures are in place to either cover them, shield them or keep them wet.',
        ] },
        { n: 6, key: 'hw6', text: 'Firefighting equipment has been inspected and is at hot work site.', howTo: [
          'Review the hot work certificate and confirm the firefighting equipment listed is on site and inspected to ensure it is fully functional.',
        ] },
        { n: 7, key: 'hw7', text: 'Heat, slag or sparks will be contained.', howTo: [
          'Confirm fire blankets are used to cover combustible materials.',
          'Confirm barriers are in place to prevent sparks from reaching a potential source.',
        ] },
        { n: 8, key: 'hw8', text: 'Dedicated Fire Watch is in place.', howTo: ['Confirm a Fire Watch has been designated and is on-site.'] },
      ] },
    ],
  },
  {
    key: 'EXCAVATION', label: 'Excavation', title: 'Excavation', image: IMG('excavation'), doc: DOC('excavation'),
    sections: [
      { items: [
        { n: 1, key: 'e1', text: 'Underground utilities are visibly marked (e.g., pipelines, cables, communications, power).', howTo: [
          'Confirm local utilities have been notified of the dig so they can identify their lines (e.g., One-Call).',
          'Confirm underground utilities are visibly identified with flagging or paint.',
          'Confirm depth and width of pipeline are known before digging, or non-mechanical means are used to find lines.',
        ] },
        { n: 2, key: 'e2', text: 'Excavation equipment maintains minimum clearances from overhead obstructions.', howTo: [
          'Ask crew members if they know the exact location, height and voltage of overhead power lines.',
          'Applying the overhead power line proximity calculation (load length + equipment height + at least 10 feet),',
          'Using goal posting barriers on overhead power lines or',
          'Maintaining a minimum of 6 meters (20 feet) distance between equipment and energy source for unknown voltages.',
        ] },
        { n: 3, key: 'e3', text: 'Excavation area is secured and barriers are in place to prevent unauthorised access.', howTo: [
          'Confirm excavation area is visibly identified with caution tape, silt fencing or other visual identification.',
          'Confirm excavation site is secure from unauthorised access.',
          'Confirm a competent person assessed the soil type to define the excavation.',
          'Confirm no personnel are in line-of-fire hazards (e.g., swing radius, discharge side of trencher).',
          'Confirm personnel will not be allowed to enter or occupy excavations while heavy equipment is digging.',
          'Confirm essential personnel in the crew who need to be in the area.',
        ] },
      ] },
      { holdPoint: 'Hold Point: Continue if personnel enter excavation', items: [
        { n: 4, key: 'e4', text: 'Excavation has been evaluated to determine if it is a confined space.',
          choice: { question: 'Is Excavation a Confined Space?', yes: 'Complete Confined Space Entry Start-Work Checks.', no: 'Continue to Step 5.', addActivity: 'CONFINED' }, howTo: [
          'Confirm the excavation area has been evaluated to determine if it is a confined space (trench depths greater than or equal to 1.2 meters or 4 feet with vertical walls and limited access/egress).',
          'If the excavation area is a confined space follow the CSE standard and complete the CSE Start-Work Check.',
        ] },
        { n: 5, key: 'e5', text: 'Plan is in place to protect personnel entering the excavation from:', details: ['a. Cave in;', 'b. Hazardous atmosphere; and', 'c. Water accumulation.'], howTo: [
          'Cave in — Protective systems include but are not limited to bracing, shoring, underpinning, benching, retaining devices or shield systems. Confirm daily inspection to identify hazards and changing conditions will be performed. Assure crew will report collapse, contamination, water build up or utilities encountered.',
          'Hazardous atmosphere — Ask for gas testing if you have unexpected odors, leaks or equipment. Ask Qualified Gas Tester to explain how they know the gas meter is working as designed. Watch initial gas testing and confirm results on meter are within acceptable limits. Confirm that follow-up frequency is documented on permit prior to starting work. Confirm that no more than 30 minutes will pass after the initial gas testing before starting work. Confirm Qualified Gas Tester has tested for stratified atmospheres.',
          'Water accumulation — Confirm crew will conduct daily inspection to identify hazards and changing conditions.',
        ] },
        { n: 6, key: 'e6', text: 'Excavations deeper than 1.2 meters (4 feet) have access and egress.', howTo: [
          'Confirm there is a safe means of access and egress when entering an excavation greater than 1.2 meters (4 feet) in depth, up to 7.6 meters (25 feet) of lateral travel.',
          'Examples are ladder, stairways, ramps, sloping for ingress/egress.',
        ] },
      ] },
    ],
  },
  {
    key: 'CONFINED', label: 'Confined Space Entry', title: 'Confined Space Entry', image: IMG('confined-space-entry'), doc: DOC('confined-space-entry'),
    sections: [
      { title: 'Isolation of Hazardous Energy', items: [
        { n: 1, key: 'c1', text: 'Confined Space Entry has been evaluated for Isolation of Hazardous Energy (IHE) requirements.',
          choice: { question: 'Does Confined Space Entry require IHE?', yes: 'Complete IHE Start-Work Checks.', no: 'Continue to Step 2.', addActivity: 'ISOLATION' }, howTo: [
          'Physically inspect job site using isolation diagrams, P&IDs or Process Flow Diagrams to identify potential hazardous material and energy sources.',
          'Evaluate if confined space has the potential to contain actual or potential hazardous atmospheres.',
          'Evaluate if confined space requires lockout/tagout to eliminate actual or potential hazards.',
          'Confirm confined space is isolated from other equipment, piping, etc., using approved methods (e.g., isolation blinds).',
        ] },
      ] },
      { title: 'Prior to Confined Space Entry', items: [
        { n: 2, key: 'c2', text: 'The atmosphere is within allowed limits for entry.', gas: true, details: ['Oxygen: between 19.5–23.5%', 'LEL: less than 10%', 'H₂S: less than 5 ppm', 'Other gas tested:'], howTo: [
          'Ask Qualified Gas Tester to explain how they know the gas meter is working as designed.',
          'Watch initial gas testing and confirm results on meter are within acceptable limits.',
          'Confirm Qualified Gas Tester has tested for stratified atmospheres.',
        ] },
        { n: 3, key: 'c3', text: 'Gas testing frequency has been established.', howTo: [
          'Ask gas tester to explain follow up frequency and confirm follow up frequency is documented on permit prior to starting work.',
          'Confirm no more than 30 minutes will pass after the initial gas testing before starting work.',
        ] },
        { n: 4, key: 'c4', text: 'Ventilation is in place and working.', howTo: [
          'Confirm confined space is ventilated (natural and/or mechanical) to dilute the air from containing dust, fumes, mist, vapors, gases, heat etc.',
          'If using mechanical ventilation, confirm the flexible ducting is arranged so there are no dead spaces.',
          'Confirm ventilation will be continuous.',
          'Confirm mechanical ventilation equipment is bonded and/or grounded to prevent static electricity hazards.',
          'Confirm ventilation exhaust outlets are not near an ignition source and will not draw exhausted air back into the space.',
          'Confirm ventilation inlets will not be affected by wind/weather conditions and will not have flow restrictions.',
        ] },
        { n: 5, key: 'c5', text: 'Entry watch has been assigned and communication plan agreed to.', howTo: [
          'Confirm an entry watch has been assigned and is at the job site.',
          'Ask the entry watch to describe their responsibilities, which include: visually monitoring personnel in the confined space; documenting entry and exits from the confined space; monitoring the confined space for changing conditions.',
          'Discuss communication plan with entry watch prior to entry.',
          'Confirm communication strategy has been agreed to (e.g., hand signals, radio).',
        ] },
        { n: 6, key: 'c6', text: 'All entrants are wearing rescue equipment required in rescue plan.', howTo: [
          'Confirm the rescue plan is at the job site and has been shared with the crew.',
          'Confirm the crew are wearing the rescue equipment as described in the rescue plan (e.g., harnesses, retrieval device).',
        ] },
      ] },
    ],
  },
  {
    key: 'ELECTRICAL', label: 'De-Energised Electrical Work', title: 'De-Energised Electrical Work', image: IMG('de-energised-electrical'), doc: DOC('de-energised-electrical'),
    sections: [{ items: [
      { n: 1, key: 'de1', text: 'Circuit/equipment to be worked on is the one identified in the plan.', howTo: ['Confirm equipment to be worked on is correct using tag numbers or cable markings.'] },
      { n: 2, key: 'de2', text: 'Isolation points are identified per diagram and/or plan.', howTo: ['Use the isolation diagram and/or Equipment Isolation Procedure to physically confirm all isolations are in place and tagged or marked.'] },
      { n: 3, key: 'de3', text: 'Isolation devices are set in the identified position per diagram and/or plan.', howTo: [
        'Confirm all switches are open or closed per the diagram and/or plan.',
        'Confirm Switchgear or Motor Control Center (MCC) equipment switches are locked out and tagged.',
        'Confirm crew has physically inspected the equipment for other potential energy sources not previously identified or isolated.',
      ] },
      { n: 4, key: 'de4', text: 'Electrical components are placed in an electrically safe condition.', howTo: [
        'Wear appropriate level of PPE based on the shock and arc flash risk assessment until the equipment is confirmed to be de-energised.',
        'Conduct a test for absence of voltage.',
        'Confirm grounds have been applied per plan and rated for the fault current.',
      ] },
      { n: 5, key: 'de5', text: 'Isolation points are:', details: ['a. Locked and/or tagged; and', 'b. Keys are controlled by me or my crew supervisor.'], howTo: [
        'Confirm locks, tags or securing devices are on all isolation points.',
        'Confirm keys are in a designated secure location.',
      ] },
      { n: 6, key: 'de6', text: 'Identify and mitigate hazards on adjacent live parts.', howTo: ['If no insulating materials exist, then install temporary insulating materials such as rubber matting or screening.'] },
    ] }],
  },
  {
    key: 'LIVE_ELECTRICAL', label: 'Energised / Live Electrical Work', title: 'Energised / Live Electrical Work', image: IMG('live-electrical'), doc: DOC('live-electrical'),
    sections: [{ items: [
      { n: 1, key: 'le1', text: 'The authorised work scope has been reviewed and agreed to.', howTo: [
        'Review work scope per the approved work permit.',
        'Ask crew to repeat back the work instructions.',
        'Agree to stop work if work scope changes in any way.',
      ] },
      { n: 2, key: 'le2', text: 'Personnel are wearing PPE rated for:', details: ['a. The arc flash per the arc flash hazard analysis.', 'b. The electrical voltage prior to entering the restricted approach boundary.'], howTo: [
        'Ask crew what arc flash or electrical voltage they should be prepared for.',
        'Confirm personnel are wearing PPE rated for the arc flash per the arc flash hazard analysis.',
        'Confirm personnel are wearing PPE rated for the electrical voltage prior to entering the restricted approach boundary.',
      ] },
      { n: 3, key: 'le3', text: 'Circuit/equipment to be worked on is the one identified in the plan.', howTo: ['Confirm equipment to be worked on is correct using tag numbers or cable markings.'] },
      { n: 4, key: 'le4', text: 'Safe work zones have been identified and visually barricaded.', howTo: [
        'Erect barriers to limit access to the work area.',
        'Confirm standby person will monitor the area to keep unauthorised personnel out of the work area.',
      ] },
      { n: 5, key: 'le5', text: 'Electrical standby person has been assigned and emergency response plan has been agreed to.', howTo: [
        'Identify the standby person at the site.',
        'Confirm emergency equipment such as safety hooks, insulated gloves, etc., are at the worksite.',
      ] },
      { n: 6, key: 'le6', text: 'Communication plan with the standby person has been agreed to, including stop work signals.', howTo: [
        'Discuss communication plan with qualified electricians.',
        'Confirm communication plans have been agreed to.',
        'Ask crew to test communication plan.',
      ] },
      { n: 7, key: 'le7', text: 'Insulated tools and testing equipment have been inspected for damage and are rated for the task.', howTo: [
        'Confirm insulating materials such as rubber matting or screening are in place.',
        'If no insulating materials exist, install temporary insulating materials such as rubber matting or screening.',
        'Confirm only insulated tools that have been rated/certified for the equipment’s maximum voltage will be used.',
        'Conduct voltage function test prior to using testing equipment.',
      ] },
    ] }],
  },
  {
    key: 'ISOLATION', label: 'Isolation of Hazardous Energy (De-Energise & Re-Energise)', title: 'Isolation of Hazardous Energy (De-Energise & Re-Energise)', image: IMG('isolation-of-hazardous-energy'), doc: DOC('isolation-of-hazardous-energy'),
    sections: [
      { title: 'De-Energise', items: [
        { n: 1, key: 'i1', text: 'Isolation points are identified per plan and the lines have been walked.', howTo: [
          'Use the Equipment Isolation Procedure, P&IDs, or Process Flow Diagrams to physically confirm all isolations are in place and tagged or marked.',
          'Confirm crew has physically inspected the equipment for other potential energy sources not previously identified or isolated.',
        ] },
        { n: 2, key: 'i2', text: 'Isolation equipment is rated for the energy source.', howTo: ['Confirm blinds, spades and skillets are stamped or certified for the pressure rating of the equipment.'] },
        { n: 3, key: 'i3', text: 'Isolation devices are set in the identified position per diagram and/or plan.', howTo: [
          'Confirm valves are open or closed per plan.',
          'Confirm blinds, spades and skillets are installed per plan.',
          'Confirm switchgear or Motor Control Center (MCC) equipment switches are open and locked out.',
        ] },
        { n: 4, key: 'i4', text: 'Isolations points are:', details: ['a. Locked and tagged; and', 'b. Keys are controlled by me or my crew supervisor.'], howTo: [
          'Confirm locks, tags or securing devices are on isolation points.',
          'Confirm keys are in a designated secure location.',
        ] },
        { n: 5, key: 'i5', text: 'Equipment is de-energised and tested for residual or stored energy.', howTo: [
          'Ask crew/operations to attempt to start up equipment.',
          'Confirm systems (lines, gauges, etc.) have been tested for residual or stored energy by: opening bleed and vent points to release stored energy; pressure testing; air gapping of lines.',
          'Confirm gas testing and atmospheric monitoring will occur when opening piping, equipment, etc.',
        ] },
      ] },
      { title: 'Re-Energise', items: [
        { n: 6, key: 'i6', text: 'Isolation devices are removed per plan.', howTo: [
          'Physically inspect: equipment to confirm scope of work was completed; work area to confirm all mechanical, process and electrical isolations were removed; bleed and vent points to confirm they are closed.',
        ] },
        { n: 7, key: 'i7', text: 'All personnel exposed to energy source have been told equipment is ready to be re-energised.', howTo: ['Ask work crews in and near the work area if they are aware equipment is ready to be re-energised.'] },
        { n: 8, key: 'i8', text: 'Equipment is ready to be put back in service.', howTo: ['Ask work crews in and near the work area if they are aware equipment is ready to be put back in service.'] },
      ] },
    ],
  },
  {
    key: 'LIFTING', label: 'Lifting & Rigging', title: 'Lifting & Rigging', image: IMG('lifting-rigging'), doc: DOC('lifting-rigging'),
    sections: [{ items: [
      { n: 1, key: 'l1', text: 'Written lift plan required?',
        choice: { question: 'Written lift plan required?', yes: 'All workers agreed to follow the written lift plan.' },
        details: ['Note: Written lift plan needed for blind, complex, complicated, heavy and personnel lifts.'], howTo: [
        'Confirm equipment operator and rigger have discussed the written lift plan prior to making a lift.',
        'Confirm additional safeguards required for the following specialised lifts have been documented in the written lift plan and are in place and working: blind lifts; complex lifts; complicated lifts; heavy lifts; personnel lifts.',
      ] },
      { n: 2, key: 'l2', text: 'Equipment operator and rigger are qualified to do the lifting and rigging task.', howTo: ['Review qualification records of crane operator and riggers.'] },
      { n: 3, key: 'l3', text: 'Load weight is within the range of the equipment’s safe working limit.', howTo: [
        'Refer to manufacturer’s load chart for reference.',
        'Ask the equipment operator and rigger to explain how the weight of the load was determined and calculated.',
        'If load chart does not exist, assume equipment is not rated for the lift, stop work and identify alternative lifting equipment that is rated for the load.',
      ] },
      { n: 4, key: 'l4', text: 'Lifting and rigging equipment is certified, inspected and rated for the task.', howTo: [
        'Inspect slings, shackles, cables, etc., for wear/defects.',
        'Confirm the lifting and rigging equipment certifications have not expired.',
        'Complete pre-use check of lifting and rigging equipment.',
        'Confirm equipment has not been altered, modified or field-fabricated.',
      ] },
      { n: 5, key: 'l5', text: 'Lifting and rigging equipment safety devices are in place and working.', howTo: [
        'Complete a pre-use crane inspection and review manufacturer’s recommendations for safety equipment (e.g., emergency shut down equipment, booms, stop, anti-two block, brake, weight indicators and load limiting devices).',
        'Follow the Bypassing Critical Protection standard when lifting and rigging safety devices are bypassed.',
      ] },
      { n: 6, key: 'l6', text: 'Communication plan is agreed by all workers involved.', howTo: [
        'Examples of communication methods: hand signals; radio communications.',
        'Agree on emergency stop signals during pre-job meeting.',
        'Agree on communication methods for blind lifts.',
        'Ask crew to demonstrate communication plan.',
      ] },
      { n: 7, key: 'l7', text: 'Plan is in place to prevent and mitigate:', details: ['Load shifts', 'Dropped objects', 'Load path obstructions', 'Overhead obstructions and power line', 'Working under suspended loads.'], howTo: [
        'Establish exclusion zones considering the cone of exposure/line of fire.',
        'Erect barricades to protect exclusion zone as needed.',
        'Identify and mitigate.',
      ] },
      { n: 8, key: 'l8', text: 'Lifting equipment is stable per manufacturer specifications.', howTo: [
        'Confirm ground is stable and level for the lifting equipment.',
        'Confirm matting is stable and level for the lifting equipment.',
        'Confirm restraints (e.g., hold-down bolts, fasteners) are secure.',
        'Confirm there is enough space for outrigger deployment.',
      ] },
    ] }],
  },
  {
    key: 'VEHICLES', label: 'Heavy Equipment and Vehicle Operations', title: 'Heavy Equipment and Vehicle Operations', image: IMG('heavy-equipment-vehicles'), doc: DOC('heavy-equipment-vehicles'),
    sections: [{ items: [
      { n: 1, key: 'v1', text: 'Controls are in place to segregate pedestrians from mobile equipment and vehicle roadways.', howTo: ['A plan to segregate mobile equipment and vehicle roadways from pedestrians is in place. Personnel involved with the activity understand the plan requirements.'] },
      { n: 2, key: 'v2', text: 'Vehicle / Equipment is properly certified for duty, and daily inspections are completed and recorded.', howTo: [
        'Equipment is certified to regulatory requirements and maintenance is up to date.',
        'Equipment has been inspected in accordance with a quarterly inspection programme.',
        'A daily inspection has been completed and recorded by equipment operator.',
        'Pre-mobilisation survey is conducted for newly hired equipment.',
        'All installed safety devices are working.',
        'Operators check for equipment maintenance / lock-out tags.',
        'Operators check and wear appropriate PPE and restraints including seat belts.',
      ] },
      { n: 3, key: 'v3', text: 'Loads are assessed for stability, securement and capacity for the vehicle / equipment being used.', howTo: ['Loads have been assessed for stability, securing, and capacity compatibility with the equipment that will be used.'] },
      { n: 4, key: 'v4', text: 'An authorised and competent person is assigned to aid in control of vehicle / equipment movement as required (i.e. Flagman, Banksman, Spotter).', howTo: [
        'An authorised and competent person has been assigned to control equipment movement (i.e. flagger).',
        'The flagger and operator have an agreed method of communicating during operation of equipment.',
        'Flagger(s) in control of the equipment movement are easily identified.',
        'Activity supervisors and flaggers are in place to keep people out of the line of fire during equipment movement.',
      ] },
      { n: 5, key: 'v5', text: 'Blind-spots are identified and mitigated, and controls are in place to minimise and manage all equipment and vehicle reversing.', howTo: [
        'Alternatives to reversing have been assessed and eliminated prior to allowing reverse operation of equipment.',
        'Audible warnings are working on equipment for reverse operations.',
        'Flaggers are positioned out of the line of fire and in a position to monitor reversing operations.',
        'Physical barriers are in place in accordance with the activity plan.',
      ] },
      { n: 6, key: 'v6', text: 'Controls are in place to manage proximity of equipment and vehicles from excavations, overhead lines, and underground infrastructure.', howTo: [
        'Equipment should be working at the safe distance established for any excavations.',
        'Equipment should be working at the safe operational distance established for any overhead powerlines.',
        'Equipment should be working at the safe distance established for any underground infrastructure.',
        'Minimum Approach Distances (MAD) in HSSE CF Electrical Safety Guide.',
      ] },
      { n: 7, key: 'v7', text: 'Vehicles / Equipment are positioned with conditions and controls in place to prevent unintentional movement.', howTo: [
        'Equipment is positioned on flat ground where possible and vehicle wheels are chocked when there is potential for movement.',
        'Equipment is positioned in dedicated parking areas, and in accordance with OEM instructions.',
        'Booms, attachments and accessories are lowered or secured to prevent energy release.',
      ] },
    ] }],
  },
];

export const swcForm = (key?: string) => SWC_FORMS.find((f) => f.key === key);

/** Kept for the permit wizard and other screens that only need key + label. */
export const SWC_ACTIVITIES = SWC_FORMS.map((f) => ({ key: f.key, label: f.label }));

/** Older records used these activities before the checks matched the Shell forms word for word. */
const LEGACY_LABELS: Record<string, string> = {
  FUEL_SYSTEM: 'Opening the fuel system (old check)',
  GENERAL: 'General maintenance on the forecourt (old check)',
};
export const activityLabel = (key?: string) => swcForm(key)?.label ?? LEGACY_LABELS[key ?? ''] ?? key ?? '';

/** Every action shown for a check: the chosen form, plus any form added by a Yes answer (IHE, CSE). */
export interface SwcBlock { form: SwcForm; prefix: string; addedBy?: string }
export function swcBlocks(activity: string, choices: Record<string, 'YES' | 'NO'>, prefix = '', depth = 0): SwcBlock[] {
  const form = swcForm(activity);
  if (!form) return [];
  const out: SwcBlock[] = [{ form, prefix }];
  if (depth > 2) return out;
  for (const s of form.sections) for (const it of s.items) {
    const k = prefix + it.key;
    if (it.choice?.addActivity && choices[k] === 'YES') {
      const sub = swcBlocks(it.choice.addActivity, choices, `${k}.`, depth + 1);
      if (sub[0]) sub[0].addedBy = `Step ${it.n} — ${it.choice.yes}`;
      out.push(...sub);
    }
  }
  return out;
}

/** Keys of the actions that must be confirmed, given the Yes/No answers and the excavation hold point. */
export function swcRequiredKeys(activity: string, choices: Record<string, 'YES' | 'NO'>, entersExcavation: boolean): string[] {
  const keys: string[] = [];
  for (const b of swcBlocks(activity, choices)) {
    for (const s of b.form.sections) {
      if (s.holdPoint && !entersExcavation) continue;
      for (const it of s.items) keys.push(b.prefix + it.key);
    }
  }
  return keys;
}

export interface GasReadings { o2?: string; lel?: string; h2s?: string; other?: string }
export function gasProblems(g?: GasReadings): string[] {
  if (!g) return ['Enter the gas readings'];
  const p: string[] = [];
  const o2 = parseFloat(g.o2 ?? ''), lel = parseFloat(g.lel ?? ''), h2s = parseFloat(g.h2s ?? '');
  if (isNaN(o2) || isNaN(lel) || isNaN(h2s)) return ['Enter the Oxygen, LEL and H₂S readings'];
  if (o2 < GAS_LIMITS.o2[0] || o2 > GAS_LIMITS.o2[1]) p.push(`Oxygen ${o2}% is outside 19.5–23.5%`);
  if (lel >= GAS_LIMITS.lel) p.push(`LEL ${lel}% is not less than 10%`);
  if (h2s >= GAS_LIMITS.h2s) p.push(`H₂S ${h2s} ppm is not less than 5 ppm`);
  return p;
}

export const initialsOf = (name?: string) =>
  (name ?? '').trim().split(/\s+/).filter(Boolean).filter((w) => !/^(al|el|bin|bint)$/i.test(w)).map((w) => w[0]!.toUpperCase()).slice(0, 3).join('');

/* ----------------------------- LMRA ---------------------------------- */

export interface LmraPicture { key: string; label: string; img: string }
export interface LmraRow { title: string; pictures: LmraPicture[] }

const P = (key: string, label: string, file: string): LmraPicture => ({ key, label, img: `/training/lmra/${file}.jpg` });

/** The four rows of the "Last Minute Risk Assessment" picture form, left to right. */
export const LMRA_ROWS: LmraRow[] = [
  { title: 'Check for Accidental Energy release', pictures: [
    P('en_valve', 'Valves and pressure lines closed and isolated', '1-1-valve'),
    P('en_fuel', 'Fuel and vapour release controlled', '1-2-fuel-vapour'),
    P('en_elec', 'Electrical panel isolated and locked', '1-3-electrical-panel'),
    P('en_shock', 'No live wires or electric shock risk', '1-4-heat'),
    P('en_chem', 'Chemicals identified and contained', '1-5-chemicals'),
    P('en_start', 'Engine / equipment cannot be started', '1-6-emergency-stop'),
    P('en_chock', 'Vehicle wheels chocked — no movement', '1-7-wheel-chock'),
  ] },
  { title: 'Check for proper PPE', pictures: [
    P('ppe_helmet', 'Safety helmet', '2-1-helmet'),
    P('ppe_shoes', 'Safety shoes', '2-2-safety-shoes'),
    P('ppe_vest', 'High-visibility vest and coverall', '2-3-vest-coverall'),
    P('ppe_gloves', 'Gloves', '2-4-gloves'),
    P('ppe_harness', 'Full body harness', '2-5-harness'),
    P('ppe_resp', 'Respirator / dust mask', '2-6-respirator'),
    P('ppe_eyes', 'Safety glasses / face shield', '2-7-glasses-faceshield'),
  ] },
  { title: 'Check for Proper Tool Use', pictures: [
    P('tool_rcd', 'Earth leakage protection (RCD) in place', '3-1-rcd'),
    P('tool_guard', 'Guards fitted on power tools', '3-2-tool-guard'),
    P('tool_insul', 'Insulated tools in good condition', '3-3-insulated-tools'),
    P('tool_ex', 'Ex-rated equipment in hazardous areas', '3-4-ex-rated'),
    P('tool_right', 'Right tool for the job', '3-5-right-tool'),
    P('tool_cable', 'Cables and plugs undamaged', '3-6-cable'),
    P('tool_trip', 'No trailing cables or trip hazards', '3-7-trip'),
  ] },
  { title: 'Check your position', pictures: [
    P('pos_barr', 'Openings and work area barricaded', '4-1-barricade'),
    P('pos_gas', 'Gas tested and monitored', '4-2-gas-detector'),
    P('pos_scaf', 'Scaffold / tower tagged and wheels locked', '4-3-scaffold-tower'),
    P('pos_ladder', 'Ladder secured and held', '4-4-ladder'),
    P('pos_load', 'Not under a suspended load', '4-5-crane'),
    P('pos_vehicle', 'Out of the path of vehicles', '4-6-vehicle'),
    P('pos_team', 'Team know the job and the stop signals', '4-7-team'),
  ] },
];

export const LMRA_QUESTIONS: CheckQuestion[] = LMRA_ROWS.flatMap((r) => r.pictures.map((p) => ({ key: p.key, text: `${r.title}: ${p.label}` })));

export type Answer = 'YES' | 'NO' | 'NA';
/** Any "No" means the work must not start. */
export const outcomeOf = (answers: Record<string, Answer>, keys: string[]): 'SAFE_TO_START' | 'STOPPED' =>
  keys.every((k) => answers[k] === 'YES' || answers[k] === 'NA') ? 'SAFE_TO_START' : 'STOPPED';
export const complete = (answers: Record<string, Answer>, keys: string[]) => keys.every((k) => !!answers[k]);
