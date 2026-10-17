# SalaryFlow — Payroll Intelligence

A complete full-stack payroll management application built with React + Vite, Firebase, and deployed on AWS S3 + CloudFront.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# (Fill in Firebase credentials or leave blank for Demo Mode)

# 3. Start development server
npm run dev
# → http://localhost:5173

# 4. Run tests
npm test

# 5. Build for production
npm run build
```

---

## Demo Mode (No Firebase Needed)

Click **"⚡ Quick Demo Login"** on the login page. All data is stored in your browser's `localStorage`.

> ⚠️ **Demo Mode is not secure.** It is for evaluation only. No passwords are stored. Do not use it for real payroll data.

Demo credentials (for manual login):
- Email: `demo@salaryflow.app`
- Password: `demo1234`

---

## Firebase Setup (Production Mode)

### Step 1 — Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → Give it a name → Disable Google Analytics (optional)
3. Click **Continue**

### Step 2 — Enable Authentication

1. In the Firebase Console, go to **Authentication → Get started**
2. Under **Sign-in method**, enable **Email/Password**
3. Save

### Step 3 — Create Firestore Database

1. Go to **Firestore Database → Create database**
2. Select **Start in production mode**
3. Choose your region → **Enable**

### Step 4 — Deploy Security Rules

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login
firebase login

# Initialize (use existing project)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

Or paste the contents of `firestore.rules` directly in the Firebase Console under Firestore → Rules.

### Step 5 — Get Web App Config

1. In Firebase Console → **Project Settings** (gear icon) → **General**
2. Scroll to **Your apps** → Add a Web app (`</>`)
3. Register the app → Copy the config object
4. Add to your `.env` file:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-project
VITE_FIREBASE_STORAGE_BUCKET=my-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 6 — Add Authorized Domains

In Firebase Console → **Authentication → Settings → Authorized domains**:
- Add your CloudFront domain (e.g. `d1abc123.cloudfront.net`)
- Add your custom domain if applicable

---

## Tests

```bash
npm test
# → 18 tests, all passing

npm run test:watch
# → Interactive watch mode
```

Test coverage includes:
- Required spec example (Basic ₹30K + HRA ₹12K + ...)
- Zero amounts, decimal amounts, negative input handling
- Deductions exceeding gross salary (warning flag)
- Monthly vs annual pay period calculation
- Currency formatting (Indian digit grouping)
- Earnings/deductions breakdown sum validation

---

## Build

```bash
npm run build
# Output: dist/
```

Chunk breakdown (approximate):
| Chunk | Size (gzip) |
|---|---|
| vendor (react, router) | ~79 KB |
| charts (recharts) | ~119 KB |
| pdf (jspdf) | ~140 KB |
| app | ~50 KB |

---

## AWS Deployment (S3 + CloudFront)

### Step 1 — Build the App

```bash
npm run build
# Creates dist/ folder
```

### Step 2 — Create S3 Bucket

```bash
aws s3 mb s3://your-salaryflow-bucket --region ap-south-1
```

Keep the bucket **private** (block all public access).

### Step 3 — Upload Files

```bash
aws s3 sync dist/ s3://your-salaryflow-bucket --delete
```

### Step 4 — Create CloudFront Distribution

1. Go to AWS Console → **CloudFront → Create distribution**
2. **Origin domain**: Select your S3 bucket
3. **Origin access**: Use **Origin Access Control (OAC)** — click *Create new OAC*
4. **Viewer protocol policy**: Redirect HTTP to HTTPS
5. **Default root object**: `index.html`
6. Click **Create distribution**
7. Copy the S3 bucket policy shown and paste it in your S3 bucket policy

### Step 5 — SPA Routing Fallback

In CloudFront distribution → **Error pages** → Create custom error response:
- HTTP error code: `403`
- Response page path: `/index.html`
- HTTP response code: `200`

Repeat for error code `404`.

This ensures React Router handles all routes client-side.

### Step 6 — HTTPS & Custom Domain (Optional)

1. Request an ACM certificate in `us-east-1` for your domain
2. In CloudFront distribution → **Alternate domain names** → Add your domain
3. **Custom SSL certificate** → Select your ACM certificate

### Step 7 — Cache Invalidation After Deploy

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

Or automate with a GitHub Actions workflow.

### Step 8 — Environment Variables for Production

Set your `.env` values in your CI/CD pipeline (e.g. GitHub Actions Secrets):

```yaml
- name: Build
  env:
    VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
    VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
    VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
    VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
    VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
  run: npm run build
```

---

## Project Structure

```
salary/
├── src/
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Firebase + demo auth state
│   │   ├── ThemeContext.jsx   # Dark/light theme + settings
│   │   └── ToastContext.jsx   # Toast notifications
│   ├── components/
│   │   ├── AppLayout.jsx      # Sidebar + TopHeader shell
│   │   ├── Sidebar.jsx        # Navigation sidebar
│   │   ├── TopHeader.jsx      # Top bar with menus
│   │   └── ProtectedRoute.jsx # Auth guard
│   ├── pages/
│   │   ├── LoginPage.jsx      # Auth flows (login/register/forgot)
│   │   ├── DashboardPage.jsx  # Charts, stats, quick actions
│   │   ├── CalculatorPage.jsx # Salary calculator
│   │   ├── EmployeesPage.jsx  # Employee CRUD
│   │   ├── HistoryPage.jsx    # Salary records history
│   │   ├── ReportsPage.jsx    # Analytics reports
│   │   └── SettingsPage.jsx   # Profile, prefs, data management
│   ├── services/
│   │   ├── firebase.js        # Firebase initialization
│   │   ├── auth.js            # Auth service (Firebase + demo)
│   │   ├── db.js              # Database CRUD (Firestore + localStorage)
│   │   └── exports.js         # PDF + CSV export generation
│   ├── utils/
│   │   └── salaryCalc.js      # Core salary calculation engine
│   ├── App.jsx                # Router + providers
│   ├── main.jsx               # Entry point
│   └── index.css              # Noir Finance design system
├── tests/
│   └── salaryCalc.test.js     # Vitest test suite (18 tests)
├── .env.example               # Environment variable template
├── firestore.rules            # Firestore security rules
├── vite.config.js
└── README.md
```

---

## Security Notes

- **Firebase web config is NOT a secret** — it identifies your project, not your credentials
- **Firestore security rules** are the actual security boundary — deploy them before going live
- **Never store passwords** — demo mode stores only a logged-in flag, never credentials
- **Service account keys** — never used in this frontend app; never expose them in client code
- **OAC on S3** — keeps your S3 bucket private; only CloudFront can read it

---

## Features Implemented

| Feature | Status |
|---|---|
| Firebase Email/Password Auth | ✅ |
| Registration + Login + Forgot Password | ✅ |
| Demo Mode (localStorage) | ✅ |
| Protected Routes | ✅ |
| Dark / Light Theme | ✅ |
| Dashboard with live stats + charts | ✅ |
| Salary Calculator (all components) | ✅ |
| HRA/PF percentage shortcuts | ✅ |
| Live calculation with breakdown bars | ✅ |
| Employee CRUD (add/edit/delete) | ✅ |
| Employee search, filter, sort, paginate | ✅ |
| Salary History with detail view | ✅ |
| Duplicate calculation as draft | ✅ |
| PDF salary statement (jsPDF) | ✅ |
| CSV export (employees, history, reports) | ✅ |
| Monthly trend charts | ✅ |
| Department distribution charts | ✅ |
| Deduction category breakdown | ✅ |
| Profile + settings management | ✅ |
| Data export/import (JSON) | ✅ |
| Firestore security rules | ✅ |
| Vitest test suite (18 tests) | ✅ |
| Vite production build | ✅ |
| AWS S3 + CloudFront deployment guide | ✅ |

---

## Disclaimer

All salary calculations in SalaryFlow are **illustrative only** and do not constitute official tax advice. Consult a qualified financial advisor for statutory compliance.
