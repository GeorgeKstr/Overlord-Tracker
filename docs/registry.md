# Service Registry

## Overview

The service registry tracks all services registered under a project. It stores connection metadata, health check URLs, and the current status of each service.

## Service Model

| Field       | Type          | Description                          |
|-------------|---------------|--------------------------------------|
| id          | string (cuid) | Primary key                          |
| name        | string        | Human-readable service name          |
| slug        | string        | URL-safe identifier                  |
| description | string?       | Optional description                 |
| baseUrl     | string?       | Base URL for the service             |
| healthUrl   | string?       | Health check endpoint                |
| status      | ServiceStatus | HEALTHY / DEGRADED / DOWN / UNKNOWN  |
| projectId   | string        | Associated project                   |

## Status Values

- `HEALTHY` — Service is responding normally
- `DEGRADED` — Service is responding but with errors
- `DOWN` — Service is not responding
- `UNKNOWN` — Health check has not been performed

## Health Checking

In Phase 2, the platform will perform periodic health checks against `healthUrl`. For MVP, status is manually set or updated via the ingestion endpoint.

## API Endpoints

| Method | Path                         | Description             |
|--------|------------------------------|-------------------------|
| GET    | /api/services                | List all services       |
| GET    | /api/services/:id            | Get a service           |
| POST   | /api/projects/:id/services   | Create a service        |
| PATCH  | /api/services/:id            | Update a service        |
| DELETE | /api/services/:id            | Delete a service        |
| GET    | /api/services/:id/endpoints  | List endpoints          |
