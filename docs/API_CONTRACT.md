# API contract

All errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is invalid.",
    "details": {}
  }
}
```

## System

- `GET /api/health`

## Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Forms

- `GET /api/forms`
- `POST /api/forms`
- `GET /api/forms/:formId`
- `PATCH /api/forms/:formId`
- `DELETE /api/forms/:formId`
- `POST /api/forms/:formId/duplicate`
- `POST /api/forms/:formId/publish`

## Public forms

- `GET /api/public/forms/:slug`
- `POST /api/public/forms/:slug/submissions`

## Responses

- `GET /api/forms/:formId/submissions`
- `GET /api/forms/:formId/analytics`
