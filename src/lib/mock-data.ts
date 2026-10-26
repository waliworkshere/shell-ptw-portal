import { FocalReport, AppState, Course, Enrollment, HsseReport, JourneyPlan, LessonProgress, Payment } from './types';
import coursesJson from './seed/courses.json';
import coursesExtraJson from './seed/courses-extra.json';
import { buildSchedule, computeRisk, VEHICLE_CHECKS, FITNESS_CHECKS } from './journey';

const DEMO_COMPANY = { 'u-artelia-mgr': 'Artelia Muscat Engineering Consultancy LLC', 'u-company-mgr': 'Al Noor Electrical Contracting', 'u-admin': 'Shell Oman (Retail HSSE)', 'u-approver-1': 'Shell Oman (Retail Operations)', 'u-approver-2': 'Artelia (PTW contractor)', 'u-station-alpha': 'Shell Al Khuwair', 'u-station-beta': 'Shell Sohar Falaj Al Qabail', 'u-applicant-1': 'Gulf Mechanical LLC', 'u-applicant-2': 'Al Noor Electrical Contracting', 'u-imported-1': 'Oman Fuel Services LLC', 'u-trainee-1': 'Gulf Mechanical LLC', 'u-trainee-2': 'Al Noor Electrical Contracting', 'u-trainee-3': 'Al Amri Electrical Services LLC' };
const seedCourses = [...coursesJson, ...coursesExtraJson] as Course[];

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

export const seedState: AppState = {
  currentUserId: null,

  users: [
    { id: 'u-admin', fullName: 'Yusuf Al Balushi', email: 'yusuf.balushi@shell-retail.test', role: 'ADMIN', username: 'admin', password: 'Shell@2026', civilId: '09812345', civilIdExpiry: '2028-03-14', phone: '+968 9100 2200', company: 'Shell Oman (Retail HSSE)', jobTitle: 'HSSE Systems Administrator' },
    { id: 'u-artelia-mgr', fullName: 'Omar Al Zadjali', email: 'omar.zadjali@artelia.test', role: 'ARTELIA_MANAGER', username: 'artelia.manager', password: 'Shell@2026', civilId: '10321987', civilIdExpiry: '2029-03-01', phone: '+968 9200 7711', company: 'Artelia Muscat Engineering Consultancy LLC', jobTitle: 'PTW & HSSE Manager' },
    { id: 'u-company-mgr', fullName: 'Nasser Al Hashmi', email: 'nasser.hashmi@alnoorelectric.test', role: 'COMPANY_MANAGER', username: 'alnoor.manager', password: 'Shell@2026', civilId: '10765432', civilIdExpiry: '2028-07-09', phone: '+968 9822 1100', company: 'Al Noor Electrical Contracting', jobTitle: 'Operations Manager & HSSE' },
    { id: 'u-approver-1', fullName: 'Mariam Al Farsi', email: 'mariam.farsi@shell-retail.test', role: 'APPROVER', username: 'mariam.issuer', password: 'Shell@2026', civilId: '10456721', civilIdExpiry: '2027-11-02', phone: '+968 9123 4410', company: 'Shell Oman (Retail Operations)', jobTitle: 'Permit Issuer, Muscat region' },
    { id: 'u-approver-2', fullName: 'Khalid Al Habsi', email: 'khalid.habsi@artelia.test', role: 'APPROVER', username: 'khalid.issuer', password: 'Shell@2026', civilId: '10988230', civilIdExpiry: '2029-01-20', phone: '+968 9234 0019', company: 'Artelia (PTW contractor)', jobTitle: 'Permit Issuer, Batinah region' },
    { id: 'u-station-alpha', fullName: 'Fahad Al Balushi', email: 'alkhuwair.manager@shell-retail.test', role: 'STATION', stationId: 'stn-alpha', username: 'alkhuwair.station', password: 'Shell@2026', civilId: '11203344', civilIdExpiry: '2027-06-30', phone: '+968 9555 1014', company: 'Shell Al Khuwair', jobTitle: 'Station Manager' },
    { id: 'u-station-beta', fullName: 'Layla Al Hinai', email: 'sohar.manager@shell-retail.test', role: 'STATION', stationId: 'stn-beta', username: 'sohar.station', password: 'Shell@2026', civilId: '11407788', civilIdExpiry: '2028-09-12', phone: '+968 9555 3031', company: 'Shell Sohar Falaj Al Qabail', jobTitle: 'Station Manager' },
    { id: 'u-applicant-1', fullName: 'Ahmed Al Rashdi', email: 'ahmed.rashdi@gulfmech.test', role: 'APPLICANT', username: 'ahmed.holder', password: 'Shell@2026', civilId: '12345678', civilIdExpiry: '2028-05-31', phone: '+968 9911 2040', company: 'Gulf Mechanical LLC', jobTitle: 'Maintenance Technician', passportNo: 'SP-OM-104217', competencyRole: 'SUPERVISOR_MANAGER', hsseFocal: { active: true, company: 'Gulf Mechanical LLC', contracts: ['EPCM', 'FMC'], appointedAt: daysAgo(150), appointedBy: 'Yusuf Al Balushi' }, subscription: { plan: 'ANNUAL', startsAt: daysAgo(40).slice(0, 10), expiresAt: daysAgo(-325).slice(0, 10), activatedBy: 'Yusuf Al Balushi', activatedAt: daysAgo(40), reference: 'Bank transfer' }, drivingLicence: { number: '12345678', expires: daysAgo(-700).slice(0, 10), issued: '2019-04-02', classes: 'Light vehicle', holderName: 'Ahmed Al Rashdi', uploadedAt: daysAgo(30) } },
    { id: 'u-applicant-2', fullName: 'Sara Al Kindi', email: 'sara.kindi@alnoorelectric.test', role: 'APPLICANT', username: 'sara.holder', password: 'Shell@2026', civilId: '12876540', civilIdExpiry: '2027-02-28', phone: '+968 9822 7315', company: 'Al Noor Electrical Contracting', jobTitle: 'Electrical Supervisor', passportNo: 'SP-OM-103388', competencyRole: 'MEP_CEI', hsseFocal: { active: true, company: 'Al Noor Electrical Contracting', contracts: ['FMC'], appointedAt: daysAgo(150), appointedBy: 'Yusuf Al Balushi' }, subscription: { plan: 'ANNUAL', startsAt: daysAgo(20).slice(0, 10), expiresAt: daysAgo(-345).slice(0, 10), activatedBy: 'Yusuf Al Balushi', activatedAt: daysAgo(20), reference: 'Bank transfer' } },
    { id: 'u-imported-1', fullName: 'Rashid Al Maskari', email: 'rashid.maskari@omanfuelservices.test', role: 'APPLICANT', username: 'rashid.maskari', password: 'Shell@2026', civilId: '87654321', civilIdExpiry: '2029-08-15', phone: '+968 9677 4302', company: 'Oman Fuel Services LLC', jobTitle: 'Tank & Pipework Technician', imported: true, importedAt: daysAgo(6), importSource: 'Legacy PTW competence register', passportNo: 'SP-OM-099412', competencyRole: 'MEP_CEI' },
    { id: 'u-trainee-1', fullName: 'Hamed Al Siyabi', email: 'hamed.siyabi@gulfmech.test', role: 'TRAINEE', username: 'hamed.trainee', password: 'Shell@2026', civilId: '13300912', civilIdExpiry: '2030-04-01', phone: '+968 9781 6620', company: 'Gulf Mechanical LLC', jobTitle: 'Apprentice Technician', competencyRole: 'HELPER' },
    { id: 'u-trainee-2', fullName: 'Noor Al Lawati', email: 'noor.lawati@alnoorelectric.test', role: 'TRAINEE', username: 'noor.trainee', password: 'Shell@2026', civilId: '13455120', civilIdExpiry: '2028-12-19', phone: '+968 9781 2201', company: 'Al Noor Electrical Contracting', jobTitle: 'Electrician', competencyRole: 'MEP_CEI' },
    { id: 'u-trainee-3', fullName: 'Salim Al Amri', email: 'salim.amri@alamrielectrical.test', role: 'TRAINEE', username: 'salim.trainee', password: 'Shell@2026', civilId: '11873402', civilIdExpiry: '2027-10-05', phone: '+968 9234 5521', company: 'Al Amri Electrical Services LLC', jobTitle: 'Electrician', competencyRole: 'SKILLED_TRADES' },
  ],

  stations: [
    { id: 'stn-alpha', name: 'Shell Al Khuwair', code: 'SHL-MCT-014', location: 'Al Khuwair, Muscat', status: 'ACTIVE' },
    { id: 'stn-beta', name: 'Shell Sohar Falaj Al Qabail', code: 'SHL-SHR-031', location: 'Falaj Al Qabail, Sohar', status: 'ACTIVE' },
    { id: 'stn-gamma', name: 'Shell Salalah Al Dahariz', code: 'SHL-SLL-052', location: 'Al Dahariz, Salalah', status: 'ACTIVE' },
    { id: 'stn-delta', name: 'Shell Nizwa Firq', code: 'SHL-NZW-022', location: 'Firq, Nizwa', status: 'ACTIVE' },
  ],

  permitTypes: [
    {
      id: 'pt-employee',
      name: 'Employee Access Permit',
      description: 'For employees requiring recurring site access.',
      validityDays: 365,
      videoRequired: true,
      active: true,
      fields: [
        { key: 'department', label: 'Department', fieldType: 'TEXT', required: true },
        { key: 'position', label: 'Position', fieldType: 'TEXT', required: true },
        { key: 'start_date', label: 'Requested start date', fieldType: 'DATE', required: true },
      ],
      documents: [
        { key: 'id_front', label: 'ID front', required: true },
        { key: 'id_back', label: 'ID back', required: true },
      ],
    },
    {
      id: 'pt-contractor',
      name: 'Contractor Permit',
      description: 'For third-party contractors performing work at a station.',
      validityDays: 90,
      videoRequired: true,
      active: true,
      fields: [
        { key: 'company', label: 'Company', fieldType: 'TEXT', required: true },
        { key: 'contract_number', label: 'Contract number', fieldType: 'TEXT', required: true },
        { key: 'work_description', label: 'Work description', fieldType: 'TEXTAREA', required: true },
      ],
      documents: [
        { key: 'id_front', label: 'ID front', required: true },
        { key: 'id_back', label: 'ID back', required: true },
        { key: 'contract_copy', label: 'Contract copy', required: false },
      ],
    },
    {
      id: 'pt-access',
      name: 'Site Access Permit',
      description: 'Short-term visitor site access.',
      validityDays: 30,
      videoRequired: false,
      active: true,
      fields: [{ key: 'reason', label: 'Reason for visit', fieldType: 'TEXTAREA', required: true }],
      documents: [{ key: 'id_front', label: 'ID front', required: true }],
    },
  ],

  applications: [
    {
      id: 'app-1',
      applicationNumber: 'PER-2026-000124',
      applicantId: 'u-applicant-1',
      applicantName: 'Ahmed Al Rashdi',
      stationId: 'stn-alpha',
      permitTypeId: 'pt-employee',
      status: 'UNDER_REVIEW',
      riskLevel: 'MEDIUM',
      fieldValues: { department: 'Operations', position: 'Site Technician', start_date: daysAgo(-5) },
      documents: [
        { key: 'id_front', label: 'ID front', fileName: 'id_front.jpg' },
        { key: 'id_back', label: 'ID back', fileName: 'id_back.jpg' },
      ],
      wcfDocument: { key: 'wcf', label: 'Work Clearance Form (WCF)', fileName: 'wcf_signed.jpg' },
      jhaDocument: { key: 'jha', label: 'Job Hazard Analysis (JHA/RA)', fileName: 'jha_signed.jpg' },
      videoRecorded: true,
      callStatus: 'NOT_STARTED',
      callScreenshots: [],
      submittedAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
      timeline: [
        { id: 't1', label: 'Application created', actor: 'Ahmed Al Rashdi', at: daysAgo(2) },
        { id: 't2', label: 'Application submitted', actor: 'Ahmed Al Rashdi', at: daysAgo(2) },
        { id: 't3', label: 'Under review', actor: 'Mariam Al Farsi', at: daysAgo(1) },
      ],
      comments: [],
    },
    {
      id: 'app-2',
      applicationNumber: 'PER-2026-000125',
      applicantId: 'u-applicant-2',
      applicantName: 'Sara Al Kindi',
      stationId: 'stn-alpha',
      permitTypeId: 'pt-contractor',
      status: 'CHANGES_REQUIRED',
      riskLevel: 'HIGH',
      fieldValues: {
        company: 'Gulf Mechanical LLC',
        contract_number: 'CN-8834',
        work_description: 'Pump calibration and routine maintenance',
      },
      documents: [
        { key: 'id_front', label: 'ID front', fileName: 'id_front.jpg' },
        { key: 'id_back', label: 'ID back', fileName: 'id_back_blurry.jpg' },
      ],
      wcfDocument: { key: 'wcf', label: 'Work Clearance Form (WCF)', fileName: 'wcf_signed.jpg' },
      jhaDocument: { key: 'jha', label: 'Job Hazard Analysis (JHA/RA)', fileName: 'jha_blurry.jpg' },
      videoRecorded: true,
      callStatus: 'NOT_STARTED',
      callScreenshots: [],
      submittedAt: daysAgo(4),
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
      timeline: [
        { id: 't1', label: 'Application created', actor: 'Sara Al Kindi', at: daysAgo(4) },
        { id: 't2', label: 'Application submitted', actor: 'Sara Al Kindi', at: daysAgo(4) },
        { id: 't3', label: 'Under review', actor: 'Mariam Al Farsi', at: daysAgo(3) },
        { id: 't4', label: 'Changes requested', actor: 'Mariam Al Farsi', at: daysAgo(3) },
      ],
      comments: [
        {
          id: 'c1',
          author: 'Mariam Al Farsi',
          authorRole: 'APPROVER',
          body: 'The ID back photo is blurry — please re-upload a clearer copy.',
          at: daysAgo(3),
        },
      ],
      changesRequested: 'The ID back photo is blurry — please re-upload a clearer copy.',
    },
    {
      id: 'app-3',
      applicationNumber: 'PER-2026-000119',
      applicantId: 'u-applicant-1',
      applicantName: 'Ahmed Al Rashdi',
      stationId: 'stn-beta',
      permitTypeId: 'pt-access',
      status: 'APPROVED',
      riskLevel: 'LOW',
      fieldValues: { reason: 'Quarterly safety audit walkthrough' },
      documents: [{ key: 'id_front', label: 'ID front', fileName: 'id_front.jpg' }],
      wcfDocument: { key: 'wcf', label: 'Work Clearance Form (WCF)', fileName: 'wcf_signed.jpg' },
      videoRecorded: false,
      callStatus: 'ENDED',
      callScreenshots: [],
      permitNumber: 'PTW-000119',
      permitPdfGeneratedAt: daysAgo(8),
      submittedAt: daysAgo(10),
      approvedAt: daysAgo(8),
      expiresAt: daysAgo(-20),
      createdAt: daysAgo(10),
      updatedAt: daysAgo(8),
      timeline: [
        { id: 't1', label: 'Application created', actor: 'Ahmed Al Rashdi', at: daysAgo(10) },
        { id: 't2', label: 'Application submitted', actor: 'Ahmed Al Rashdi', at: daysAgo(10) },
        { id: 't3', label: 'Under review', actor: 'Khalid Al Habsi', at: daysAgo(9) },
        { id: 't4', label: 'Approved', actor: 'Khalid Al Habsi', at: daysAgo(8) },
      ],
      comments: [],
    },
    {
      id: 'app-4',
      applicationNumber: 'PER-2026-000101',
      applicantId: 'u-applicant-2',
      applicantName: 'Sara Al Kindi',
      stationId: 'stn-beta',
      permitTypeId: 'pt-employee',
      status: 'REJECTED',
      riskLevel: 'LOW',
      fieldValues: { department: 'Retail', position: 'Cashier', start_date: daysAgo(20) },
      documents: [{ key: 'id_front', label: 'ID front', fileName: 'id_front.jpg' }],
      wcfDocument: { key: 'wcf', label: 'Work Clearance Form (WCF)', fileName: 'wcf_signed.jpg' },
      videoRecorded: true,
      callStatus: 'ENDED',
      callScreenshots: [],
      submittedAt: daysAgo(18),
      rejectedAt: daysAgo(16),
      createdAt: daysAgo(18),
      updatedAt: daysAgo(16),
      timeline: [
        { id: 't1', label: 'Application created', actor: 'Sara Al Kindi', at: daysAgo(18) },
        { id: 't2', label: 'Application submitted', actor: 'Sara Al Kindi', at: daysAgo(18) },
        { id: 't3', label: 'Under review', actor: 'Mariam Al Farsi', at: daysAgo(17) },
        { id: 't4', label: 'Rejected', actor: 'Mariam Al Farsi', at: daysAgo(16) },
      ],
      comments: [
        {
          id: 'c1',
          author: 'Mariam Al Farsi',
          authorRole: 'APPROVER',
          body: 'Required identification document had expired at time of submission.',
          at: daysAgo(16),
        },
      ],
      rejectionReason: 'Required identification document had expired at time of submission.',
    },
  ],

  auditLogs: [
    { id: 'a1', action: 'APPLICATION_SUBMITTED', actor: 'Ahmed Al Rashdi', description: 'PER-2026-000124 submitted', at: daysAgo(2) },
    { id: 'a2', action: 'APPLICATION_REVIEWED', actor: 'Mariam Al Farsi', description: 'PER-2026-000124 moved to under review', at: daysAgo(1) },
    { id: 'a3', action: 'CHANGES_REQUESTED', actor: 'Mariam Al Farsi', description: 'PER-2026-000125 changes requested', at: daysAgo(3) },
    { id: 'a4', action: 'APPLICATION_APPROVED', actor: 'Khalid Al Habsi', description: 'PER-2026-000119 approved', at: daysAgo(8) },
    { id: 'a5', action: 'APPLICATION_REJECTED', actor: 'Mariam Al Farsi', description: 'PER-2026-000101 rejected', at: daysAgo(16) },
  ],

  screenshotGallery: [],

  courses: seedCourses,
  enrollments: buildEnrollments(),
  registrations: [
    {
      id: 'reg-1',
      userId: 'u-trainee-3',
      fullName: 'Salim Al Amri',
      email: 'salim.amri@alamrielectrical.test',
      company: 'Al Amri Electrical Services LLC',
      civilId: '11873402',
      phone: '+968 9234 5521',
      status: 'PENDING',
      submittedAt: daysAgo(1),
    },
  ],
  journeys: buildJourneys(),

  payments: [
    payment('u-applicant-1', 115, 'RCT-2026-000812', 'CARD', '4242'),
    payment('u-applicant-2', 196, 'RCT-2026-000611', 'APPLE_PAY'),
    payment('u-trainee-1', 3, 'RCT-2026-001207', 'CARD', '4444'),
    payment('u-trainee-2', 9, 'RCT-2026-001150', 'APPLE_PAY'),
    payment('u-trainee-3', 12, 'RCT-2026-001133', 'CARD', '4242'),
  ],

  hsseReports: buildHsse().map((r) => ({ ...r, reporterCompany: r.reporterId ? (DEMO_COMPANY as Record<string, string>)[r.reporterId] : undefined })).map((r) =>
    r.status === 'CLOSED' && r.reporterId
      ? { ...r, points: r.types.every((t) => t === 'POTENTIAL_INCIDENT') ? 1 : 2, pointsStatus: 'APPROVED' as const, pointsDecidedAt: r.createdAt, pointsDecidedBy: 'Yusuf Al Balushi' }
      : r,
  ),
  sosAlerts: [
    {
      id: 'sos-1', refNo: 'SOS-2026-0007', userId: 'u-applicant-2', userName: 'Sara Al Kindi', role: 'APPLICANT', phone: '+968 9822 7315',
      lat: 24.3461, lng: 56.7375, accuracy: 18, locationLabel: 'Batinah Expressway near Sohar', kind: 'Vehicle breakdown',
      message: 'Tyre blow-out, vehicle on hard shoulder, no injuries.', status: 'RESOLVED', createdAt: daysAgo(9),
      acknowledgedBy: 'Khalid Al Habsi', acknowledgedAt: daysAgo(9), resolvedAt: daysAgo(9),
      timeline: [
        { id: 'sos1-t1', label: 'SOS raised', actor: 'Sara Al Kindi', at: daysAgo(9) },
        { id: 'sos1-t2', label: 'Acknowledged, recovery dispatched', actor: 'Khalid Al Habsi', at: daysAgo(9) },
        { id: 'sos1-t3', label: 'Resolved, driver safe', actor: 'Khalid Al Habsi', at: daysAgo(9) },
      ],
    },
  ],
  faceChecks: [],
  tourDone: [],
  companies: [
    { id: 'co-1', name: 'Gulf Mechanical LLC', crNumber: '1098234', category: 'Mechanical maintenance', status: 'APPROVED', addedAt: daysAgo(400) },
    { id: 'co-2', name: 'Al Noor Electrical Contracting', crNumber: '1124577', category: 'Electrical', status: 'APPROVED', addedAt: daysAgo(380) },
    { id: 'co-3', name: 'Oman Fuel Services LLC', crNumber: '1067120', category: 'Tanks & pipework', status: 'APPROVED', addedAt: daysAgo(500) },
    { id: 'co-4', name: 'Al Amri Electrical Services LLC', crNumber: '1203398', category: 'Electrical', status: 'APPROVED', addedAt: daysAgo(120) },
    { id: 'co-5', name: 'Muscat Civil Works LLC', crNumber: '1150043', category: 'Civil & construction', status: 'APPROVED', addedAt: daysAgo(90) },
    { id: 'co-6', name: 'Batinah Signage & Canopy Co.', crNumber: '1188921', category: 'Signage & canopy', status: 'APPROVED', addedAt: daysAgo(60) },
    { id: 'co-7', name: 'Desert Clean Services', crNumber: '1172210', category: 'Cleaning', status: 'SUSPENDED', addedAt: daysAgo(300) },
  ],
  certUploads: [],
  redemptions: [],
  focalReports: buildFocal(),
  orders: [],
  workChecks: [],
  ptwCards: [
    {
      id: 'ptw-1', userId: 'u-applicant-1', kind: 'PH', cardNo: 'AO-PTW-26-014/PH', position: 'Site Supervisor', company: 'Gulf Mechanical LLC',
      categories: ['HOT_WORK', 'CONFINED_SPACE', 'EXCAVATION'], validUntil: dateOnly(300), certifiedBy: 'VINOTH.K', siteInducted: true,
      issuedAt: daysAgo(65), status: 'ACTIVE',
    },
    {
      id: 'ptw-2', userId: 'u-applicant-2', kind: 'PH', cardNo: 'AO-PTW-26-021/PH', position: 'Electrical Supervisor', company: 'Al Noor Electrical Contracting',
      categories: ['LIVE_ELECTRICAL', 'WORK_AT_HEIGHT', 'CEI'], validUntil: dateOnly(12), certifiedBy: 'VINOTH.K', siteInducted: true,
      issuedAt: daysAgo(353), status: 'ACTIVE',
    },
    {
      id: 'ptw-3', userId: 'u-approver-2', kind: 'PI', cardNo: 'AO-PTW-26-002/PI', position: 'Permit Issuer', company: 'Artelia (PTW contractor)',
      categories: ['HOT_WORK', 'CONFINED_SPACE', 'EXCAVATION', 'LIFTING', 'FLAMMABLE_GAS', 'LIVE_ELECTRICAL', 'DRILLING', 'WORK_AT_HEIGHT', 'DEMOLITION', 'FUEL_LINE', 'CEI'],
      validUntil: dateOnly(500), certifiedBy: 'VINOTH.K', siteInducted: true, issuedAt: daysAgo(200), status: 'ACTIVE',
    },
  ],
};

function dateOnly(daysAhead: number) {
  return new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
}

/** Workers in the legacy register that have not been imported yet (Admin → Users → Import). */
export const IMPORT_SAMPLE = [
  { fullName: 'Badar Al Hashmi', civilId: '14520033', civilIdExpiry: '2028-07-01', company: 'Oman Fuel Services LLC', jobTitle: 'Pump Technician', email: 'badar.hashmi@omanfuelservices.test', certs: ['crs-lsr100', 'crs-hse101', 'crs-ptw201', 'crs-drv150', 'crs-haz202'] },
  { fullName: 'Maryam Al Zadjali', civilId: '14998102', civilIdExpiry: '2027-03-22', company: 'Gulf Mechanical LLC', jobTitle: 'HSE Officer', email: 'maryam.zadjali@gulfmech.test', certs: ['crs-lsr100', 'crs-hse101', 'crs-ram210'] },
  { fullName: 'Talal Al Riyami', civilId: '15003377', civilIdExpiry: '2029-11-09', company: 'Al Noor Electrical Contracting', jobTitle: 'Electrician', email: 'talal.riyami@alnoorelectric.test', certs: ['crs-lsr100', 'crs-hse101', 'crs-ptw201', 'crs-drv150', 'crs-haz202', 'crs-fir110'] },
];

function payment(userId: string, ago: number, receiptNo: string, method: Payment['method'], last4?: string): Payment {
  return {
    id: `pay-${userId}`, receiptNo, userId, courseId: 'crs-ptw201', description: 'PTW-201 Permit to Work Fundamentals',
    amount: 25, vat: 1.25, total: 26.25, method, cardLast4: last4, cardBrand: last4 ? (last4 === '4444' ? 'Mastercard' : 'Visa') : undefined,
    at: daysAgo(ago + 3),
  };
}

function buildHsse(): HsseReport[] {
  const r = (p: Partial<HsseReport> & Pick<HsseReport, 'id' | 'refNo' | 'type' | 'title' | 'description' | 'consequence' | 'likelihood' | 'status'>, ago: number): HsseReport => ({
    stationId: 'stn-alpha', location: 'Forecourt', occurredAt: daysAgo(ago), reporterName: 'Ahmed Al Rashdi', reporterId: 'u-applicant-1', anonymous: false,
    immediateAction: '', photos: [], actions: [], createdAt: daysAgo(ago),
    timeline: [{ id: `${p.id}-t1`, label: 'Reported', actor: p.anonymous ? 'Anonymous' : (p.reporterName ?? 'Ahmed Al Rashdi'), at: daysAgo(ago) }],
    types: [p.type],
    gps: { lat: 23.5957, lng: 58.4246, accuracy: 15 },
    stoppedWork: true,
    ...p,
  });
  return [
    r({ id: 'hs-1', refNo: 'NM-2026-0041', type: 'NEAR_MISS', types: ['NEAR_MISS', 'UNSAFE_ACT'], title: 'Customer using mobile phone while refuelling', description: 'Customer at dispenser 3 was on a phone call with the nozzle in the tank. Attendant asked them to stop; no ignition or spill.', location: 'Dispenser 3', consequence: 3, likelihood: 'C', lifeSavingRule: 'Bypassing safety controls', immediateAction: 'Customer asked to end the call. Reminder signage checked.', status: 'CLOSED', actions: [{ id: 'a1', text: 'Replace faded "No mobile phones" sticker on dispenser 3', owner: 'Fahad Al Balushi', done: true }] }, 12),
    r({ id: 'hs-2', refNo: 'PI-2026-0017', type: 'POTENTIAL_INCIDENT', types: ['POTENTIAL_INCIDENT', 'UNSAFE_ACT'], gps: { lat: 24.3461, lng: 56.7375, accuracy: 12 }, title: 'Tanker reversed with pedestrian behind it', description: 'During fuel delivery the tanker reversed towards the offload point while a contractor walked behind it. Banksman was not in position.', location: 'Tanker offload point', stationId: 'stn-beta', reporterName: 'Sara Al Kindi', reporterId: 'u-applicant-2', consequence: 4, likelihood: 'B', lifeSavingRule: 'Line of fire', immediateAction: 'Delivery stopped, banksman briefed, contractor moved to the safe zone.', status: 'INVESTIGATING', actions: [{ id: 'a1', text: 'Mark a pedestrian exclusion zone at the offload point', owner: 'Layla Al Hinai', done: false }, { id: 'a2', text: 'Toolbox talk with tanker contractor on banksman rules', owner: 'Khalid Al Habsi', done: true }] }, 4),
    r({ id: 'hs-3', refNo: 'UC-2026-0062', type: 'UNSAFE_CONDITION', title: 'Cracked hose on dispenser 4', description: 'Visible crack on the diesel hose near the breakaway coupling.', location: 'Dispenser 4', consequence: 2, likelihood: 'C', immediateAction: 'Dispenser 4 taken out of service and tagged.', status: 'OPEN' }, 1),
    r({ id: 'hs-4', refNo: 'UA-2026-0029', type: 'UNSAFE_ACT', types: ['UNSAFE_ACT', 'POTENTIAL_INCIDENT'], gps: { lat: 17.0151, lng: 54.0924, accuracy: 20 }, title: 'Grinding without a hot-work permit', description: 'Sub-contractor started grinding a bracket on the canopy column without a hot-work permit or gas test.', location: 'Canopy column C2', stationId: 'stn-gamma', reporterName: 'Anonymous', reporterId: undefined, anonymous: true, consequence: 4, likelihood: 'C', lifeSavingRule: 'Hot work', immediateAction: 'Work stopped, area made safe, supervisor informed.', status: 'CLOSED', actions: [{ id: 'a1', text: 'Sub-contractor removed from site pending re-induction', owner: 'Mariam Al Farsi', done: true }] }, 20),
  ];
}

/* ---------------- Training seed helpers ---------------- */

function completed(userId: string, courseId: string, finishedDaysAgo: number, certNo: string, score = 92): Enrollment {
  const course = seedCourses.find((c) => c.id === courseId)!;
  const lessons: Record<string, LessonProgress> = {};
  course.lessons.forEach((l, i) => {
    lessons[l.id] = { contentDone: true, attempts: i === 1 ? 2 : 1, bestScore: i === 1 ? 100 : score, passed: true, passedAt: daysAgo(finishedDaysAgo + (course.lessons.length - 1 - i)) };
  });
  return {
    id: `enr-${userId}-${courseId}`,
    userId,
    courseId,
    enrolledAt: daysAgo(finishedDaysAgo + course.lessons.length + 2),
    lessons,
    completedAt: daysAgo(finishedDaysAgo),
    certificateNo: certNo,
    finalScore: score,
  };
}

function buildEnrollments(): Enrollment[] {
  const list: Enrollment[] = [
    // Permit holders — already qualified
    completed('u-applicant-1', 'crs-lsr100', 125, 'TRN-2026-02095', 100),
    completed('u-applicant-1', 'crs-hse101', 120, 'TRN-2026-02101', 100),
    completed('u-applicant-1', 'crs-ptw201', 115, 'TRN-2026-02108', 92),
    completed('u-applicant-1', 'crs-haz202', 110, 'TRN-2026-02117', 100),
    completed('u-applicant-1', 'crs-drv150', 104, 'TRN-2026-02125', 94),
    completed('u-applicant-2', 'crs-lsr100', 205, 'TRN-2026-01539', 100),
    completed('u-applicant-2', 'crs-hse101', 200, 'TRN-2026-01544', 92),
    completed('u-applicant-2', 'crs-ptw201', 196, 'TRN-2026-01552', 85),
    completed('u-applicant-2', 'crs-haz202', 190, 'TRN-2026-01560', 100),
    completed('u-applicant-2', 'crs-fir110', 60, 'TRN-2026-02790', 100),
    // Hamed — part way through the path
    completed('u-trainee-1', 'crs-lsr100', 5, 'TRN-2026-02999', 100),
    completed('u-trainee-1', 'crs-hse101', 3, 'TRN-2026-03001', 92),
    {
      id: 'enr-u-trainee-1-crs-ptw201',
      userId: 'u-trainee-1',
      courseId: 'crs-ptw201',
      enrolledAt: daysAgo(3),
      lessons: {
        'l-ptw201-1': { contentDone: true, attempts: 1, bestScore: 100, passed: true, passedAt: daysAgo(2) },
        'l-ptw201-2': { contentDone: true, attempts: 1, bestScore: 50, passed: false },
      },
    },
    // Noor — finished everything, ready to register as Permit Holder
    completed('u-trainee-2', 'crs-lsr100', 14, 'TRN-2026-02944', 100),
    completed('u-trainee-2', 'crs-hse101', 12, 'TRN-2026-02950', 100),
    completed('u-trainee-2', 'crs-ptw201', 9, 'TRN-2026-02961', 92),
    completed('u-trainee-2', 'crs-haz202', 6, 'TRN-2026-02977', 100),
    completed('u-trainee-2', 'crs-drv150', 2, 'TRN-2026-02990', 88),
    // Salim — finished everything, registration pending admin approval
    completed('u-trainee-3', 'crs-lsr100', 17, 'TRN-2026-02905', 100),
    completed('u-trainee-3', 'crs-hse101', 15, 'TRN-2026-02911', 92),
    completed('u-trainee-3', 'crs-ptw201', 12, 'TRN-2026-02920', 85),
    completed('u-trainee-3', 'crs-haz202', 8, 'TRN-2026-02932', 100),
    completed('u-trainee-3', 'crs-drv150', 4, 'TRN-2026-02945', 94),
    // Rashid — imported from the legacy register with his certificates
    imported('u-imported-1', 'crs-lsr100', 300, 'LEG-2025-00418'),
    imported('u-imported-1', 'crs-hse101', 290, 'LEG-2025-00419'),
    imported('u-imported-1', 'crs-ptw201', 280, 'LEG-2025-00431'),
    imported('u-imported-1', 'crs-drv150', 250, 'LEG-2025-00477'),
    imported('u-imported-1', 'crs-haz202', 240, 'LEG-2025-00502'),
    imported('u-imported-1', 'crs-fir110', 200, 'LEG-2025-00560'),
  ];
  // Paid courses in the seed have a matching payment.
  return list.map((e) => (e.courseId === 'crs-ptw201' && !e.imported ? { ...e, paymentId: `pay-${e.userId}` } : e));
}

function imported(userId: string, courseId: string, finishedDaysAgo: number, certNo: string): Enrollment {
  return { ...completed(userId, courseId, finishedDaysAgo, certNo, 90), imported: true };
}

/* ---------------- Journey seed helpers ---------------- */

function allChecked(items: { key: string }[]): Record<string, boolean> {
  return Object.fromEntries(items.map((i) => [i.key, true]));
}
function minsAgo(n: number) {
  return new Date(Date.now() - n * 60000).toISOString();
}

function journey(p: {
  id: string;
  num: string;
  driverId: string;
  driverName: string;
  origin: string;
  destination: string;
  stationId?: string;
  distanceKm: number;
  departAt: string;
  hazards: string[];
  purpose: string;
  status: JourneyPlan['status'];
  reportedCheckpoints?: number;
  decisionNote?: string;
  vehicleReg: string;
}): JourneyPlan {
  const sched = buildSchedule({ departAt: p.departAt, distanceKm: p.distanceKm, roadType: 'BLACKTOP', origin: p.origin, destination: p.destination });
  const hazards = sched.night && !p.hazards.includes('night') ? [...p.hazards, 'night'] : p.hazards;
  const risk = computeRisk(hazards);
  const checkpoints = sched.checkpoints.map((c, i) =>
    i < (p.reportedCheckpoints ?? 0)
      ? { ...c, actualAt: new Date(new Date(c.plannedAt).getTime() + 4 * 60000).toISOString(), note: i === 0 ? 'Departed, all checks complete.' : 'Rested 15 min, all OK.' }
      : c,
  );
  const approved = ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(p.status);
  const timeline = [
    { id: `${p.id}-t1`, label: 'Journey plan submitted', actor: p.driverName, at: new Date(new Date(p.departAt).getTime() - 20 * 3600000).toISOString() },
  ];
  if (approved) timeline.push({ id: `${p.id}-t2`, label: 'Approved by Journey Manager', actor: 'Mariam Al Farsi', at: new Date(new Date(p.departAt).getTime() - 16 * 3600000).toISOString() });
  if (p.status === 'REJECTED') timeline.push({ id: `${p.id}-t2`, label: 'Rejected by Journey Manager', actor: 'Mariam Al Farsi', at: new Date(new Date(p.departAt).getTime() - 16 * 3600000).toISOString() });
  if (p.status === 'IN_PROGRESS' || p.status === 'COMPLETED') timeline.push({ id: `${p.id}-t3`, label: 'Journey started', actor: p.driverName, at: checkpoints[0].actualAt ?? p.departAt });
  if (p.status === 'COMPLETED') timeline.push({ id: `${p.id}-t4`, label: 'Arrived, journey closed out', actor: p.driverName, at: checkpoints[checkpoints.length - 1].actualAt ?? sched.arriveBy });

  return {
    id: p.id,
    jmpNumber: p.num,
    driverId: p.driverId,
    driverName: p.driverName,
    driverPhone: p.driverId === 'u-applicant-1' ? '+968 9911 2040' : '+968 9822 7315',
    licenceNo: p.driverId === 'u-applicant-1' ? 'OM-DL-4471902' : 'OM-DL-5520184',
    licenceExpiry: daysAgo(-400),
    passengers: [],
    vehicleReg: p.vehicleReg,
    vehicleType: 'Toyota Hilux 4x4 double cab',
    ivmsFitted: true,
    origin: p.origin,
    destination: p.destination,
    destinationStationId: p.stationId,
    purpose: p.purpose,
    distanceKm: p.distanceKm,
    roadType: 'BLACKTOP',
    routeDescription: 'Route 1 (Muscat Expressway → Batinah Expressway).',
    departAt: p.departAt,
    arriveBy: sched.arriveBy,
    checkpoints,
    hazards,
    riskScore: risk.score,
    riskLevel: risk.level,
    nightDriving: sched.night,
    controls: 'Rest at Shell service stations on the expressway. Phone switched to drive mode. Call-ins via mobile.',
    vehicleChecklist: allChecked(VEHICLE_CHECKS),
    fitness: allChecked(FITNESS_CHECKS),
    commsMethod: 'MOBILE',
    emergencyContact: 'Shell Retail control room (demo) +968 2400 0000 · Emergency 9999',
    journeyManagerId: approved || p.status === 'REJECTED' ? 'u-approver-1' : undefined,
    journeyManagerName: approved || p.status === 'REJECTED' ? 'Mariam Al Farsi' : undefined,
    status: p.status,
    decisionNote: p.decisionNote,
    closeOut: p.status === 'COMPLETED' ? { incidents: false, notes: 'Arrived on time, no incidents.' } : undefined,
    createdAt: timeline[0].at,
    submittedAt: timeline[0].at,
    approvedAt: approved ? timeline[1].at : undefined,
    startedAt: p.status === 'IN_PROGRESS' || p.status === 'COMPLETED' ? checkpoints[0].actualAt : undefined,
    completedAt: p.status === 'COMPLETED' ? checkpoints[checkpoints.length - 1].actualAt : undefined,
    timeline,
  };
}

function atHour(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildJourneys(): JourneyPlan[] {
  return [
    // Overdue: arrival call-in missed ~45 min ago
    journey({
      id: 'jmp-1', num: 'JMP-2026-000038', driverId: 'u-applicant-1', driverName: 'Ahmed Al Rashdi',
      origin: 'Muscat (Ghala depot)', destination: 'Shell Sohar Falaj Al Qabail', stationId: 'stn-beta', distanceKm: 230,
      departAt: minsAgo(222), hazards: ['traffic'], purpose: 'Quarterly dispenser calibration at Shell Sohar Falaj Al Qabail.',
      status: 'IN_PROGRESS', reportedCheckpoints: 2, vehicleReg: '4417 AR',
    }),
    // On schedule: left an hour ago
    journey({
      id: 'jmp-2', num: 'JMP-2026-000039', driverId: 'u-applicant-2', driverName: 'Sara Al Kindi',
      origin: 'Sohar (Falaj Al Qabail)', destination: 'Shell Al Khuwair, Muscat', stationId: 'stn-alpha', distanceKm: 225,
      departAt: minsAgo(55), hazards: ['traffic'], purpose: 'Pump maintenance follow-up visit.',
      status: 'IN_PROGRESS', reportedCheckpoints: 1, vehicleReg: '7720 SK',
    }),
    // Awaiting approval: tomorrow morning
    journey({
      id: 'jmp-3', num: 'JMP-2026-000040', driverId: 'u-applicant-2', driverName: 'Sara Al Kindi',
      origin: 'Muscat (Ghala depot)', destination: 'Shell Sohar Falaj Al Qabail', stationId: 'stn-beta', distanceKm: 230,
      departAt: atHour(1, 7, 0), hazards: ['dangerous_goods', 'traffic'], purpose: 'Deliver replacement fuel sample kits and inspect the tank vent.',
      status: 'SUBMITTED', vehicleReg: '7720 SK',
    }),
    // Completed last week
    journey({
      id: 'jmp-4', num: 'JMP-2026-000031', driverId: 'u-applicant-1', driverName: 'Ahmed Al Rashdi',
      origin: 'Muscat (Ghala depot)', destination: 'Shell Sohar Falaj Al Qabail', stationId: 'stn-beta', distanceKm: 230,
      departAt: atHour(-8, 7, 30), hazards: ['traffic'], purpose: 'Quarterly safety audit walkthrough.',
      status: 'COMPLETED', reportedCheckpoints: 99, vehicleReg: '4417 AR',
    }),
    // Rejected: night driving
    journey({
      id: 'jmp-5', num: 'JMP-2026-000035', driverId: 'u-applicant-1', driverName: 'Ahmed Al Rashdi',
      origin: 'Muscat (Ghala depot)', destination: 'Shell Salalah Al Dahariz', stationId: 'stn-gamma', distanceKm: 760,
      departAt: atHour(-3, 14, 0), hazards: ['long_distance', 'remote', 'animals'], purpose: 'Install new canopy lighting at Shell Salalah Al Dahariz.',
      status: 'REJECTED', vehicleReg: '4417 AR',
      decisionNote: 'Arrival is well after sunset and the route through Al Wusta has long stretches without coverage. Re-plan as a two-day journey with an overnight stop in Haima and carry a satellite phone.',
    }),
  ];
}


/** Sample HSSE Focal reporting for the demo. */
function buildFocal(): FocalReport[] {
  const out: FocalReport[] = [];
  const now = new Date();
  const mk = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1)).toISOString().slice(0, 7);
  const onDay = (period: string, day: number) => `${period}-${String(day).padStart(2, '0')}T09:00:00.000Z`;
  const next = (p: string) => mk(Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - (now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) + 1);
  const add = (userId: string, userName: string, company: string, contract: FocalReport['contract'], kind: FocalReport['kind'], period: string, submitted: string, data: Record<string, any>, date?: string) =>
    out.push({ id: `fr-${userId}-${kind}-${contract}-${period}-${date ?? ''}`, userId, userName, company, contract, kind, period, date, data, status: 'SUBMITTED', createdAt: submitted, updatedAt: submitted, submittedAt: submitted });
  const stats = (h: number) => ({ manHours: h, lti: 0, rwc: 0, mtc: h > 9000 ? 1 : 0, fac: 2, lsr: 0, lopc: 0, hazWaste: 0.02, nonHazWaste: 0.4, nearMiss: 4, potentialIncident: 1, nmpiSig: 0, nmpiSigPtw: 0, tnt: 6, audits: 1, inspections: 4, ptwIssued: 18, journeyPlans: 9, kmDriven: Math.round(h * 1.6), commentsHighlights: 'HSSE Focal meeting done' });
  const env = (k: number) => ({ haz_recycled: 0.12 * k, haz_landfill: 0.05, non_recycled: 0.4 * k, non_landfill: 1.2 * k });
  const training = (n: number) => ({ sessions: Array.from({ length: n }, (_, i) => ({ date: '', topic: ['Hot work permit refresher', 'Fire extinguisher practical', 'Working at height', 'Spill response'][i % 4], type: i % 2 ? 'Practical / hands-on' : 'Toolbox talk', trainer: 'HSSE Focal', attendees: 8 + i * 3, hours: 1 })) });
  const erp = { drills: [{ date: '', site: 'Shell Al Khuwair', scenario: 'Fire', participants: 9, responseMins: 3, outcome: 'Satisfactory', observations: 'Evacuation completed within target.', actions: '' }] };
  const insp = (stationId: string, pct: number) => {
    const answers: Record<string, string> = {};
    let i = 0;
    [3, 4, 4, 4, 5, 2].forEach((n, si) => { for (let ii = 0; ii < n; ii++) answers[`${si}.${ii}`] = (i++ * 37) % 100 < pct ? 'Y' : 'N'; });
    return { stationId, answers, scorePct: pct, findings: 'Housekeeping good; extinguisher tag out of date at pump island 2.', actions: [{ text: 'Replace extinguisher tag', owner: 'Station Manager', due: '', done: true }] };
  };
  // Ahmed — Gulf Mechanical, EPCM + FMC, on time
  for (const n of [-3, -2, -1]) {
    const p = mk(n); const sub = onDay(next(p), 3);
    for (const c of ['EPCM', 'FMC'] as const) {
      add('u-applicant-1', 'Ahmed Al Rashdi', 'Gulf Mechanical LLC', c, 'MONTHLY_STATS', p, sub, stats(c === 'EPCM' ? 8400 : 5200));
      add('u-applicant-1', 'Ahmed Al Rashdi', 'Gulf Mechanical LLC', c, 'ENVIRONMENT', p, sub, env(c === 'EPCM' ? 2 : 1));
      add('u-applicant-1', 'Ahmed Al Rashdi', 'Gulf Mechanical LLC', c, 'TRAINING', p, sub, training(2));
      add('u-applicant-1', 'Ahmed Al Rashdi', 'Gulf Mechanical LLC', c, 'ERP_TEST', p, sub, erp);
    }
    add('u-applicant-1', 'Ahmed Al Rashdi', 'Gulf Mechanical LLC', 'EPCM', 'SITE_INSPECTION', p, onDay(p, 12), insp('stn-alpha', 92), `${p}-12`);
    add('u-applicant-1', 'Ahmed Al Rashdi', 'Gulf Mechanical LLC', 'EPCM', 'SITE_INSPECTION', p, onDay(p, 19), insp('stn-beta', 85), `${p}-19`);
    add('u-applicant-1', 'Ahmed Al Rashdi', 'Gulf Mechanical LLC', 'FMC', 'PTW_AUDIT', p, onDay(p, 22), { ...insp('stn-alpha', 88), permitNumber: 'PTW-000119', contractor: 'Gulf Mechanical LLC', workType: 'Hot work' }, `${p}-22`);
  }
  // Sara — Al Noor, FMC, some late / missing
  for (const n of [-3, -2]) {
    const p = mk(n); const sub = onDay(next(p), n === -2 ? 11 : 4);
    add('u-applicant-2', 'Sara Al Kindi', 'Al Noor Electrical Contracting', 'FMC', 'MONTHLY_STATS', p, sub, stats(3100));
    add('u-applicant-2', 'Sara Al Kindi', 'Al Noor Electrical Contracting', 'FMC', 'ENVIRONMENT', p, sub, env(1));
    add('u-applicant-2', 'Sara Al Kindi', 'Al Noor Electrical Contracting', 'FMC', 'TRAINING', p, sub, training(1));
    add('u-applicant-2', 'Sara Al Kindi', 'Al Noor Electrical Contracting', 'FMC', 'SITE_INSPECTION', p, onDay(p, 15), insp('stn-gamma', 74), `${p}-15`);
  }
  return out;
}

// Every demo permit carries its Permit Holder's company (the live server stamps this on save).
seedState.applications.forEach((a) => {
  a.applicantCompany ??= (DEMO_COMPANY as Record<string, string>)[a.applicantId];
});
