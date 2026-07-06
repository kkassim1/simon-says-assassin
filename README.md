# Simon Says Assassin

Realtime multiplayer browser game with a Vite/Three.js client and a Node/Socket.IO server.

## Project Layout

- `client/` - Netlify-deployed frontend. Contains the Vite app, Three.js game client, HUD, lobby, settings, and Socket.IO client.
- `server/` - Render-deployed backend. Contains the Express/Socket.IO multiplayer server, rooms, matchmaking, tasks, bots, scoring, and game state.
- `electron/` - Desktop wrapper scaffold for a future Steam build.

## Local Development

Run the backend:

```bash
cd server
npm install
npm start
```

Run the frontend in a second terminal:

```bash
cd client
npm install
npm run dev
```

Local frontend builds automatically connect to `http://localhost:3000` or `http://127.0.0.1:3000` when opened from localhost.

## Deployment

This project is deployed as two separate services:

- Frontend: Netlify
- Backend: Render

The frontend and backend must both be deployed when a change touches Socket.IO events, room logic, matchmaking, game state, or any server/client contract.

## Netlify Frontend

Deploy the `client/` app as a static Vite site.

Recommended Netlify settings:

```text
Base directory: client
Build command: npm run build
Publish directory: dist
```

Required Netlify environment variable:

```text
VITE_SERVER_URL=https://simon-says-assassin.onrender.com
```

If the Render backend URL changes, update `VITE_SERVER_URL` in Netlify and trigger a new frontend deploy. Vite bakes this value into the production frontend at build time.

## Render Backend

Deploy the `server/` app as a Render Web Service.

Recommended Render settings:

```text
Root directory: server
Build command: npm install
Start command: npm start
```

Recommended Render environment variables:

```text
CLIENT_ORIGIN=https://your-netlify-site.netlify.app
RENDER_EXTERNAL_URL=https://simon-says-assassin.onrender.com
```

Render provides `PORT` automatically. The server reads `process.env.PORT`, so no hardcoded production port is needed.

`RENDER_EXTERNAL_URL` enables the server's self-ping keepalive logic in `server/src/index.js`.

## Current Production Backend URL

```text
https://simon-says-assassin.onrender.com
```

This URL is referenced by `client/.env` and should also be set in Netlify as `VITE_SERVER_URL`.

## Deployment Gotcha

Netlify only deploys the browser client. Render deploys the multiplayer server.

For example, if a new frontend button emits a new Socket.IO event like `room:quickplay` or `room:leave`, the Render backend must also be redeployed with the matching server handler. Otherwise the frontend may load correctly, but the feature will not work in production.
