import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getCetusCycle } from '../api/warframeApi.js';
import { cetusEmbed } from '../utils/embed.js';

/**
 * /cetus — แสดงสถานะรอบกลางวัน/กลางคืนของ Cetus แบบ on-demand
 */

export const data = new SlashCommandBuilder()
  .setName('cetus')
  .setDescription('เช็คว่า Cetus ตอนนี้กลางวันหรือกลางคืน เหลือเวลาอีกกี่นาที');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply(); // อาจใช้เวลาสองสามวินาที (เรียก API + อาจ retry)

  try {
    const cycle = await getCetusCycle();
    await interaction.editReply({ embeds: [cetusEmbed(cycle)] });
  } catch (err) {
    console.error('[command:cetus] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Cetus cycle ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}