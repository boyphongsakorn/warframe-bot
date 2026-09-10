import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection, Events } from 'discord.js';
import cron from 'node-cron';
import { fetchAll } from './api/warframeApi.js';
import { checkAndNotifyBaro } from './notifiers/baro.js';
import { checkAndNotifyAlerts } from './notifiers/alerts.js';
import { loadState } from './utils/stateStore.js';
import * as cetus from './commands/cetus.js';
import * as fissures from './commands/fissures.js';
import * as baro from './commands/baro.js';
import * as alerts from './commands/alerts.js';
import * as sortie from './commands/sortie.js';
import * as archon from './commands/archon.js';
import * as arbitration from './commands/arbitration.js';
import * as invasions from './commands/invasions.js';
import * as news from './commands/news.js';
import * as nightwave from './commands/nightwave.js';

/**
 * index.js — entry point ของบอท
 * 1) login Discord, 2) ลงทะเบียน slash commands, 3) ตั้ง cron polling แจ้งเตือน
 */

// ---------- Validate config ก่อนเริ่มทำงาน ----------
const requiredEnv = ['DISCORD_TOKEN', 'NOTIFY_CHANNEL_ID'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ ไม่พบค่า ${key} ในไฟล์ .env — ดูวิธีตั้งค่าใน .env.example`);
    process.exit(1);
  }
}

// อ่านความถี่ในการเช็ค API (นาที) — validate ให้อยู่ช่วง 1-60 นาที
const CHECK_INTERVAL_MINUTES = (() => {
  const n = Number(process.env.CHECK_INTERVAL_MINUTES || 5);
  if (!Number.isFinite(n) || n < 1 || n > 60) {
    console.warn(`[index] CHECK_INTERVAL_MINUTES="${process.env.CHECK_INTERVAL_MINUTES}" ไม่ถูกต้อง ใช้ 5 นาทีแทน`);
    return 5;
  }
  return n;
})();

// ---------- สร้าง Discord client ----------
// ใช้ intent น้อยที่สุดเท่าที่จำเป็น (ไม่ต้องฟังข้อความ นอกจาก slash command)
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// โหลด slash commands ลง collection เพื่อหาตัวจัดการจากชื่อคำสั่ง
client.commands = new Collection();
for (const cmd of [cetus, fissures, baro, alerts, sortie, archon, arbitration, invasions, news, nightwave]) {
  client.commands.set(cmd.data.name, cmd);
}

// ---------- Slash command handler ----------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    // กัน double-reply: ถ้ายังไม่เคย reply/editReply ให้แจ้ง error อย่างน้อยหนึ่งครั้ง
    console.error(`[index] คำสั่ง /${interaction.commandName} ผิดพลาด:`, err);
    const msg = { content: '❌ เกิดข้อผิดพลาดภายในบอท ลองอีกครั้งภายหลัง', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ---------- Background polling job ----------
/**
 * รันหนึ่งรอบของ polling: ดึงข้อมูลทุก endpoint แล้วเรียก notifier แต่ตัว
 * ออกแบบให้ "ไม่มีทาง" throw ออกมา (catch ทุกจุด) เพื่อไม่ให้บอท crash
 */
async function pollOnce() {
  console.log(`[poll] ⏰ เริ่มตรวจสอบข้อมูล Warframe (${new Date().toISOString()})`);

  // หา channel ปลายทางก่อน — ถ้าหาไม่เจอ (เช่น ID ผิดหรือบอทไม่อยู่เซิร์ฟเวอร์นั้น) ให้ log แล้วข้าม
  const channelId = process.env.NOTIFY_CHANNEL_ID;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
    console.error(`[poll] ❌ หาห้องแจ้งเตือน (ID: ${channelId}) ไม่เจอ — ตรวจสอบ NOTIFY_CHANNEL_ID ใน .env`);
    return;
  }

  const data = await fetchAll(); // แต่ละ endpoint แยก error กันเอง (ค่า null ถ้าล้มเหลว)

  // แจ้งเตือน Baro (เมื่อ active false -> true)
  await checkAndNotifyBaro(data.baro, channel).catch((err) =>
    console.error('[poll] baro notifier ผิดพลาด:', err.message),
  );

  // แจ้งเตือน Alert ที่มีรางวัลสำคัญ
  await checkAndNotifyAlerts(data.alerts, channel).catch((err) =>
    console.error('[poll] alerts notifier ผิดพลาด:', err.message),
  );
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ บอทล็อกอินแล้วในชื่อ ${c.user.tag}`);

  // ลงทะเบียน slash commands แบบ global (ใช้เวลาแพร่กระจายสักครู่ ปกติภายใน 1 นาที)
  const commandsData = [
    cetus, fissures, baro, alerts, sortie, archon, arbitration, invasions, news, nightwave,
  ].map((cmd) => cmd.data.toJSON());
  try {
    await c.application.commands.set(commandsData);
    console.log(
      '✅ ลงทะเบียน slash commands แล้ว: /cetus /fissures /baro /alerts /sortie /archon /arbitration /invasions /news /nightwave',
    );
  } catch (err) {
    console.error('❌ ลงทะเบียน slash commands ไม่สำเร็จ:', err);
  }

  // โหลด state (กันแจ้งเตือนซ้ำ)
  loadState();

  // ตั้ง cron: รันทุก N นาที
  // ใช้ expression `*/N * * * *` เช่น N=5 -> ทุก 5 นาที
  // หมายเหตุ: node-cron รองรับเฉพาะค่าที่หาร 60 ลงตัวเท่านั้น (1,2,3,4,5,6,10,12,15,20,30)
  // ถ้าใส่ค่าอื่น (เช่น 7) จะ fallback เป็น "ทุกนาทีที่หารด้วย 7 เศษ 0" ซึ่งยังทำงานได้ใกล้เคียง
  const cronExpr = `*/${CHECK_INTERVAL_MINUTES} * * * *`;
  cron.schedule(cronExpr, () => {
    pollOnce().catch((err) => console.error('[poll] รอบตรวจสอบผิดพลาด:', err));
  });
  console.log(`⏳ ตั้งเวลาตรวจสอบ API ทุก ${CHECK_INTERVAL_MINUTES} นาที (cron: ${cronExpr})`);

  // รันหนึ่งรอบทันทีตอนสตาร์ท เพื่อให้ข้อมูล (และแจ้งเตือนถ้ามีของใหม่) มาเร็ว
  await pollOnce().catch((err) => console.error('[poll] รอบแรกผิดพลาด:', err));
});

// ---------- Login ----------
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('❌ ล็อกอิน Discord ไม่สำเร็จ — ตรวจสอบ DISCORD_TOKEN ใน .env:', err.message);
  process.exit(1);
});