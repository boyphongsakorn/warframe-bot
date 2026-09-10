import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getSortie } from '../api/warframeApi.js';
import { sortieEmbed } from '../utils/embed.js';

/**
 * /sortie — แสดงภารกิจ Sortie รายวัน (3 ขั้น พร้อม modifier และรางวัล)
 */

export const data = new SlashCommandBuilder()
  .setName('sortie')
  .setDescription('แสดงภารกิจ Sortie รายวัน พร้อม modifier และรางวัล');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const sortie = await getSortie();
    const embed = sortieEmbed(sortie);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:sortie] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Sortie ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}