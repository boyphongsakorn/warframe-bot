import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getNews } from '../api/warframeApi.js';
import { newsEmbed } from '../utils/embed.js';

/**
 * /news — แสดงข่าวและประกาศล่าสุดจากเซิร์ฟเวอร์ Warframe
 */

export const data = new SlashCommandBuilder()
  .setName('news')
  .setDescription('แสดงข่าวและประกาศล่าสุดของ Warframe');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const news = await getNews();
    const embed = newsEmbed(news);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:news] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูลข่าวไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}