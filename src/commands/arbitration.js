import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getArbitration } from '../api/warframeApi.js';
import { arbitrationEmbed } from '../utils/embed.js';

/**
 * /arbitration — แสดงภารกิจ Arbitration ปัจจุบัน (โหนด, ประเภท, เวลาหมดอายุ)
 */

export const data = new SlashCommandBuilder()
  .setName('arbitration')
  .setDescription('แสดงภารกิจ Arbitration ปัจจุบัน ว่าอยู่โหนดไหน ประเภทอะไร');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const arbitration = await getArbitration();
    const embed = arbitrationEmbed(arbitration);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:arbitration] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Arbitration ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}