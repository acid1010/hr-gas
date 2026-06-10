const ZKLib = require("node-zklib");
const prisma = require("../../libs/prisma");

const DEVICE_IP = process.env.ZK_IP || "192.128.69.33";
const DEVICE_PORT = parseInt(process.env.ZK_PORT || "4370");
const DEVICE_TIMEOUT = 10000;
const DEVICE_INPORT = 4000;

class ZKRealtimeManager {
  constructor() {
    this.clients = new Set();        // authenticated (attendance page)
    this.displayClients = new Set(); // unauthenticated (TV display) — no PII
    this.zk = null;
    this.connected = false;
    this._connecting = false;
    this._heartbeatId = null;
  }

  addClient(res) {
    this.clients.add(res);
    res.write(`data: ${JSON.stringify({ type: "status", connected: this.connected })}\n\n`);
    if (!this.connected && !this._connecting) this._connect();
  }

  removeClient(res) {
    this.clients.delete(res);
    if (this.clients.size === 0 && this.displayClients.size === 0) this._disconnect();
  }

  addDisplayClient(res) {
    this.displayClients.add(res);
    res.write(`data: ${JSON.stringify({ type: "status", connected: this.connected })}\n\n`);
    if (!this.connected && !this._connecting) this._connect();
  }

  removeDisplayClient(res) {
    this.displayClients.delete(res);
    if (this.clients.size === 0 && this.displayClients.size === 0) this._disconnect();
  }

  _broadcast(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of this.clients) {
      try { res.write(payload); } catch {}
    }
  }

  _broadcastDisplay(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of this.displayClients) {
      try { res.write(payload); } catch {}
    }
  }

  async _connect() {
    this._connecting = true;
    try {
      this.zk = new ZKLib(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, DEVICE_INPORT);
      await this.zk.createSocket();
      this.connected = true;
      this._connecting = false;
      this._broadcast({ type: "status", connected: true });

      this._heartbeatId = setInterval(() => {
        this._broadcast({ type: "heartbeat" });
      }, 25000);

      await this.zk.getRealTimeLogs(async (log) => {
        if (!log?.userId) return;
        const deviceUid = String(log.userId).trim();
        const punchTime = log.attTime instanceof Date ? log.attTime : new Date();

        const user = await prisma.users.findFirst({
          where: { nik: parseFloat(deviceUid), deletedAt: null },
          select: { id: true, name: true, nik: true, departement: true, link_image: true },
        }).catch(() => null);

        await prisma.attendance.upsert({
          where: { device_uid_punch_time: { device_uid: deviceUid, punch_time: punchTime } },
          create: { device_uid: deviceUid, punch_time: punchTime, punch_type: 0, user_id: user?.id ?? null },
          update: { user_id: user?.id ?? null },
        }).catch(() => {});

        this._broadcast({
          type: "punch",
          device_uid: deviceUid,
          punch_time: punchTime.toISOString(),
          punch_type: 0,
          user: user ?? null,
        });
        // Display feed: no PII — only user_id so TV screen can look up its local leaderboard data
        this._broadcastDisplay({
          type: "punch",
          punch_time: punchTime.toISOString(),
          punch_type: 0,
          user_id: user?.id ?? null,
        });
      });
    } catch (err) {
      console.error("[ZKRealtime] connect failed:", err.message);
      this._connecting = false;
      this.connected = false;
      this.zk = null;
      this._broadcast({ type: "status", connected: false });
    }
  }

  async _disconnect() {
    if (this._heartbeatId) {
      clearInterval(this._heartbeatId);
      this._heartbeatId = null;
    }
    if (this.zk) {
      try { await this.zk.disconnect(); } catch {}
      this.zk = null;
    }
    this.connected = false;
    this._connecting = false;
  }
}

module.exports = new ZKRealtimeManager();
