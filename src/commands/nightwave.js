import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getNightwave } from '../api/warframeApi.js';
import { nightwaveEmbed } from '../utils/embed.js';

/**
 * /nightwave — แสดง Nightwave challenges แยกตามประเภท (Daily / Weekly / Elite Weekly)
 */

export const data = new SlashCommandBuilder()
  .setName('nightwave')
  .setDescription('แสดง Nightwave challenges รายวันและรายสัปดาห์ที่แอคทีฟอยู่');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const nightwave = await getNightwave();
    const embed = nightwaveEmbed(nightwave);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:nightwave] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Nightwave ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}