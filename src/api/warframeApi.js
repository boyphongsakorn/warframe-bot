import axios from 'axios';

/**
 * warframeApi — ฟังก์ชันเรียก api.warframestat.us ทั้งหมด + retry แบบ exponential backoff
 *
 * หมายเหตุ schema (ตรวจสอบจริงจาก GET https://api.warframestat.us/pc วันที่ 2026-09-07):
 * - voidTrader: { id, activation, expiry, character, location, inventory[], psId, initialStart, schedule[] }
 *   *ไม่มี field `active` ในบางช่วงเวลา* -> ต้องคำนวณจาก activation/expiry เอง
 * - alerts[]: { id, activation, expiry, mission: { node, type, faction, minEnemyLevel,
 *   maxEnemyLevel, reward: { items[], countedItems[{count,type,key}], credits } }, tag }
 * - cetusCycle: { id, activation, expiry, isDay, state, timeLeft, isCetus }
 * - fissures[]: { id, activation, expiry, node, missionType, enemy, tier, tierNum, isStorm, isHard }
 * - nightwave: { id, season, activation, expiry, activeChallenges[{ id, activation, expiry,
 *   isDaily, isElite, desc, title, reputation, isPermanent }] }
 */

const BASE_URL = 'https://api.warframestat.us';

/** ค่าเริ่มต้นแพลตฟอร์ม ถ้า env ไม่ได้ตั้ง */
const DEFAULT_PLATFORM = 'pc';

/** platform ที่รองรับ (ตรงกับ endpoint ของ API) */
const VALID_PLATFORMS = ['pc', 'ps4', 'xb1', 'swi'];

/**
 * อ่าน platform จาก env พร้อม validate ถ้าค่าไม่ถูกต้องใช้ 'pc' แทน
 * @returns {string}
 */
export function getPlatform() {
  const p = (process.env.PLATFORM || DEFAULT_PLATFORM).toLowerCase();
  if (!VALID_PLATFORMS.includes(p)) {
    console.warn(
      `[warframeApi] PLATFORM="${p}" ไม่ถูกต้อง ใช้ "pc" แทน (ค่าที่รองรับ: ${VALID_PLATFORMS.join(', ')})`,
    );
    return DEFAULT_PLATFORM;
  }
  return p;
}

/**
 * สร้าง axios instance สำหรับ API นี้โดยเฉพาะ
 * - timeout 15 วินาที
 * - ตั้ง User-Agent ตามที่ API ขอ (api.warframestat.us ต้องการ UA ที่ระบุตัวตน)
 */
const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'User-Agent': 'warframe-discord-bot/1.0 (Discord bot; via axios)',
    Accept: 'application/json',
  },
});

/**
 * เรียก API พร้อม retry แบบ exponential backoff (สูงสุด 3 ครั้ง)
 * - ลองใหม่เมื่อ: network error, timeout, หรือ HTTP status >= 500
 * - ไม่ retry เมื่อ: 4xx (เช่น 404) เพราะเป็นปัญหาฝั่งเราเอง
 *
 * @param {string} path - path ของ endpoint เช่น '/pc/cetusCycle'
 * @param {number} maxRetries - จำนวน retry สูงสุด (default 3)
 * @returns {Promise<any>} ข้อมูล JSON จาก API
 * @throws {Error} ถ้าลองครบทุกครั้งแล้วยังไม่สำเร็จ (caller ต้อง catch เอง เพื่อไม่ให้บอท crash)
 */
export async function fetchWithRetry(path, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await http.get(path);
      return res.data;
    } catch (err) {
      lastError = err;
      // พิจารณาว่าควร retry ไหม: 4xx (นอกจาก 429) ถือว่าเป็น bug ฝั่งเรา ไม่ retry
      const status = err.response?.status;
      const isClientError = status && status >= 400 && status < 500 && status !== 429;
      if (isClientError || attempt === maxRetries) break;

      // exponential backoff: 1s, 2s, 4s ... + jitter เล็กน้อยกัน thundering herd
      const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 300;
      console.warn(
        `[warframeApi] ${path} ล้มเหลว (ครั้งที่ ${attempt}/${maxRetries}, status=${status ?? 'N/A'}) retry ใน ${Math.round(delay)}ms: ${err.message}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Validate โครงสร้างข้อมูลเบื้องต้นก่อนใช้งาน กัน field หายหรือเปลี่ยนชื่อ
 * ถ้าข้อมูลผิดโครงสร้างจะ throw error ให้ caller จัดการ (แต่ไม่ทำให้บอท crash)
 * @param {any} data - ข้อมูลจาก API
 * @param {string} label - ชื่อ endpoint (ใช้ใน error message)
 * @param {Function} check - ฟังก์ชันตรวจ คืน true ถ้าโครงสร้างถูกต้อง
 * @returns {any} data เดิมถ้าผ่านการตรวจ
 */
function validate(data, label, check) {
  if (!check(data)) {
    throw new Error(`[warframeApi] โครงสร้างข้อมูล ${label} ไม่ตรงที่คาดไว้ (schema เปลี่ยน?)`);
  }
  return data;
}

/**
 * คำนวณสถานะ active ของ Baro จาก activation/expiry
 * เพราะ API บางครั้งไม่ส่ง field `active` มาเลย (ตรวจสอบจริงแล้วพบว่าไม่มี field นี้)
 * ถ้ามี field `active` ให้ใช้ค่านั้นเป็นลำดับแรก
 * @param {object} baro
 * @returns {boolean}
 */
export function isBaroActive(baro) {
  if (typeof baro?.active === 'boolean') return baro.active;
  if (!baro?.activation || !baro?.expiry) return false;
  const now = Date.now();
  return now >= Date.parse(baro.activation) && now <= Date.parse(baro.expiry);
}

/** ---------- Endpoint functions ---------- */

/**
 * ดึงสถานะรอบกลางวัน/กลางคืนของ Cetus
 * @returns {Promise<object>} cetusCycle
 */
export async function getCetusCycle() {
  const data = await fetchWithRetry(`/${getPlatform()}/cetusCycle`);
  return validate(data, 'cetusCycle', (d) => d && typeof d.isDay === 'boolean' && d.expiry);
}

/**
 * ดึงรายการ Void Fissures ที่ active อยู่
 * @returns {Promise<Array>} fissures
 */
export async function getFissures() {
  const data = await fetchWithRetry(`/${getPlatform()}/fissures`);
  return validate(
    data,
    'fissures',
    (d) => Array.isArray(d) && d.every((f) => f && f.id && f.node && f.tier),
  );
}

/**
 * ดึงข้อมูล Baro Ki'Teer (voidTrader)
 * @returns {Promise<object>} voidTrader
 */
export async function getVoidTrader() {
  const data = await fetchWithRetry(`/${getPlatform()}/voidTrader`);
  return validate(
    data,
    'voidTrader',
    (d) => d && d.id && d.activation && d.expiry && Array.isArray(d.inventory),
  );
}

/**
 * ดึงรายการ Alerts
 * หมายเหตุ: Digital Extremes ยังมีระบบ Alert อยู่ (มี event alerts เช่น Water Fight)
 * แต่ถ้าอนาคต alerts ถูกยกเลิกไปจริง ให้ fallback ไปใช้ nightwave แทน
 * @returns {Promise<Array>} alerts (อาจเป็น array ว่าง)
 */
export async function getAlerts() {
  const data = await fetchWithRetry(`/${getPlatform()}/alerts`);
  return validate(
    data,
    'alerts',
    (d) => Array.isArray(d) && d.every((a) => a && a.id && a.mission),
  );
}

/**
 * ดึงข้อมูล Nightwave (ใช้เป็น fallback ของ alerts และแสดงในคำสั่ง /alerts)
 * @returns {Promise<object|null>} nightwave หรือ null ถ้าไม่มี season ทำงาน
 */
export async function getNightwave() {
  const data = await fetchWithRetry(`/${getPlatform()}/nightwave`);
  return validate(
    data,
    'nightwave',
    (d) =>
      d === null ||
      (d && typeof d === 'object' && Array.isArray(d.activeChallenges)),
  );
}

/**
 * ดึงข้อมูลจากทุก endpoint พร้อมกัน (ใช้ใน background job)
 * แต่ละอันแยก error กันเอง — ถ้า endpoint ไหนล่ม จะได้ค่า null และ log error
 * โดยไม่กระทบ endpoint อื่น (กัน "อันเดียวล่มทำให้ทั้ง job ตาย")
 * @returns {Promise<{cetus: object|null, fissures: Array|null, baro: object|null,
 *           alerts: Array|null, nightwave: object|null}>}
 */
export async function fetchAll() {
  const [cetus, fissures, baro, alerts, nightwave] = await Promise.allSettled([
    getCetusCycle(),
    getFissures(),
    getVoidTrader(),
    getAlerts(),
    getNightwave(),
  ]);

  const result = {};
  const labels = ['cetus', 'fissures', 'baro', 'alerts', 'nightwave'];
  const settled = [cetus, fissures, baro, alerts, nightwave];
  settled.forEach((r, i) => {
    const key = labels[i];
    if (r.status === 'fulfilled') {
      result[key] = r.value;
    } else {
      console.error(`[warframeApi] ดึงข้อมูล ${key} ไม่สำเร็จ:`, r.reason?.message ?? r.reason);
      result[key] = null;
    }
  });
  return result;
}