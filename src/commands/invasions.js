import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getInvasions } from '../api/warframeApi.js';
import { invasionsEmbed } from '../utils/embed.js';

/**
 * /invasions — แสดงรายการ Invasion ที่กำลังเกิด พร้อมรางวัล 2 ฝั่ง
 * มี option กรองตามชื่อรางวัลที่ต้องการฟาร์มได้ (ไม่ระบุ = แสดงทั้งหมด)
 */

export const data = new SlashCommandBuilder()
  .setName('invasions')
  .setDescription('แสดงรายการ Invasion ที่กำลังเกิด พร้อมรางวัลทั้งสองฝั่ง')
  .addStringOption((opt) =>
    opt
      .setName('reward')
      .setDescription('กรองเฉพาะ invasion ที่มีรางวัลตรงกับข้อความนี้ เช่น Forma, Fieldron')
      .setRequired(false),
  );

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const reward = interaction.options.getString('reward');
    const invasions = await getInvasions();
    const embed = invasionsEmbed(invasions, reward);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:invasions] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Invasions ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}