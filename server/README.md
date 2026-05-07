# SMB Agency Dashboard — API Reference

> Production-ready Node.js backend for multi-tenant agency dashboard management.

## Base URL

```
Development: http://localhost:5001
Production:  https://your-api.ondigitalocean.app
```

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Create agency + admin user |
| POST | `/login` | No | Login, receive JWT |
| POST | `/refresh-token` | Yes | Get a new JWT |
| POST | `/verify-token` | No | Check if token is valid |

#### Register

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "agencyName": "My Agency",
    "email": "admin@agency.com",
    "password": "SecurePass123",
    "confirmPassword": "SecurePass123"
  }'
```

#### Login

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@agency.com", "password": "SecurePass123"}'
```

---

### Integrations — `/api/integrations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:agencyId` | List all integrations |
| POST | `/:agencyId/google-ads/authorize` | Connect Google Ads |
| POST | `/:agencyId/meta-ads/authorize` | Connect Meta Ads |
| POST | `/:agencyId/stripe/authorize` | Connect Stripe |
| POST | `/:agencyId/hubspot/authorize` | Connect HubSpot |
| DELETE | `/:agencyId/:integrationId` | Disconnect |

---

### Sync — `/api/sync`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:agencyId/all` | Sync all platforms |
| POST | `/:agencyId/:platform` | Sync one platform |
| GET | `/:agencyId/:syncId/status` | Check sync progress |
| GET | `/:agencyId/recent` | Sync history |
| GET | `/:agencyId/stats` | Sync statistics |

---

### Dashboard — `/api/dashboard`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:agencyId/overview` | Aggregated metrics |
| GET | `/:agencyId/campaigns` | Campaign list (filterable) |
| GET | `/:agencyId/trends` | Time-series trends |
| GET | `/:agencyId/roi-analysis` | ROI by platform/campaign |
| GET | `/:agencyId/insights` | Recommendations |

Query params: `?days=30`, `?platform=google-ads`, `?limit=20&offset=0`

---

### Reports — `/api/reports`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:agencyId/generate` | Generate PDF report |
| GET | `/:agencyId` | List reports |
| GET | `/:agencyId/:reportId` | Report details |
| GET | `/:agencyId/:reportId/download` | Download PDF |
| DELETE | `/:agencyId/:reportId` | Delete report |

---

## Database Schema

11 tables: `agencies`, `users`, `integrations`, `campaigns`, `daily_metrics`, `sync_history`, `reports`, `alerts`, `scheduled_jobs`, `audit_logs`

---

## Rate Limits

| Scope | Limit |
|-------|-------|
| General API | 100 req / 15 min |
| Auth endpoints | 5 req / 15 min |
| Sync endpoints | 10 req / hour |

---

## Error Response Format

```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "code": "ERROR_CODE",
  "timestamp": "2026-05-04T10:00:00.000Z"
}
```
