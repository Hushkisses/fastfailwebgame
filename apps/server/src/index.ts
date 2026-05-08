import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom.js";

const app = express();
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  server
});

gameServer.define("failure-growth", GameRoom);
app.use("/colyseus", monitor());
app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT ?? 2567);
server.listen(port, () => {
  console.log(`Game server listening on :${port}`);
});
