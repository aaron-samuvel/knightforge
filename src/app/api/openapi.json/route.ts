import { NextResponse } from 'next/server'

/**
 * GET /api/openapi.json — OpenAPI 3.1 description of the KnightForge REST API.
 * Importable into Swagger UI / Postman / Insomnia.
 */
export async function GET() {
  const json = {
    openapi: '3.1.0',
    info: {
      title: 'KnightForge API',
      version: '1.0.0',
      description:
        'REST surface of the KnightForge chess platform. Realtime gameplay runs over a separate socket.io connection; this document covers the HTTP API only.',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'kf_session',
          description: 'HS256 session JWT set on login (httpOnly).',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
    paths: {
      '/api/health': {
        get: { summary: 'Liveness probe', responses: { '200': { description: 'OK' } } },
      },
      '/api': {
        get: { summary: 'Endpoint index', responses: { '200': { description: 'OK' } } },
      },
      '/api/auth/register': {
        post: {
          summary: 'Create an account (rate-limited: 5/10min per IP)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string', minLength: 1, maxLength: 20 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Account created' },
            '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '429': { description: 'Rate limited' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Sign in (rate-limited: 8/5min per IP); sets the kf_session cookie',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Signed in' },
            '401': { description: 'Invalid credentials' },
            '429': { description: 'Rate limited' },
          },
        },
      },
      '/api/auth/logout': {
        post: { summary: 'Clear the session cookie', responses: { '200': { description: 'OK' } } },
      },
      '/api/auth/me': {
        get: {
          summary: 'Current session user',
          security: [{ sessionCookie: [] }],
          responses: {
            '200': { description: 'Session user or null' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          summary: 'Request a password reset token (rate-limited: 4/10min per IP)',
          responses: { '200': { description: 'Accepted' }, '429': { description: 'Rate limited' } },
        },
      },
      '/api/auth/reset-password': {
        post: {
          summary: 'Reset the password with a token (rate-limited: 8/10min per IP)',
          responses: { '200': { description: 'Password updated' }, '429': { description: 'Rate limited' } },
        },
      },
      '/api/games': {
        get: {
          summary: 'Recent finished games',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
          ],
          responses: { '200': { description: 'Games list' } },
        },
      },
      '/api/games/{id}/pgn': {
        get: {
          summary: 'Raw PGN of a finished game',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'PGN payload' },
            '404': { description: 'Not found' },
          },
        },
      },
      '/api/games/{id}/analysis': {
        get: {
          summary: 'Persisted Pro Review result for a game (null when not analyzed)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Analysis or null' } },
        },
        post: {
          summary: 'Save a completed Pro Review run (requires session)',
          security: [{ sessionCookie: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['whiteAccuracy', 'blackAccuracy', 'moveReports', 'depth'],
                  properties: {
                    whiteAccuracy: { type: 'number', minimum: 0, maximum: 100 },
                    blackAccuracy: { type: 'number', minimum: 0, maximum: 100 },
                    moveReports: { type: 'string', description: 'JSON array of per-move reports' },
                    depth: { type: 'integer', minimum: 0, maximum: 40 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Saved' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Game not found' },
          },
        },
      },
      '/api/games/finish': {
        post: {
          summary: 'Persist a finished game and apply Elo updates (server-validated)',
          security: [{ sessionCookie: [] }],
          responses: { '200': { description: 'Game stored' } },
        },
      },
      '/api/leaderboard': {
        get: {
          summary: 'Global ranking by Elo (nationality, age, rating)',
          parameters: [{ name: 'take', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }],
          responses: { '200': { description: 'Ranking rows' } },
        },
      },
      '/api/leaderboard/stream': {
        get: {
          summary: 'Server-Sent Events stream of leaderboard updates (fallback realtime transport)',
          responses: { '200': { description: 'text/event-stream' } },
        },
      },
      '/api/players/{name}': {
        get: {
          summary: 'Public player profile with recent rated games',
          parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Profile' },
            '404': { description: 'Player not found' },
          },
        },
      },
      '/api/profile': {
        patch: {
          summary: 'Update the signed-in profile (displayName, bio, avatarColor, country, birthYear, preferences)',
          security: [{ sessionCookie: [] }],
          responses: {
            '200': { description: 'Updated' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/puzzles': {
        get: { summary: 'Puzzle pool', responses: { '200': { description: 'Puzzles' } } },
      },
      '/api/puzzles/daily': {
        get: { summary: "Today's challenge puzzle", responses: { '200': { description: 'Puzzle' } } },
      },
      '/api/puzzles/attempt': {
        post: { summary: 'Record a puzzle attempt', responses: { '200': { description: 'Recorded' } } },
      },
      '/api/users': {
        get: {
          summary: 'Public user lookup (never exposes credentials)',
          parameters: [{ name: 'name', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'User' }, '404': { description: 'Not found' } },
        },
        post: { summary: 'Create/ensure a local user by name', responses: { '201': { description: 'Created' } } },
      },
      '/api/analyses': {
        get: {
          summary: 'Library of persisted Pro Reviews (newest first)',
          parameters: [
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
          ],
          responses: { '200': { description: 'Saved analyses with game metadata' } },
        },
      },
      '/api/friends': {
        get: {
          summary: 'Friends, incoming and outgoing friend requests (requires session)',
          security: [{ sessionCookie: [] }],
          responses: {
            '200': { description: 'Social graph of the signed-in user' },
            '401': { description: 'Unauthorized' },
          },
        },
        post: {
          summary: 'Send a friend request by username (rate-limited: 10/5min per IP)',
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', minLength: 3, maxLength: 20 } },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Request sent' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Player not found' },
            '409': { description: 'Relationship already exists' },
            '429': { description: 'Rate limited' },
          },
        },
      },
      '/api/friends/{id}': {
        patch: {
          summary: 'Accept, decline or block a friend request (recipient only)',
          security: [{ sessionCookie: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: { action: { type: 'string', enum: ['accept', 'decline', 'block'] } },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Updated' },
            '403': { description: 'Not the recipient' },
            '404': { description: 'Request not found' },
          },
        },
        delete: {
          summary: 'Remove a friendship or cancel a request (either party)',
          security: [{ sessionCookie: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Removed' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Not found' },
          },
        },
      },
      '/api/import/featured': {
        get: { summary: 'Featured master games', responses: { '200': { description: 'Games' } } },
      },
      '/api/import/games': {
        post: { summary: 'Import a PGN into the analysis collection', responses: { '200': { description: 'Imported' } } },
      },
    },
  }

  return NextResponse.json(json, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
