# Third-party notices

Creator Intelligence code and project documentation are MIT-licensed by Steven Patrick Buglione.
Third-party packages, images, services and content retain their own licenses and terms.
No dependency source or binary is vendored in this repository; the lockfile and Dockerfile
identify what installers retrieve. Preserve upstream notices when distributing built artifacts.

The Docker stack references Node.js, PostgreSQL/pgvector and Redis 7.4 images. In particular,
Redis 7.4 uses RSALv2 or SSPLv1, not this project's MIT license. See the
[Redis 7.4 license](https://github.com/redis/redis/blob/7.4/LICENSE.txt).
This release does not claim every dependency uses an OSI-approved license.
Google/YouTube APIs and any configured AI or production provider have separate terms.

Direct JavaScript dependency license metadata is listed below. For transitive dependencies
use `pnpm licenses list` after installation and inspect each package's included notices.

| Package | Installed version | License metadata |
|---|---|---|
| @fastify/cookie | 11.1.3 | MIT |
| @fastify/cors | 11.3.1 | MIT |
| @fastify/rate-limit | 11.2.1 | MIT |
| @fastify/swagger | 9.9.2 | MIT |
| @modelcontextprotocol/sdk | 1.32.1 | MIT |
| bullmq | 6.3.15 | MIT |
| csv-parse | 7.0.3 | MIT |
| drizzle-orm | 0.45.4 | Apache-2.0 |
| fastify | 5.12.7 | MIT |
| google-auth-library | 11.3.1 | Apache-2.0 |
| ioredis | 6.0.0 | MIT |
| luxon | 3.7.2 | MIT |
| next | 16.4.2 | MIT |
| pg | 8.23.1 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| zod | 4.6.7 | MIT |
| @playwright/test | 1.64.1 | Apache-2.0 |
| @types/node | 24.19.1 | MIT |
| @types/pg | 8.23.1 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| @types/luxon | 3.7.6 | MIT |
| eslint | 10.13.0 | MIT |
| typescript-eslint | 8.71.2 | MIT |
| prettier | 3.9.10 | MIT |
| lefthook | 2.2.2 | MIT |
| tsx | 4.23.15 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| vitest | 5.0.5 | MIT |
