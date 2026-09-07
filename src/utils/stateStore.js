import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * stateStore — เก็บ state ล่าสุดของบอทเพื่อป้องกันการแจ้งเตือนซ้ำ
 * เก็บลงไฟล์ state.json เพื่อให้ state ยังอยู่แม้ restart บอท
 * (เช่น ถ้า Baro มาแล้วแล้ว restart บอท จะได้ไม่แจ้งซ้ำอีกรอบ)
 *
 * โครงสร้าง state:
 * {
 *   baroNotified: { id, active },   // id + สถานะ active ครั้งล่าสุดที่แจ้งไปแล้ว
 *   notifiedAlertIds: [ ... ],     // id ของ alerts ที่แจ้งไปแล้ว
 * }
 */

const STATE_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'state.json',
);

const MAX_ALERT_IDS = 200; // เก็บ id แบ็คล็อกไม่เกิน 200 เพื่อกันไฟล์โตไม่จำกัด

/** @type {object|null} state ในหน่วยความจำ (โหลดจากไฟล์ครั้งแรก) */
let state = null;

/**
 * โหลด state จากไฟล์ ถ้าไฟล์ไม่มีหรือเสียหายให้ใช้ค่าเริ่มต้น
 * @returns {object}
 */
export function loadState() {
  if (state) return state;
  const defaults = {
    baroNotified: null, // { id, active }
    notifiedAlertIds: [],
  };
  try {
    if (existsSync(STATE_FILE)) {
      const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      // validate โครงสร้างเบื้องต้นก่อนใช้ กันไฟล์เสียหาย
      state = {
        baroNotified: parsed.baroNotified ?? defaults.baroNotified,
        notifiedAlertIds: Array.isArray(parsed.notifiedAlertIds)
          ? parsed.notifiedAlertIds
          : [],
      };
    } else {
      state = defaults;
    }
  } catch (err) {
    console.error('[stateStore] โหลด state ไม่สำเร็จ ใช้ค่าเริ่มต้นแทน:', err.message);
    state = defaults;
  }
  return state;
}

/**
 * บันทึก state ลงไฟล์ (เรียกทุกครั้งหลังแจ้งเตือน)
 */
export function saveState() {
  try {
    // ตัดรายการ alert ids เก่าออกให้เหลือตามจำกัด (เก็บตัวล่าสุดไว้)
    if (state.notifiedAlertIds.length > MAX_ALERT_IDS) {
      state.notifiedAlertIds = state.notifiedAlertIds.slice(-MAX_ALERT_IDS);
    }
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    // ไม่ให้ error การเขียนไฟล์ทำให้บอท crash — log ไว้อย่างเดียว
    console.error('[stateStore] บันทึก state ไม่สำเร็จ:', err.message);
  }
}

/**
 * ตรวจว่าเคยแจ้ง Baro ครั้งนี้ไปแล้วหรือยัง
 * แจ้งซ้ำก็ต่อเมื่อ "id เปลี่ยน" หรือ "active เปลี่ยนจาก false เป็น true" เท่านั้น
 * @param {string} baroId - id ของ voidTrader
 * @param {boolean} isActive - สถานะ active ปัจจุบัน
 * @returns {boolean} true ถ้ายังไม่เคยแจ้ง (ควรแจ้งเลย)
 */
export function shouldNotifyBaro(baroId, isActive) {
  const s = loadState();
  // ยังไม่เคยแจ้งเลย -> แจ้งได้
  if (!s.baroNotified) return true;
  // รอบใหม่ (id ต่างจากที่แจ้งล่าสุด) -> แจ้งได้
  if (s.baroNotified.id !== baroId) return true;
  // รอบเดิม: แจ้งเฉพาะตอน active เพิ่งเปลี่ยน false -> true และยังไม่เคยแจ้งตอน active
  return isActive && !s.baroNotified.active;
}

/**
 * ทำเครื่องหมายว่าแจ้ง Baro ไปแล้ว
 * @param {string} baroId
 * @param {boolean} isActive
 */
export function markBaroNotified(baroId, isActive) {
  const s = loadState();
  s.baroNotified = { id: baroId, active: Boolean(isActive) };
  saveState();
}

/**
 * กรองรายการ alerts เหลือเฉพาะตัวที่ยังไม่เคยแจ้ง
 * @param {Array<object>} alerts
 * @returns {Array<object>} alerts ที่ยังไม่เคยแจ้ง
 */
export function filterNewAlerts(alerts) {
  const s = loadState();
  const known = new Set(s.notifiedAlertIds);
  return (alerts || []).filter((a) => !known.has(a.id));
}

/**
 * ทำเครื่องหมายว่าแจ้ง alert ไปแล้ว
 * @param {Array<string>} alertIds - id ที่เพิ่งแจ้ง
 */
export function markAlertsNotified(alertIds) {
  if (!alertIds || alertIds.length === 0) return;
  const s = loadState();
  s.notifiedAlertIds.push(...alertIds);
  saveState();
}