import { EmbedBuilder } from 'discord.js';

/**
 * ชื่อสีของแต่ละ tier ของ Void Fissure (ใช้เป็นทั้งสีและ emoji ประจำ tier)
 */
const TIER_COLORS = {
  Lith: 0x4caf50, // เขียว
  Meso: 0x2196f3, // น้ำเงิน
  Neo: 0xff9800, // ส้ม
  Axi: 0xe91e63, // ชมพูแดง
  Requiem: 0x9c27b0, // ม่วง
  Omnia: 0x00bcd4, // ฟ้า (tier ใหม่ — relic หลาย tier ใน fissure เดียว)
};

const TIER_EMOJIS = {
  Lith: '🟢',
  Meso: '🔵',
  Neo: '🟠',
  Axi: '🔴',
  Requiem: '🟣',
  Omnia: '🔷',
};

/**
 * สร้าง EmbedBuilder พื้นฐานพร้อมสีและ footer กำกับแหล่งข้อมูล
 * @param {number} color - สีของ embed (hex int)
 * @param {string} title - หัวข้อ
 * @returns {EmbedBuilder}
 */
export function baseEmbed(color, title) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: 'ข้อมูลจาก api.warframestat.us' })
    .setTimestamp();
}

/**
 * จัดรูปแบบราคาสินค้าของ Baro (credits + ducats)
 * @param {number} credits
 * @param {number} ducats
 * @returns {string} เช่น "250,000 cr + 350 Ducats"
 */
export function formatBaroPrice(credits, ducats) {
  const creditStr = Number(credits || 0).toLocaleString('en-US');
  return `${creditStr} cr + ${Number(ducats || 0).toLocaleString('en-US')} Ducats`;
}

/**
 * สร้าง embed แจ้งเตือน Baro Ki'Teer มาถึง
 * รวมรายการสินค้าทั้งหมด จัดเรียงตามชื่อ แสดงราคา credits + ducats
 * @param {object} baro - ข้อมูล voidTrader จาก API
 * @returns {EmbedBuilder}
 */
export function baroArrivalEmbed(baro) {
  const embed = baseEmbed(0x9c27b0, `🎉 ${baro.character || "Baro Ki'Teer"} มาถึงแล้ว!`)
    .addFields(
      { name: '📍 ตำแหน่ง', value: baro.location || 'ไม่ทราบตำแหน่ง', inline: true },
      { name: '⏳ อยู่ถึง', value: `<t:${toUnixSeconds(baro.expiry)}:R>`, inline: true },
    );

  // แสดงรายการสินค้า - ถ้าไม่มี inventory ให้แสดงข้อความสำรอง
  const inventory = Array.isArray(baro.inventory) ? baro.inventory : [];
  if (inventory.length > 0) {
    // เรียงตามชื่อสินค้าก่อนเพื่อให้อ่านง่าย
    const sorted = [...inventory].sort((a, b) =>
      String(a.item || '').localeCompare(String(b.item || '')),
    );

    // Discord embed field จำกัด 25 fields และ 1024 ตัวอักษรต่อ field
    // ดังนั้นแบ่งสินค้าเป็นกลุ่มละไม่เกิน 10 ชิ้นต่อ field เพื่อกันข้อความล้น
    const chunkSize = 10;
    for (let i = 0; i < sorted.length; i += chunkSize) {
      const chunk = sorted.slice(i, i + chunkSize);
      const lines = chunk.map(
        (item) =>
          `• **${item.item}** — ${formatBaroPrice(item.credits, item.ducats)}`,
      );
      const label =
        i === 0 ? `🛒 สินค้า (${inventory.length} รายการ)` : '\u200b'; // zero-width space เป็นชื่อ field ต่อเนื่อง
      embed.addFields({ name: label, value: lines.join('\n').slice(0, 1024) });
    }
  } else {
    embed.addFields({
      name: '🛒 สินค้า',
      value: 'ยังไม่มีข้อมูลสินค้าในระบบ ลองใช้คำสั่ง `/baro` อีกครั้งภายหลัง',
    });
  }

  return embed;
}

/**
 * สร้าง embed แจ้งเตือน Alert ที่มีรางวัลสำคัญ
 * @param {object} alert - ข้อมูล alert จาก API
 * @returns {EmbedBuilder}
 */
export function alertEmbed(alert) {
  const m = alert.mission || {};
  // ประกอบชื่อรางวัลจากทั้ง items และ countedItems (countedItems มีจำนวน เช่น x2)
  const rewardItems = [
    ...(m.reward?.items || []),
    ...(m.reward?.countedItems || []).map(
      (ci) => `${ci.count > 1 ? `${ci.count}x ` : ''}${ci.type || ci.key}`,
    ),
  ];
  const rewardText =
    rewardItems.length > 0
      ? rewardItems.join('\n')
      : `${Number(m.reward?.credits || 0).toLocaleString('en-US')} Credits`;

  return baseEmbed(0xff9800, '⚠️ Alert รางวัลพิเศษ!')
    .addFields(
      { name: '🗺️ ภารกิจ', value: `${m.node || 'ไม่ทราบ'} — ${m.type || 'Unknown'}`, inline: true },
      { name: '👹 ศัตรู', value: m.faction || 'Unknown', inline: true },
      {
        name: '⚔️ ระดับ',
        value: `${m.minEnemyLevel ?? '?'} - ${m.maxEnemyLevel ?? '?'}`,
        inline: true,
      },
      { name: '🎁 รางวัล', value: rewardText.slice(0, 1024) },
      { name: '⏰ หมดอายุ', value: `<t:${toUnixSeconds(alert.expiry)}:R>`, inline: true },
    );
}

/**
 * สร้าง embed สำหรับคำสั่ง /cetus - แสดงสถานะกลางวัน/กลางคืนของ Cetus
 * @param {object} cycle - ข้อมูล cetusCycle จาก API
 * @returns {EmbedBuilder}
 */
export function cetusEmbed(cycle) {
  const isDay = Boolean(cycle.isDay);
  return baseEmbed(
    isDay ? 0xffee58 : 0x1a237e,
    isDay ? '☀️ ตอนนี้ Cetus เป็นกลางวัน' : '🌙 ตอนนี้ Cetus เป็นกลางคืน (Eidolon Hunting!)',
  ).addFields(
    {
      name: 'สถานะ',
      value: isDay ? 'กลางวัน ☀️' : 'กลางคืน 🌙',
      inline: true,
    },
    {
      name: 'เปลี่ยนสถานะเมื่อ',
      value: `<t:${toUnixSeconds(cycle.expiry)}:R>`,
      inline: true,
    },
    {
      name: 'เวลาที่เหลือ (จาก API)',
      value: cycle.timeLeft || 'ไม่ทราบ',
      inline: true,
    },
  );
}

/**
 * สร้าง embed สำหรับคำสั่ง /fissures - แสดงรายการ fissure แยกตาม tier
 * @param {Array} fissures - รายการ fissure จาก API
 * @returns {EmbedBuilder}
 */
export function fissuresEmbed(fissures) {
  const embed = baseEmbed(0x673ab7, '🌀 Void Fissures ที่กำลังเปิดอยู่');

  if (!fissures || fissures.length === 0) {
    embed.setDescription('ขณะนี้ไม่มี fissure เปิดอยู่');
    return embed;
  }

  // จัดกลุ่มตาม tier แล้วเรียงตามหมายเลข tier (Lith=1 ... Requiem=5)
  const byTier = new Map();
  for (const f of fissures) {
    const tier = f.tier || 'Unknown';
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier).push(f);
  }

  const orderedTiers = [...byTier.keys()].sort(
    (a, b) =>
      (fissures.find((f) => f.tier === a)?.tierNum ?? 99) -
      (fissures.find((f) => f.tier === b)?.tierNum ?? 99),
  );

  // แสดงเฉพาะ 25 fields แรก (Discord จำกัด embed 25 fields)
  let fieldCount = 0;
  for (const tier of orderedTiers) {
    if (fieldCount >= 25) break;
    const list = byTier.get(tier);
    const emoji = TIER_EMOJIS[tier] || '⚪';
    const lines = list
      .slice(0, 15) // กันข้อความยาวเกิน 1024 ตัวอักษรต่อ field
      .map(
        (f) =>
          `• ${f.node} — ${f.missionType}` +
          (f.isStorm ? ' ⛈️' : '') +
          (f.isHard ? ' 🔺' : '') +
          ` <t:${toUnixSeconds(f.expiry)}:R>`,
      );
    embed.addFields({
      name: `${emoji} ${tier} (${list.length})`,
      value: lines.join('\n').slice(0, 1024),
    });
    fieldCount++;
  }

  return embed;
}

/**
 * สร้าง embed สำหรับคำสั่ง /baro - แสดงสถานะ Baro ปัจจุบัน
 * ถ้า Baro ยังไม่มา จะแสดงว่าจะมาเมื่อไหร่ ถ้ามาแล้วแสดงสินค้าทั้งหมด
 * @param {object} baro - ข้อมูล voidTrader จาก API
 * @param {boolean} isActive - สถานะ active ที่คำนวณแล้ว
 * @returns {EmbedBuilder}
 */
export function baroStatusEmbed(baro, isActive) {
  if (isActive) {
    // ถ้า Baro มาแล้ว ใช้ embed เดียวกับตอนแจ้งเตือน แต่เปลี่ยนสี/หัวข้อให้เหมาะกับการ query
    const embed = baroArrivalEmbed(baro);
    embed.setTitle(`${baro.character || "Baro Ki'Teer"} อยู่ใน Relay ตอนนี้!`);
    return embed;
  }

  return baseEmbed(0x9e9e9e, `🕐 ${baro.character || "Baro Ki'Teer"} ยังไม่มาถึง`)
    .addFields(
      {
        name: '📍 ตำแหน่งที่จะมา',
        value: baro.location || 'ยังไม่ประกาศ',
        inline: true,
      },
      {
        name: '⏳ จะมาถึง',
        value: `<t:${toUnixSeconds(baro.activation)}:R>`,
        inline: true,
      },
    );
}

/**
 * สร้าง embed สำหรับคำสั่ง /alerts - แสดง alerts และ nightwave challenges
 * @param {Array} alerts - รายการ alert ที่ active
 * @param {object|null} nightwave - ข้อมูล nightwave (ถ้ามี)
 * @returns {EmbedBuilder}
 */
export function alertsEmbed(alerts, nightwave) {
  const embed = baseEmbed(0x00e676, '📢 Alerts & Nightwave Challenges');

  // --- ส่วน Alerts ---
  if (alerts && alerts.length > 0) {
    const lines = alerts.slice(0, 10).map((a) => {
      const m = a.mission || {};
      const rewardItems = [
        ...(m.reward?.items || []),
        ...(m.reward?.countedItems || []).map((ci) => `${ci.count > 1 ? `${ci.count}x ` : ''}${ci.type || ci.key}`),
      ];
      const rewardStr =
        rewardItems.length > 0
          ? rewardItems.join(', ')
          : `${Number(m.reward?.credits || 0).toLocaleString('en-US')} Credits`;
      return `• **${m.node}** (${m.type}) — ${rewardStr} — หมดอายุ <t:${toUnixSeconds(a.expiry)}:R>`;
    });
    embed.addFields({ name: `🔥 Alerts (${alerts.length})`, value: lines.join('\n').slice(0, 1024) });
  }

  // --- ส่วน Nightwave ---
  if (nightwave && Array.isArray(nightwave.activeChallenges) && nightwave.activeChallenges.length > 0) {
    const lines = nightwave.activeChallenges.slice(0, 10).map((c) => {
      const kind = c.isDaily ? 'Daily' : c.isElite ? 'Elite Weekly' : 'Weekly';
      return `• **${c.title}** [${kind}] — ${c.desc} (${Number(c.reputation).toLocaleString('en-US')} rep) หมดอายุ <t:${toUnixSeconds(c.expiry)}:R>`;
    });
    embed.addFields({ name: '🌊 Nightwave', value: lines.join('\n').slice(0, 1024) });
  }

  if (embed.data.fields?.length === 0) {
    embed.setDescription('ขณะนี้ไม่มี Alert หรือ Nightwave Challenge ที่กำลังแอคทีฟ');
  }

  return embed;
}

/**
 * แปลง ISO date string เป็น Unix timestamp วินาที (สำหรับ Discord timestamp)
 * ถ้าแปลงไม่ได้จะคืนค่า timestamp ปัจจุบัน เพื่อกัน Discord แสดง "Invalid Date"
 * @param {string} iso - ISO date string เช่น "2026-09-18T13:00:00.000Z"
 * @returns {number} Unix timestamp (วินาที)
 */
export function toUnixSeconds(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Math.floor(Date.now() / 1000) : Math.floor(t / 1000);
}

/**
 * รวมรายการรางวัลจาก object reward ของ API เป็นข้อความเดียว
 * ใช้ร่วมกันทั้ง alerts และ invasions
 * @param {object} reward - { items[], countedItems[{count,type,key}], credits }
 * @returns {string} ข้อความรางวัล เช่น "3x Fieldron" หรือ "5,000 Credits" ถ้าไม่มีไอเทม
 */
function rewardToText(reward) {
  const items = [
    ...(reward?.items || []),
    ...(reward?.countedItems || []).map(
      (ci) => `${ci.count > 1 ? `${ci.count}x ` : ''}${ci.type || ci.key}`,
    ),
  ];
  return items.length > 0
    ? items.join(', ')
    : `${Number(reward?.credits || 0).toLocaleString('en-US')} Credits`;
}

/**
 * สร้าง embed สำหรับคำสั่ง /sortie - ภารกิจ Sortie รายวัน 3 ขั้น
 * @param {object} sortie - ข้อมูล sortie จาก API
 * @returns {EmbedBuilder}
 */
export function sortieEmbed(sortie) {
  const embed = baseEmbed(
    0xf44336,
    `🗡️ Sortie วันนี้ — ${sortie.boss || 'ไม่ทราบบอส'} (${sortie.faction || '?'})`,
  );

  const lines = (sortie.variants || []).map(
    (v, i) =>
      `**${i + 1}. ${v.node}** — ${v.missionType}\n` +
      `   ⚡ ${v.modifier || 'ไม่มี modifier'}\n` +
      `   ↳ ${v.modifierDescription || ''}`,
  );
  embed.addFields({
    name: '📜 ภารกิจทั้ง 3 ขั้น',
    value: (lines.join('\n') || 'ไม่มีข้อมูล').slice(0, 1024),
  });
  embed.addFields({
    name: '🎁 รางวัล',
    value: sortie.rewardPool || 'ไม่ทราบ',
    inline: true,
  });
  embed.addFields({
    name: '⏰ รีเซ็ตใหม่',
    value: `<t:${toUnixSeconds(sortie.expiry)}:R>`,
    inline: true,
  });
  return embed;
}

/**
 * สร้าง embed สำหรับคำสั่ง /archon - ภารกิจ Archon Hunt รายสัปดาห์
 * @param {object} archon - ข้อมูล archonHunt จาก API
 * @returns {EmbedBuilder}
 */
export function archonEmbed(archon) {
  const embed = baseEmbed(
    0xe91e63,
    `👑 Archon Hunt สัปดาห์นี้ — ${archon.boss || 'ไม่ทราบบอส'} (${archon.faction || '?'})`,
  );

  const lines = (archon.missions || []).map(
    (m, i) => `**${i + 1}. ${m.node}** — ${m.type || 'Unknown'}`,
  );
  embed.addFields({
    name: '📜 ภารกิจทั้ง 3 ขั้น',
    value: (lines.join('\n') || 'ไม่มีข้อมูล').slice(0, 1024),
  });
  embed.addFields({
    name: '🎁 รางวัล',
    value: archon.rewardPool || 'ไม่ทราบ',
    inline: true,
  });
  embed.addFields({
    name: '⏰ หมดอายุ',
    value: `<t:${toUnixSeconds(archon.expiry)}:R>`,
    inline: true,
  });
  return embed;
}

/**
 * สร้าง embed สำหรับคำสั่ง /arbitration - ภารกิจ Arbitration ปัจจุบัน
 * @param {object|null} arbitration - ข้อมูล arbitration จาก API (null = ไม่มีแอคทีฟ)
 * @returns {EmbedBuilder}
 */
export function arbitrationEmbed(arbitration) {
  if (!arbitration) {
    return baseEmbed(0x9e9e9e, '⚖️ ขณะนี้ยังไม่มี Arbitration')
      .setDescription('รอข้อมูลรอบใหม่จากเซิร์ฟเวอร์ แล้วลองใหม่ภายหลัง');
  }
  return baseEmbed(0xffc107, '⚖️ Arbitration ปัจจุบัน').addFields(
    { name: '🗺️ โหนด', value: arbitration.node || 'ไม่ทราบ', inline: true },
    { name: '🎯 ประเภท', value: arbitration.type || 'Unknown', inline: true },
    { name: '👹 ศัตรู', value: arbitration.enemy || 'Unknown', inline: true },
    {
      name: '⏰ หมดอายุ',
      value: `<t:${toUnixSeconds(arbitration.expiry)}:R>`,
      inline: true,
    },
    { name: '🪽 ต้องใช้ Archwing', value: arbitration.archwing ? 'ใช่' : 'ไม่', inline: true },
  );
}

/**
 * สร้าง embed สำหรับคำสั่ง /invasions - รายการ invasion ที่กำลังเกิด
 * @param {Array} invasions - รายการ invasion (ที่ยังไม่จบ) จาก API
 * @param {string|null} rewardFilter - ข้อความกรองรางวัล (substring, ไม่สนตัวพิมพ์)
 * @returns {EmbedBuilder}
 */
export function invasionsEmbed(invasions, rewardFilter) {
  let list = invasions || [];
  if (rewardFilter) {
    const needle = rewardFilter.toLowerCase();
    list = list.filter((inv) => {
      const texts = [inv.attacker?.reward, inv.defender?.reward].map(rewardToText);
      return texts.some((t) => t.toLowerCase().includes(needle));
    });
  }

  const title = rewardFilter
    ? `⚔️ Invasions ที่มีรางวัล "${rewardFilter}"`
    : '⚔️ Invasions ที่กำลังเกิด';
  const embed = baseEmbed(0x795548, title);

  if (list.length === 0) {
    embed.setDescription(
      rewardFilter
        ? `ไม่พบ invasion ที่มีรางวัลตรงกับ "${rewardFilter}"`
        : 'ขณะนี้ไม่มี Invasion ที่กำลังเกิด',
    );
    return embed;
  }

  const lines = list.slice(0, 10).map((inv) => {
    const pct = Math.floor(inv.completion ?? 0);
    const attacker = `${inv.attacker?.faction || '?'} → ${rewardToText(inv.attacker?.reward)}`;
    const defender = `${inv.defender?.faction || '?'} → ${rewardToText(inv.defender?.reward)}`;
    return (
      `• **${inv.node}** (${pct}%)\n` +
      `   🟦 ช่วย ${attacker}\n` +
      `   🟥 ต้าน ${defender}` +
      (inv.vsInfestation ? '\n   🦠 Infestation' : '')
    );
  });
  embed.addFields({
    name: `รายการ (${list.length})`,
    value: lines.join('\n').slice(0, 1024),
  });
  return embed;
}

/**
 * สร้าง embed สำหรับคำสั่ง /news - ข่าวและประกาศล่าสุด
 * รายการที่ไม่มีวันที่ (epoch 1970) จะแสดงเป็น "ประกาศถาวร" ไม่แสดง timestamp
 * @param {Array} news - รายการข่าวจาก API
 * @returns {EmbedBuilder}
 */
export function newsEmbed(news) {
  const embed = baseEmbed(0x03a9f4, '📰 ข่าวและประกาศล่าสุด');

  const list = news || [];
  if (list.length === 0) {
    embed.setDescription('ไม่มีข่าวในระบบ');
    return embed;
  }

  // เรียงข่าวที่มีวันที่จริงใหม่สุดอยู่บน แล้วตามด้วยพวกไม่มีวันที่
  const EPOCH_1970 = Date.parse('1970-01-01T00:00:00.000Z');
  const sorted = [...list].sort((a, b) => {
    const da = Date.parse(a.date) || 0;
    const db = Date.parse(b.date) || 0;
    return db - da;
  });

  const lines = sorted.slice(0, 15).map((n) => {
    const t = Date.parse(n.date);
    const hasDate = Number.isFinite(t) && t > EPOCH_1970;
    const dateStr = hasDate ? ` <t:${Math.floor(t / 1000)}:d>` : '';
    const flag = n.priority ? ' 🔴' : '';
    return `• [${n.message.trim()}](${n.link || ''})${dateStr}${flag}`;
  });
  embed.setDescription(lines.join('\n').slice(0, 4096));
  return embed;
}

/**
 * สร้าง embed สำหรับคำสั่ง /nightwave - Nightwave challenges แยกตามประเภท
 * @param {object|null} nightwave - ข้อมูล nightwave จาก API (null = ไม่มี season)
 * @returns {EmbedBuilder}
 */
export function nightwaveEmbed(nightwave) {
  if (!nightwave || !Array.isArray(nightwave.activeChallenges)) {
    return baseEmbed(0x9e9e9e, '🌊 Nightwave')
      .setDescription('ขณะนี้ไม่มี Nightwave season ที่กำลังทำงาน');
  }

  const embed = baseEmbed(
    0x3f51b5,
    `🌊 Nightwave — ${nightwave.season ? `Season ${nightwave.season}` : 'ปัจจุบัน'}`,
  );

  const groups = [
    { key: 'daily', label: '📅 Daily', test: (c) => c.isDaily },
    { key: 'weekly', label: '🗓️ Weekly', test: (c) => !c.isDaily && !c.isElite },
    { key: 'elite', label: '💎 Elite Weekly', test: (c) => !c.isDaily && c.isElite },
  ];

  for (const g of groups) {
    const list = nightwave.activeChallenges.filter(g.test);
    if (list.length === 0) continue;
    const lines = list.map(
      (c) =>
        `• **${c.title}** — ${c.desc} (${Number(c.reputation).toLocaleString('en-US')} rep) หมดอายุ <t:${toUnixSeconds(c.expiry)}:R>`,
    );
    embed.addFields({ name: g.label, value: lines.join('\n').slice(0, 1024) });
  }

  if ((embed.data.fields?.length ?? 0) === 0) {
    embed.setDescription('ไม่มี challenge ที่แอคทีฟอยู่');
  }
  return embed;
}