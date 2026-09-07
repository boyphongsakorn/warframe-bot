import { isBaroActive } from '../api/warframeApi.js';
import { baroArrivalEmbed } from '../utils/embed.js';
import { shouldNotifyBaro, markBaroNotified } from '../utils/stateStore.js';

/**
 * baroNotifier — ตรวจและแจ้งเตือนเมื่อ Baro Ki'Teer มาถึง
 *
 * เงื่อนไขการแจ้ง: สถานะ active เพิ่งเปลี่ยนจาก false -> true
 * (ใช้ stateStore เทียบกับรอบก่อนหน้า ป้องกันแจ้งซ้ำทุก polling cycle)
 */

/**
 * ตรวจสถานะ Baro และส่งแจ้งเตือนถ้าเพิ่งมาถึง
 * @param {object} baro - ข้อมูล voidTrader จาก API (ถ้าเป็น null คือ API ล้มเหลว จะข้าม)
 * @param {import('discord.js').TextChannel} channel - ห้องที่จะส่งข้อความ
 */
export async function checkAndNotifyBaro(baro, channel) {
  if (!baro || !channel) return;

  const active = isBaroActive(baro);

  // ถ้า Baro ยังไม่ active ไม่ต้องทำอะไร (แจนเตือนเฉพาะตอน "มาถึง")
  if (!active) {
    // บันทึกสถานะล่าสุดเป็น inactive ไว้ เพื่อให้ตอนที่ active ขึ้นมารู้ว่าเป็นการเปลี่ยนสถานะ
    if (shouldNotifyBaro(baro.id, false)) {
      // ยังไม่เคยเห็น id นี้: จดไว้เฉยๆ ยังไม่แจ้ง (ป้องกัน spam ตอนบอทเพิ่ง start และ Baro ยังไม่มา)
      markBaroNotified(baro.id, false);
    }
    return;
  }

  // Baro active อยู่ — เช็คว่าเคยแจ้งรอบนี้หรือยัง
  if (!shouldNotifyBaro(baro.id, true)) return;

  try {
    await channel.send({ embeds: [baroArrivalEmbed(baro)] });
    markBaroNotified(baro.id, true);
    console.log(`[baroNotifier] ✅ แจ้งเตือน Baro มาถึงแล้ว (${baro.location})`);
  } catch (err) {
    // ไม่ mark ว่าแจ้งแล้ว เพื่อให้รอบถัดไปลองส่งใหม่ (เช่น Discord rate limit ชั่วคราว)
    console.error('[baroNotifier] ❌ ส่งข้อความแจ้งเตือน Baro ไม่สำเร็จ:', err.message);
  }
}