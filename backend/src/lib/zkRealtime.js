const ZKLib = require("node-zklib");
const prisma = require("../../libs/prisma");
const { classifyPunchType } = require("./attendancePunchType");

const DEVICE_IP = process.env.ZK_IP || "192.128.69.33";
const DEVICE_PORT = parseInt(process.env.ZK_PORT || "4370");
const DEVICE_TIMEOUT = 10000;
const DEVICE_INPORT = 4000;
const RECONNECT_DELAY = 30000;

class ZKRealtimeManager {
  constructor() {
    this.clients = new Set();        // authenticated (attendance page)
    this.displayClients = new Set(); // unauthenticated (TV display) — no PII
    this.zk = null;
    this.connected = false;
    this._connecting = false;
    this._heartbeatId = null;
    this._reconnectId = null;
    this._keepAlive = false;
  }

  start() {
    this._keepAlive = true;
    if (!this.connected && !this._connecting) this._connect();
  }

  stop() {
    this._keepAlive = false;
    if (this._reconnectId) {
      clearTimeout(this._reconnectId);
      this._reconnectId = null;
    }
    return this._disconnect();
  }

  addClient(res) {
    this.clients.add(res);
    res.write(`data: ${JSON.stringify({ type: "status", connected: this.connected })}\n\n`);
    if (!this.connected && !this._connecting) this._connect();
  }

  removeClient(res) {
    this.clients.delete(res);
    if (!this._keepAlive && this.clients.size === 0 && this.displayClients.size === 0) this._disconnect();
  }

  addDisplayClient(res) {
    this.displayClients.add(res);
    res.write(`data: ${JSON.stringify({ type: "status", connected: this.connected })}\n\n`);
    if (!this.connected && !this._connecting) this._connect();
  }

  removeDisplayClient(res) {
    this.displayClients.delete(res);
    if (!this._keepAlive && this.clients.size === 0 && this.displayClients.size === 0) this._disconnect();
  }

  _scheduleReconnect() {
    if (!this._keepAlive || this._reconnectId || this._connecting || this.connected) return;
    this._reconnectId = setTimeout(() => {
      this._reconnectId = null;
      if (this._keepAlive && !this.connected && !this._connecting) this._connect();
    }, RECONNECT_DELAY);
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

  broadcastDisplayPunch(punch) {
    this._broadcastDisplay({
      type: "punch",
      punch_time: punch.punch_time instanceof Date ? punch.punch_time.toISOString() : punch.punch_time,
      punch_type: punch.punch_type,
      user_id: punch.user_id ?? null,
    });
  }

  async _connect() {
    if (this._reconnectId) {
      clearTimeout(this._reconnectId);
      this._reconnectId = null;
    }
    this._connecting = true;
    try {
      this.zk = new ZKLib(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, DEVICE_INPORT);
      await this.zk.createSocket();
      this.connected = true;
      this._connecting = false;
      console.log(`[ZKRealtime] connected to ${DEVICE_IP}:${DEVICE_PORT}`);
      this._broadcast({ type: "status", connected: true });
      this._broadcastDisplay({ type: "status", connected: true });

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

        const punchType = await classifyPunchType(prisma, deviceUid, punchTime, log.inOutStatus);

        await prisma.attendance.upsert({
          where: { device_uid_punch_time: { device_uid: deviceUid, punch_time: punchTime } },
          create: { device_uid: deviceUid, punch_time: punchTime, punch_type: punchType, user_id: user?.id ?? null },
          update: { punch_type: punchType, user_id: user?.id ?? null },
        }).catch(() => {});

        this._broadcast({
          type: "punch",
          device_uid: deviceUid,
          punch_time: punchTime.toISOString(),
          punch_type: punchType,
          user: user ?? null,
        });
        // Display feed: no PII — only user_id so TV screen can look up its local leaderboard data
        this._broadcastDisplay({
          type: "punch",
          punch_time: punchTime.toISOString(),
          punch_type: punchType,
          user_id: user?.id ?? null,
        });
      });
    } catch (err) {
      console.error("[ZKRealtime] connect failed:", err.message);
      this._connecting = false;
      this.connected = false;
      this.zk = null;
      this._broadcast({ type: "status", connected: false });
      this._broadcastDisplay({ type: "status", connected: false });
      this._scheduleReconnect();
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
