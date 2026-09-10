import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getArchonHunt } from '../api/warframeApi.js';
import { archonEmbed } from '../utils/embed.js';

/**
 * /archon — แสดงภารกิจ Archon Hunt รายสัปดาห์ (3 ขั้น พร้อมบอสและรางวัล)
 */

export const data = new SlashCommandBuilder()
  .setName('archon')
  .setDescription('แสดงภารกิจ Archon Hunt รายสัปดาห์ พร้อมรางวัล');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const archon = await getArchonHunt();
    const embed = archonEmbed(archon);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:archon] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Archon Hunt ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}