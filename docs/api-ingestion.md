# API Ingestion

## Overview

The API ingestion module receives metadata about services, controllers, and endpoints. This allows the platform to maintain a live, queryable registry of all APIs across the organization.

## Ingest Endpoint

```
POST /api/ingestion/controllers
Authorization: Bearer <jwt>
```

## Payload Schema

```json
{
  "projectKey": "string",
  "service": "string",
  "controllers": [
    {
      "name": "string",
      "basePath": "string",
      "endpoints": [
        {
          "method": "GET | POST | PUT | PATCH | DELETE",
          "path": "string",
          "handler": "string",
          "description": "string (optional)"
        }
      ]
    }
  ]
}
```

## Example

```json
{
  "projectKey": "estate-dashboard",
  "service": "core-api",
  "controllers": [
    {
      "name": "ProjectController",
      "basePath": "/api/projects",
      "endpoints": [
        { "method": "GET", "path": "/", "handler": "listProjects" },
        { "method": "POST", "path": "/", "handler": "createProject" },
        { "method": "GET", "path": "/:id", "handler": "getProject" },
        { "method": "PATCH", "path": "/:id", "handler": "updateProject" },
        { "method": "DELETE", "path": "/:id", "handler": "deleteProject" }
      ]
    }
  ]
}
```

## Behavior

1. Validates the `projectKey` exists in the database
2. Upserts the service record by `(projectId, slug)`
3. Replaces all controllers for the service (full refresh)
4. Stores an ingestion event for audit purposes

## Integration

Services should call this endpoint during their startup or as part of CI/CD to keep the registry current.
