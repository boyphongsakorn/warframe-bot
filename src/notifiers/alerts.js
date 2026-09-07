import { alertEmbed } from '../utils/embed.js';
import { filterNewAlerts, markAlertsNotified } from '../utils/stateStore.js';

/**
 * alertsNotifier — ตรวจและแจ้งเตือน Alert ที่มีรางวัลสำคัญ
 *
 * ตรวจสอบเฉพาะรางวัลที่ตรงกับ IMPORTANT_REWARDS ใน .env
 * (ค่าเริ่มต้น: Orokin Catalyst, Orokin Reactor, Forma)
 * ใช้ stateStore เทียบ id กันแจ้งซ้ำ
 */

/**
 * อ่านรายการรางวัลที่สนใจจาก env
 * @returns {string[]} array ของคำที่ต้องมีในชื่อรางวัล
 */
function getImportantRewards() {
  const raw = process.env.IMPORTANT_REWARDS || 'Orokin Catalyst,Orokin Reactor,Forma';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * ดึงรายการรางวัลทั้งหมดของ alert มาเป็น string เดียว เพื่อใช้ค้นหาคำสำคัญ
 * @param {object} alert
 * @returns {string}
 */
function rewardText(alert) {
  const reward = alert?.mission?.reward || {};
  const items = [...(reward.items || [])];
  for (const ci of reward.countedItems || []) {
    items.push(`${ci.type || ci.key || ''}`);
  }
  return items.join(' | ');
}

/**
 * ตรวจว่า alert มีรางวัลสำคัญหรือไม่
 * @param {object} alert
 * @returns {boolean}
 */
function hasImportantReward(alert) {
  const text = rewardText(alert).toLowerCase();
  return getImportantRewards().some((kw) => text.includes(kw.toLowerCase()));
}

/**
 * ตรวจ alerts และส่งแจ้งเตือนเฉพาะรายการที่มีรางวัลสำคัญและยังไม่เคยแจ้ง
 * @param {Array} alerts - รายการ alert จาก API (ถ้าเป็น null คือ API ล้มเหลว จะข้าม)
 * @param {import('discord.js').TextChannel} channel - ห้องที่จะส่งข้อความ
 */
export async function checkAndNotifyAlerts(alerts, channel) {
  if (!Array.isArray(alerts) || alerts.length === 0 || !channel) return;

  // ขั้นที่ 1: กรองเฉพาะ alert ที่มีรางวัลสำคัญ
  const important = alerts.filter((a) => {
    try {
      return hasImportantReward(a);
    } catch {
      return false; // ถ้าโครงสร้างแปลกๆ ไม่ต้องแจ้ง กัน error
    }
  });
  if (important.length === 0) return;

  // ขั้นที่ 2: กรองรายการที่เคยแจ้งแล้วออก
  const fresh = filterNewAlerts(important);
  if (fresh.length === 0) return;

  // ขั้นที่ 3: ส่ง embed ทีละรายการ (จัดส่งตามลำดับ)
  const sentIds = [];
  for (const alert of fresh) {
    try {
      await channel.send({ embeds: [alertEmbed(alert)] });
      sentIds.push(alert.id);
      console.log(`[alertsNotifier] ✅ แจ้งเตือน Alert: ${alert.mission?.node ?? alert.id}`);
    } catch (err) {
      // ถ้าส่งรายการนี้ไม่สำเร็จ ข้ามไปรายการถัดไป รอบหน้าจะลองใหม่ (เพราะไม่ได้ mark ว่าแจ้งแล้ว)
      console.error(`[alertsNotifier] ❌ ส่งแจ้งเตือน Alert ${alert.id} ไม่สำเร็จ:`, err.message);
    }
  }

  // ขั้นที่ 4: จดจำเฉพาะรายการที่ส่งสำเร็จ เพื่อไม่ให้แจ้งซ้ำใน polling รอบถัดไป
  markAlertsNotified(sentIds);
}