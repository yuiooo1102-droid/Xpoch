import express from "express";
import cors from "cors";
import { createServer } from "http";
import { SessionManager } from "./session-manager";
import { WsHandler } from "./ws-handler";
import { createApiRoutes } from "./api-routes";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

const sessionManager = new SessionManager();
const wsHandler = new WsHandler(server);

app.use("/api", createApiRoutes(sessionManager, wsHandler));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

server.listen(PORT, () => {
  console.log(`Xpoch server running on http://localhost:${PORT}`);
  console.log(`WebSocket available on ws://localhost:${PORT}`);
});
