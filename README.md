# Shell PTW & Competence Portal — Prototype (v3)

A clickable, no-backend prototype of the Permit to Work, training, Safety
Passport and HSSE reporting system for Shell retail stations in Oman,
delivered with Artelia. Prepared by FullCircleWali for stakeholder review.

Everything runs in the browser. Data is stored in `localStorage`, seeded with
Shell demo data on first load. Nothing is sent to a server, no real payments
are taken and no emergency services are contacted.

---

## Push to GitHub and deploy on Vercel

```bash
# 1. In this folder
git init
git add .
git commit -m "Shell PTW & Competence Portal prototype v3"

# 2. Create an empty repo on github.com (no README), then:
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

3. In Vercel: **Add New → Project → Import** the GitHub repo. The framework
   is detected as **Next.js**. No environment variables are needed. Click
   **Deploy**.
4. Every later `git push` to `main` redeploys automatically.

Run locally:

```bash
npm install
npm run dev        # http://localhost:3000
```

> The camera (face recognition, course proctoring, video call) only works on
> `https://` or `localhost`, which Vercel provides.

---

## Signing in

The login page has two tabs, **Username** and **Civil ID**. Under the form
is a **Demo accounts** list — click any person and their username/password
(or Civil ID + expiry) is filled in. Every demo password is `Shell@2026`.

| Person | Role | Username | Civil ID / expiry |
|---|---|---|---|
| Ahmed Al Rashdi | Permit Holder | ahmed.holder | 12345678 / 2028-05-31 |
| Sara Al Kindi | Permit Holder | sara.holder | 12876540 / 2027-02-28 |
| **Rashid Al Maskari** | Permit Holder (**imported**) | rashid.maskari | 87654321 / 2029-08-15 |
| Hamed Al Siyabi | Trainee (part-way) | hamed.trainee | 13300912 / 2030-04-01 |
| Noor Al Lawati | Trainee (ready to register) | noor.trainee | 13455120 / 2028-12-19 |
| Salim Al Amri | Trainee (registration pending) | salim.trainee | 11873402 / 2027-10-05 |
| Mariam Al Farsi | Permit Issuer | mariam.issuer | 10456721 / 2027-11-02 |
| Khalid Al Habsi | Permit Issuer | khalid.issuer | 10988230 / 2029-01-20 |
| Fahad Al Balushi | Fuel Station (Shell Al Khuwair) | alkhuwair.station | 11203344 / 2027-06-30 |
| Layla Al Hinai | Fuel Station (Shell Sohar) | sohar.station | 11407788 / 2028-09-12 |
| Yusuf Al Balushi | Administrator | admin | 09812345 / 2028-03-14 |

**"Your account already exists":** go to *Create an account* and enter Civil
ID `87654321`, expiry `2029-08-15`. Rashid was imported from the legacy
register, so the portal tells him his account already exists, lists the
certificates already on his record, and signs him in with his Civil ID.

---

## New in v4

- **SOS = See it · Own it · Stop it** (based on the TNT principles). The red SOS
  button opens a choice: *Report something unsafe* or *Emergency alert*. The
  report form has three steps — See it, Own it, Stop it — and you can tick
  **one or more** of Near Miss, Potential Incident, Unsafe Act, Unsafe
  Condition. **Location is captured automatically** (GPS + map) and can also
  be chosen manually: a Shell station and spot on site, or "Not at a station"
  with a free-text description.
- **English / العربية** — language switch on the sign-in page and in the top
  bar. Arabic flips the whole layout right-to-left and uses an Arabic font.
  Interface text is translated; user-entered data and course lesson content
  stay as written.
- **Approved companies** — Admin → *Companies & ranking* manages the approved
  company list. Profiles, registration and Add user now use a dropdown of
  approved companies only (no free typing).
- **Contractor ranking** — rank vendors by most people, Permit Holders,
  certificates, valid passports, permits requested or SOS reports raised.

## What's in the prototype

**Branding** — Shell and Artelia logos on the login page, sidebar, top bar,
welcome tour, Safety Passport and every PDF (permit, certificate, journey
plan, passport). Shell stations and Shell demo data throughout.

**Guided tour & tips** — first sign-in for each user shows a welcome card and
a step-by-step spotlight tour of their menu. The **?** button in the top bar
shows role tips and replays the tour.

**Training**
- Module groups in a fixed order: **Shell first, Artelia second, Local third**
  (catalogue, admin course list, roadmap and passport stamps).
- **Roadmap** — a winding road through each stage with a *You are here*
  marker, ending at Safety Passport → Permit Holder → Permit Issuer.
- **Before a course starts:** a notice that *you will be required to show
  video* and *Please follow Shell mobile usage guidelines always during work*,
  then **face verification**, then the camera stays on in a small window for
  the whole course.
- **Interactive lessons** — "spot the hazard" forecourt scene, flip cards for
  key points, one-question-at-a-time quizzes, confetti on pass.
- **Paid PTW courses** — PTW-201 (25 OMR) and PTW-301 Permit Issuer
  Certification (45 OMR) + 5% VAT. Checkout by **card** or **Apple Pay**,
  labelled as AmwalPay. *Prototype only:* the card form accepts only the test
  card `4242 4242 4242 4242` (or `5555 5555 5555 4444`); real card numbers
  are rejected and only the last four digits are kept.
- **Safety Passport** — flip-open passport with photo, QR code (links to
  `/verify/<passport no>`), stamps for every course, PDF download.

**Face recognition** — warning screen → live camera with face oval → capture
→ match result. Enrol from *My profile* or the Safety Passport. Matching is
simulated in the prototype (production: Amazon Rekognition with Face
Liveness, per the quotation).

**HSSE**
- Red **SOS** button on every screen: choose the emergency, press and hold to
  send with live GPS. Shows on Admin and Permit Issuer screens with a map,
  call button, Acknowledge and Resolve. Link to call 9999.
- **Report NM / PI** — Near Miss, Potential Incident, Unsafe Act, Unsafe
  Condition; clickable RAM matrix; Life-Saving Rule; photos; anonymous option.
- **HSSE reports** — charts, filters, investigation, corrective actions.

**Admin** — dashboard with live charts, **Import existing workers** (Users →
Import: loads a sample legacy register with certificates), training modules
grouped Shell / Artelia / Local with prices, course revenue.

**Fixes from the walkthrough** — camera previews now show video (F-01), the
presenter note is removed from the documents step (F-02).

## Resetting

Sidebar → **Reset demo data** restores the seed and signs everyone out.

## Not production

No database, no server-side auth, no real payments, no real face matching.
The production build (PostgreSQL, real auth/RBAC, object storage, AmwalPay,
Amazon Rekognition) is described in the quotation.
