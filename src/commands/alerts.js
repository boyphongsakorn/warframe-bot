import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getAlerts, getNightwave } from '../api/warframeApi.js';
import { alertsEmbed } from '../utils/embed.js';

/**
 * /alerts — แสดง Alerts ที่กำลังแอคทีฟ และ Nightwave challenges
 *
 * หมายเหตุ: ถ้าระบบ Alerts ถูก DE ยกเลิกในอนาคต (API คืน array ว่างตลอด)
 * คำสั่งนี้จะแสดง Nightwave challenges เป็นหลักแทนโดยอัตโนมัติ
 */

export const data = new SlashCommandBuilder()
  .setName('alerts')
  .setDescription('แสดง Alerts และ Nightwave challenges ที่กำลังแอคทีฟอยู่');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    // ดึงทั้งสองแบบขนานกัน ถ้าอันไหนล้มเหลวให้ถือเป็น null (แสดงเฉพาะอีกอัน)
    const [alertsRes, nightwaveRes] = await Promise.allSettled([
      getAlerts(),
      getNightwave(),
    ]);

    const alerts = alertsRes.status === 'fulfilled' ? alertsRes.value : null;
    const nightwave = nightwaveRes.status === 'fulfilled' ? nightwaveRes.value : null;

    // ถ้าทั้งคู่ล้มเหลว ถือว่าคำสั่งนี้ทำงานไม่ได้
    if (alerts === null && nightwave === null) {
      throw new Error('ดึงข้อมูล alerts และ nightwave ไม่สำเร็จทั้งคู่');
    }

    const embed = alertsEmbed(alerts || [], nightwave);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:alerts] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Alerts/Nightwave ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}