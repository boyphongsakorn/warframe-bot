# Warframe Discord Bot 🎮

Discord bot สำหรับแจ้งเตือนกิจกรรมและเวลาในเกม **Warframe** ดึงข้อมูลจาก public API [api.warframestat.us](https://api.warframestat.us) (ไม่ต้องใช้ API key)

## ฟีเจอร์

- **แจ้งเตือน Baro Ki'Teer มาถึง** — ส่ง embed บอก Relay, เวลาที่อยู่ถึง, และสินค้าทั้งหมดพร้อมราคา (credits + ducats)
- **แจ้งเตือน Alert รางวัลพิเศษ** — กรองเฉพาะรางวัลที่กำหนดใน config (เช่น Orokin Catalyst, Reactor, Forma)
- **Slash commands** (กดคำสั่งได้ทันที ไม่ต้องรอ background job):
  - `/cetus` — สถานะกลางวัน/กลางคืนของ Cetus + เวลาที่เหลือ (สำหรับล่า Eidolon)
  - `/fissures` — Void Fissures ที่เปิดอยู่ แยกตาม tier (กรอง tier เฉพาะได้)
  - `/baro` — สถานะ Baro ปัจจุบัน
  - `/alerts` — Alerts + Nightwave challenges ที่แอคทีฟอยู่
  - `/sortie` — ภารกิจ Sortie รายวัน (3 ขั้น + modifier + รางวัล)
  - `/archon` — ภารกิจ Archon Hunt รายสัปดาห์
  - `/arbitration` — ภารกิจ Arbitration ปัจจุบัน (โหนด/ประเภท/เวลาหมดอายุ)
  - `/invasions` — Invasions พร้อมรางวัลทั้งสองฝั่ง (กรองรางวัลที่ต้องการฟาร์มได้)
  - `/news` — ข่าวและประกาศล่าสุด
  - `/nightwave` — Nightwave challenges แยก Daily / Weekly / Elite
- **Background polling** ด้วย `node-cron` ทุก 5 นาที (ปรับได้) พร้อมเก็บ state กันแจ้งเตือนซ้ำ
- **Retry แบบ exponential backoff** (สูงสุด 3 ครั้ง) และ validate schema ก่อนใช้ข้อมูลทุกครั้ง

> **หมายเหตุ:** ตรวจสอบกับ API จริง (ก.ย. 2026) พบว่า endpoint `/alerts` ยังมีข้อมูลอยู่ (มี event alerts) จึงใช้ alerts เป็นหลัก และแสดง nightwave เสริมในคำสั่ง `/alerts` — ถ้าอนาคต DE ยกเลิก alerts จริง ระบบจะแสดง nightwave challenges เป็นหลักโดยอัตโนมัติ ส่วน endpoint Baro ใช้ `/voidTrader` (ไม่ใช่ `/baro`)

## โครงสร้างโปรเจกต์

```
warframe-bot/
├── src/
│   ├── index.js           # entry point: login discord, ลงทะเบียนคำสั่ง, ตั้ง cron
│   ├── api/warframeApi.js # ฟังก์ชันเรียก API ทั้งหมด + retry + validate schema
│   ├── notifiers/
│   │   ├── baro.js        # ตรวจ + แจ้งเตือน Baro มาถึง
│   │   └── alerts.js      # ตรวจ + แจ้งเตือน Alert รางวัลสำคัญ
│   ├── commands/
│   │   ├── cetus.js       # /cetus
│   │   ├── fissures.js    # /fissures
│   │   ├── baro.js        # /baro
│   │   ├── alerts.js      # /alerts
│   │   ├── sortie.js      # /sortie
│   │   ├── archon.js      # /archon
│   │   ├── arbitration.js # /arbitration
│   │   ├── invasions.js   # /invasions
│   │   ├── news.js        # /news
│   │   └── nightwave.js   # /nightwave
│   └── utils/
│       ├── embed.js       # helper สร้าง Discord embed
│       └── stateStore.js  # เก็บ state (state.json) กันแจ้งเตือนซ้ำ
├── .env.example           # ตัวอย่าง config
├── .gitignore
├── package.json
└── README.md
```

## วิธีติดตั้ง

### ขั้นที่ 1: สร้าง Discord Bot และเอา Token

1. ไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
2. กด **New Application** → ตั้งชื่อ (เช่น `Warframe Bot`) → **Create**
3. ไปที่แท็บ **Bot** ในเมนูซ้าย
4. กด **Reset Token** แล้วคัดลอก token เก็บไว้ (แสดงครั้งเดียวเท่านั้น!)
   - ⚠️ ห้ามแชร์ token ให้ใคร — ถ้ารั่วให้กลับมากด Reset ทันที
5. (แนะนำ) เปิด **Message Content Intent** ไม่จำเป็น — บอทนี้ใช้แค่ Guilds intent ก็พอ

### ขั้นที่ 2: เชิญบอทเข้าเซิร์ฟเวอร์

1. ใน Developer Portal ไปที่แท็บ **OAuth2 → URL Generator**
2. ติ๊ก **Scopes:** `bot`, `applications.commands`
3. ติ๊ก **Bot Permissions:** `Send Messages`, `Embed Links`
4. คัดลอก URL ที่สร้างด้านล่าง เปิดในเบราว์เซอร์ เลือกเซิร์ฟเวอร์ → **Authorize**

> บอทต้องมีสิทธิ์ **Send Messages** และ **Embed Links** ในห้องที่จะใช้แจ้งเตือน

### ขั้นที่ 3: ตั้งค่า `.env`

```bash
# สร้างไฟล์ .env จากตัวอย่าง
cp .env.example .env
```

แล้วแก้ค่าใน `.env`:

```env
DISCORD_TOKEN=ใส่ token จากขั้นที่ 1
NOTIFY_CHANNEL_ID=ใส่ channel id ของห้องแจ้งเตือน
PLATFORM=pc
CHECK_INTERVAL_MINUTES=5
IMPORTANT_REWARDS=Orokin Catalyst,Orokin Reactor,Forma
```

**วิธีหา Channel ID:** เปิด Discord → Settings → Advanced → เปิด **Developer Mode** แล้วคลิกขวาที่ห้อง → **Copy Channel ID**

**ค่า PLATFORM ที่รองรับ:** `pc`, `ps4`, `xb1`, `swi`

### ขั้นที่ 4: รันบอท

```bash
# ติดตั้ง dependencies
npm install

# รันบอท
npm start

# (สำหรับ dev) รันแบบ auto-restart เมื่อแก้โค้ด
npm run dev
```

ถ้าทุกอย่างถูกต้อง จะเห็นข้อความ:

```
✅ บอทล็อกอินแล้วในชื่อ WarframeBot#1234
✅ ลงทะเบียน slash commands แล้ว: /cetus /fissures /baro /alerts /sortie /archon /arbitration /invasions /news /nightwave
⏳ ตั้งเวลาตรวจสอบ API ทุก 5 นาที
```

Slash commands อาจใช้เวลาแพร่กระจาย 1-2 นาทีหลังสตาร์ทครั้งแรกก่อนจะใช้ได้

## คำสั่งทั้งหมดที่ใช้กับบอท

พิมพ์คำสั่งในช่องแชทของ Discord ได้เลย (ขึ้นต้นด้วย `/` แล้ว Discord จะขึ้นรายการคำสั่งให้เลือก)

### `/cetus` — สถานะรอบกลางวัน/กลางคืนของ Cetus

เช็คว่าตอนนี้ Cetus เป็นกลางวันหรือกลางคืน เหลือเวลาอีกกี่นาที (เหมาะสำหรับวางแผนล่า Eidolon)

```
/cetus
```

ผลลัพธ์: สถานะ ☀️ กลางวัน / 🌙 กลางคืน, เวลาที่เหลือก่อนเปลี่ยนสถานะ (นับถอยหลังอัตโนมัติ), และเวลาที่เหลือจาก API

---

### `/fissures` — แสดง Void Fissures ที่เปิดอยู่

แสดงรายการ fissure ทั้งหมดที่ active จัดกลุ่มแยกตาม tier (Lith/Meso/Neo/Axi/Requiem/Omnia) พร้อมโหนด, ประเภทภารกิจ, และเวลาหมดอายุแบบนับถอยหลัง

```
/fissures
```

กรองเฉพาะ tier ที่สนใจ (ไม่ระบุ = แสดงทั้งหมด):

```
/fissures tier:Lith
/fissures tier:Meso
/fissures tier:Neo
/fissures tier:Axi
/fissures tier:Requiem
/fissures tier:Omnia
```

ผลลัพธ์แต่ละรายการ: `• ชื่อโหนด — ประเภทภารกิจ [⚡ สัญลักษณ์พิเศษ] เหลือเวลาอีก X นาที` (⛈️ = Void Storm, 🔺 = Hard/Steel Path)

---

### `/baro` — สถานะ Baro Ki'Teer

เช็คว่าพ่อค้า Baro มาหรือยัง อยู่ Relay ไหน ขายอะไรบ้าง

```
/baro
```

- ถ้า **Baro มาแล้ว**: แสดงตำแหน่ง Relay, เวลาที่จะอยู่ถึง, และรายการสินค้าทั้งหมดพร้อมราคา (`X cr + Y Ducats`)
- ถ้า **Baro ยังไม่มา**: แสดงว่าจะมาถึงเมื่อไหร่ (นับถอยหลัง) และตำแหน่งที่จะมา

---

### `/alerts` — แสดง Alerts และ Nightwave Challenges

แสดง Alert ที่กำลังแอคทีฟอยู่ทั้งหมด พร้อมรางวัลและเวลาหมดอายุ + Nightwave challenges ที่กำลังทำได้ (Daily/Weekly/Elite)

```
/alerts
```

ผลลัพธ์ 2 ส่วน:
- **🔥 Alerts** — รายการ alert พร้อมโหนด, ประเภทภารกิจ, รางวัล, เวลาหมดอายุ
- **🌊 Nightwave** — challenges พร้อมคำอธิบาย, ประเภท (Daily/Weekly), ค่า reputation ที่ได้

> ถ้าไม่มีอะไรแอคทีฟเลย บอทจะแสดงข้อความว่า "ขณะนี้ไม่มี Alert หรือ Nightwave Challenge ที่กำลังแอคทีฟ"

---

### `/sortie` — ภารกิจ Sortie รายวัน

แสดงภารกิจ Sortie ประจำวันทั้ง 3 ขั้น พร้อมโหนด, ประเภทภารกิจ, modifier (พร้อมคำอธิบาย), บอส, ฝั่งศัตรู, รางวัล และเวลาที่จะรีเซ็ตใหม่

```
/sortie
```

---

### `/archon` — ภารกิจ Archon Hunt รายสัปดาห์

แสดง Archon Hunt ประจำสัปดาห์ พร้อมบอส (เช่น Archon Amar), โหนดทั้ง 3 ขั้น, ประเภทภารกิจ, รางวัล และเวลาหมดอายุ (รีเซ็ตทุกวันจันทร์)

```
/archon
```

---

### `/arbitration` — ภารกิจ Arbitration ปัจจุบัน

เช็คว่าตอนนี้ Arbitration อยู่ที่โหนดไหน ประเภทภารกิจอะไร ศัตรูฝั่งไหน เหลือเวลาอีกกี่นาที รวมถึงบอกว่าต้องใช้ Archwing หรือไม่

```
/arbitration
```

> ถ้าขณะนั้นไม่มี Arbitration แอคทีฟ (รอรอบใหม่) บอทจะแสดงข้อความแจ้งแทน

---

### `/invasions` — Invasions และรางวัล

แสดงรายการ Invasion ที่กำลังเกิด (ตัดตัวที่จบไปแล้วออก) พร้อมรางวัลทั้งฝั่งบุก (attacker) และฝั่งรับ (defender), ฝั่ง faction, ความคืบหน้า (%) และบอกเคส Infestation

```
/invasions
```

กรองเฉพาะรางวัลที่ต้องการฟาร์ม — พิมพ์ชื่อของ (ตรงบางส่วน ไม่สนตัวพิมพ์ก็ได้):

```
/invasions reward:Forma
/invasions reward:Fieldron
/invasions reward:Detonite Injector
/invasions reward:Mutalist
```

ผลลัพธ์แต่ละรายการ: โหนด, ความคืบหน้า %, 🟦 ฝั่งที่ถ้าช่วยจะได้รางวัลอะไร, 🟥 ฝั่งที่ถ้าต้านจะได้รางวัลอะไร

---

### `/news` — ข่าวและประกาศล่าสุด

แสดงข่าวและประกาศล่าสุดจากเว็บ Warframe เรียงใหม่สุดอยู่บน พร้อมลิงก์กดเข้าไปอ่านได้ รายการที่มีวันที่จะแสดงวันเผยแพร่ รายการประกาศพิเศษ (priority) จะมีเครื่องหมาย 🔴

```
/news
```

---

### `/nightwave` — Nightwave Challenges

แสดง Nightwave challenges ที่แอคทีฟอยู่ แยกกลุ่มตามประเภท พร้อมคำอธิบาย ค่า reputation และเวลาหมดอายุ

```
/nightwave
```

ผลลัพธ์ 3 กลุ่ม:
- **📅 Daily** — challenge รายวัน
- **🗓️ Weekly** — challenge รายสัปดาห์
- **💎 Elite Weekly** — challenge รายสัปดาห์ระดับ Elite

> ถ้าไม่มี Nightwave season ทำงานอยู่ บอทจะแสดงข้อความแจ้งแทน

---

### การแจ้งเตือนอัตโนมัติ (ไม่ต้องสั่ง)

นอกจากคำสั่งข้างบน บอทจะส่งข้อความแจ้งเตือนเข้าห้อง `NOTIFY_CHANNEL_ID` ให้เองโดยอัตโนมัติ:

| เหตุการณ์ | ข้อความที่ได้รับ |
|---|---|
| **Baro Ki'Teer มาถึง** | embed 🎉 ระบุ Relay, เวลาที่อยู่ถึง, สินค้าทั้งหมดพร้อมราคา credits + ducats (แจ้งครั้งเดียวต่อการมาเยือน) |
| **Alert ที่มีรางวัลสำคัญ** | embed ⚠️ ระบุภารกิจ, ศัตรู, ระดับความยาก, รางวัล, เวลาหมดอายุ — แจ้งเฉพาะรางวัลที่ตรงกับ `IMPORTANT_REWARDS` ใน `.env` (เช่น Orokin Catalyst, Orokin Reactor, Forma) และไม่แจ้งซ้ำ Alert เดิม |

## การทำงานของระบบแจ้งเตือน

- บอทตรวจ API ทุก `CHECK_INTERVAL_MINUTES` นาที
- **Baro:** แจ้งเมื่อสถานะเปลี่ยนจาก inactive → active (แจนครั้งเดียวต่อการมาเยือนแต่ละครั้ง)
- **Alerts:** แจ้งเฉพาะ alert ที่รางวัลตรงกับ `IMPORTANT_REWARDS` และแจนครั้งเดียวต่อ alert id
- state ถูกเก็บในไฟล์ `state.json` — ถ้าลบไฟล์นี้บอทจะแจ้งเตือนซ้ำรายการเดิมอีกครั้ง

## การแก้ปัญหา

| ปัญหา | วิธีแก้ |
|---|---|
| `ไม่พบค่า DISCORD_TOKEN` | สร้างไฟล์ `.env` แล้วใส่ token (ดูขั้นที่ 3) |
| ล็อกอินไม่สำเร็จ | ตรวจว่า token ถูกต้อง/ไม่ถูก reset ไปแล้ว |
| ไม่มีข้อความแจ้งเตือน | ตรวจ `NOTIFY_CHANNEL_ID` และสิทธิ์บอทในห้องนั้น (Send Messages, Embed Links) |
| คำสั่งไม่ขึ้น | รอ 1-2 นาที หรือรีสตาร์ท Discord client (`Ctrl+R`) |
| API error ใน log | ปกติ — บอทจะ retry เอง และข้ามรอบนั้นโดยไม่ crash |

## Tech Stack

- Node.js 18+ (ES modules, async/await ทั้งโปรเจกต์)
- [discord.js](https://discord.js.org/) v14
- [axios](https://axios-http.com/) สำหรับเรียก API
- [node-cron](https://www.npmjs.com/package/node-cron) สำหรับ polling
- [dotenv](https://www.npmjs.com/package/dotenv) สำหรับ config