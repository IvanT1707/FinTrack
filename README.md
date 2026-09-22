# FinTrack

FinTrack is a personal finance web application for tracking income and expenses, managing category budgets, analyzing cash flow, and forecasting expenses by category.

## Stack

- Frontend: React, Vite, React Router, Axios, Recharts
- Backend: Node.js, Express, Sequelize
- Database: PostgreSQL
- Authentication: JWT access and refresh tokens, bcryptjs
- API documentation: Swagger UI
- Tests: Jest and Supertest

## Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer
- npm

## Database setup

Create a PostgreSQL database named `fintrack`. Configure `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fintrack
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:5173
```

`JWT_SECRET` is required. The backend will not start without it.

## Run locally

Open two PowerShell terminals.

Backend:

```powershell
Set-Location "d:\Унік\4 курс\1 семестр\практика\FinTrack\backend"
npm install
npm run dev
```

Frontend:

```powershell
Set-Location "d:\Унік\4 курс\1 семестр\практика\FinTrack\frontend"
npm install
npm run dev
```

Open the application at `http://localhost:5173/`.

The backend is available at `http://localhost:3000/`.
Swagger documentation is available at `http://localhost:3000/api-docs/`.

## Test and build

Backend tests:

```powershell
Set-Location "d:\Унік\4 курс\1 семестр\практика\FinTrack\backend"
npm test -- --runInBand
```

Frontend build and lint:

```powershell
Set-Location "d:\Унік\4 курс\1 семестр\практика\FinTrack\frontend"
npm run build
npm run lint
```

## Main features

- Registration, login, refresh token, and logout
- System and user-owned categories
- Transaction CRUD with date/category/type filters and pagination
- Monthly budget limits with `ok`, `warning`, and `exceeded` statuses
- Weighted moving average expense forecast by category
- Monthly summary, category breakdown, and cash-flow trend analytics
- Responsive React dashboard with charts

## Demo flow

1. Start PostgreSQL, backend, and frontend.
2. Register a user in the frontend.
3. Add income and expense transactions.
4. Create an expense budget limit.
5. Open the dashboard to see summary, charts, budget status, and forecast.
6. Use `/transactions`, `/categories`, and `/budget` to manage data.
7. Use Swagger at `/api-docs/` to inspect and test the REST API.
