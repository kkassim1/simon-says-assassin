# Simon Says Assassin

Realtime multiplayer browser game with a Vite/Three.js client and a Node/Socket.IO server.

## Play Online

1. Open [kwamkassim.com](https://kwamkassim.com).
2. Select **Simon Says Assassin** from the project library, then choose **Launch Game**. You can also [open the game directly](https://simon-says-assassin.netlify.app/).
3. Enter your name and choose **Quick Play** to join an available lobby or create one automatically.
4. To play with friends, choose **Create Room** and share the four-character room code. Friends open the game, enter the code, and click **Join** before the match starts.
5. The host chooses **Classic** or **Helicopter Sniper**, then clicks **Start Game**. If you joined someone else's room, wait for the host to start.

No installation is needed for online play. You can start alone: empty slots are filled with bots, up to eight players total.

## Play Locally

Install Node.js and npm, then clone or download this repository. Open two terminals in the repository's root folder (`simon-says-assassin`).

In the first terminal, install the backend dependencies and start the server:

```bash
cd server
npm install
npm start
```

In the second terminal, install the frontend dependencies and start the browser app:

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser, or use the local URL printed by Vite if that port is busy. Create a room and click **Start Game**, or follow the room instructions above to join a match. Keep both terminals running while you play; press `Ctrl+C` in each to stop.

The browser automatically connects to the local backend on port `3000` when opened from `localhost` or `127.0.0.1`. No environment-file changes are needed for play on the same computer. To try multiplayer on one computer, open another browser tab and join using the same room code. Local rooms are separate from the online game's rooms.

After the first dependency installation, you can start both services from the repository root with:

```bash
npm run dev
```

### Play Across Devices on the Same Wi-Fi

1. Start the backend on the host computer as described above.
2. Set `VITE_SERVER_URL` in `client/.env.local` to the host computer's LAN address, for example `VITE_SERVER_URL=http://192.168.1.50:3000`. Replace the example address with your computer's actual LAN IP.
3. Start or restart the frontend. Vite is already configured to listen on the network.
4. On every device, open the host's frontend URL, for example `http://192.168.1.50:5173`, then create or join the same room.

Allow connections to ports `3000` and `5173` through the host computer's firewall if prompted. The LAN override makes devices connect to your local backend instead of the production URL configured in `client/.env`.

### If the Game Cannot Connect

- For local play, check that both terminals are still running and the backend reports that it is listening on port `3000`.
- For online play, wait a moment and click **Retry** if the server is starting up.
- If a room cannot be joined, check the code and make sure the match has not started and the room is not full.

## How to Play

Complete tasks to earn points during a ten-minute match. Only follow orders that begin with **Simon says**; obeying a trap order costs points. The highest score wins.

| Action | Keyboard | Touchscreen |
| --- | --- | --- |
| Move | WASD or arrow keys | Left joystick |
| Act: attack, grab, or escape | E or Space | ACT button |
| Sprint | Hold Shift | RUN button |

Get close to your assigned target to attack or grab them. For kidnapping tasks, bring the target to the marked destination. For patrol tasks, visit the listed waypoints. If captured, repeatedly press Act to try to escape.

In **Helicopter Sniper** mode, one random human player becomes the sniper. Aim with the mouse or movement controls, hold Sprint to zoom, and press Act or click to fire. Simon's trap rules still apply.

Use **How to Play** in the lobby for more rules, or **Settings** to adjust the game.

## Project Layout

- `client/` - Netlify-deployed frontend. Contains the Vite app, Three.js game client, HUD, lobby, settings, and Socket.IO client.
- `server/` - Render-deployed backend. Contains the Express/Socket.IO multiplayer server, rooms, matchmaking, tasks, bots, scoring, and game state.
- `electron/` - Desktop wrapper scaffold for a future Steam build.

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
