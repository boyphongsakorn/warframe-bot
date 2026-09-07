import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getVoidTrader, isBaroActive } from '../api/warframeApi.js';
import { baroStatusEmbed } from '../utils/embed.js';

/**
 * /baro — แสดงสถานะ Baro Ki'Teer ปัจจุบัน
 * ถ้ามาแล้ว: แสดงตำแหน่ง + สินค้าทั้งหมดพร้อมราคา
 * ถ้ายังไม่มา: แสดงว่าจะมาเมื่อไหร่ ที่ไหน
 */

export const data = new SlashCommandBuilder()
  .setName('baro')
  .setDescription('เช็คสถานะ Baro Ki\'Teer (มาหรือยัง อยู่ที่ไหน ขายอะไรบ้าง)');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const baro = await getVoidTrader();
    const active = isBaroActive(baro);
    await interaction.editReply({ embeds: [baroStatusEmbed(baro, active)] });
  } catch (err) {
    console.error('[command:baro] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: "❌ ดึงข้อมูล Baro Ki'Teer ไม่สำเร็จ ลองอีกครั้งภายหลัง",
      flags: MessageFlags.Ephemeral,
    });
  }
}