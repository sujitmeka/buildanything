# Architecture: TaskPilot

TaskPilot is a lightweight task management tool for freelancers. The system lets users create projects, add tasks with due dates, and track completion. It uses a simple client-server model with a REST API and a single-page frontend.

The tech stack is intentionally minimal: a React frontend bundled with Vite, a Node.js backend with Express, and SQLite for persistence. Authentication uses magic links sent via email. The whole thing deploys as a single Docker container on Railway.

## Notes

We considered using a more complex architecture with microservices and a message queue, but decided against it given the single-user nature of the product. The monolith approach keeps operational complexity low and deployment simple.

The frontend communicates with the backend exclusively through REST endpoints. There is no WebSocket layer or real-time sync — users refresh to see updates from other devices. This is acceptable for the target persona (solo freelancer managing their own tasks).

## Approach

The general approach is to keep everything as simple as possible. No ORM — raw SQL queries via better-sqlite3. No state management library — React useState and useContext. No CSS framework — plain CSS modules with a small set of design tokens.

API endpoints follow REST conventions. Authentication middleware checks the magic link token on every request. Rate limiting is handled at the reverse proxy level (Railway's built-in rate limiter).

The database schema has three tables: users, projects, and tasks. Tasks belong to projects, projects belong to users. No many-to-many relationships, no soft deletes, no audit trail. Deleted items are gone.

Error handling is minimal but consistent: all API errors return `{ error: string, code: number }`. The frontend shows a toast for transient errors and a full-page error boundary for fatal ones.

## Deployment Thoughts

Railway handles TLS termination and provides a Postgres addon, but we're using SQLite instead to avoid the connection pooling complexity. The SQLite file lives on a persistent volume mounted at `/data/taskpilot.db`.

Backups run via a cron job that copies the SQLite file to an S3 bucket every 6 hours. No point-in-time recovery — if we lose data between backups, it's gone. Acceptable for a solo freelancer tool.

CI/CD is a GitHub Action that builds the Docker image and pushes to Railway on merge to main. No staging environment — preview deploys go straight to a temporary Railway service.
