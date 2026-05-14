import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { loadAdminConfig } from "./adminConfig.js";
import { GameRoom } from "./rooms/GameRoom.js";

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.options("/admin/meta", (_req, res) => res.sendStatus(204));

/** 클라이언트 닉네임 게이트에서만 사용 — 암호는 노출하지 않습니다. */
app.get("/admin/meta", (_req, res) => {
  const { trigger } = loadAdminConfig();
  res.json({ trigger });
});

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
