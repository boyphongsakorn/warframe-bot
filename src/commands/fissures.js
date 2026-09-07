import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getFissures } from '../api/warframeApi.js';
import { fissuresEmbed } from '../utils/embed.js';

/**
 * /fissures — แสดงรายการ Void Fissures ที่ active แยกตาม tier
 * มี option กรองตาม tier ได้ (ไม่ระบุ = แสดงทั้งหมด)
 */

export const data = new SlashCommandBuilder()
  .setName('fissures')
  .setDescription('แสดง Void Fissures ที่กำลังเปิดอยู่ แยกตาม tier')
  .addStringOption((opt) =>
    opt
      .setName('tier')
      .setDescription('กรองเฉพาะ tier ที่สนใจ (ไม่ระบุ = ทั้งหมด)')
      .setRequired(false)
      .addChoices(
        { name: 'Lith', value: 'Lith' },
        { name: 'Meso', value: 'Meso' },
        { name: 'Neo', value: 'Neo' },
        { name: 'Axi', value: 'Axi' },
        { name: 'Requiem', value: 'Requiem' },
        { name: 'Omnia', value: 'Omnia' },
      ),
  );

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const tier = interaction.options.getString('tier');
    let fissures = await getFissures();

    // ถ้าผู้ใช้ระบุ tier ให้กรองเฉพาะ tier นั้น
    if (tier) {
      fissures = fissures.filter((f) => f.tier === tier);
    }

    const embed = fissuresEmbed(fissures);
    if (tier) {
      embed.setTitle(`🌀 Void Fissures — ${tier}`);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[command:fissures] ไม่สำเร็จ:', err.message);
    await interaction.editReply({
      content: '❌ ดึงข้อมูล Void Fissures ไม่สำเร็จ ลองอีกครั้งภายหลัง',
      flags: MessageFlags.Ephemeral,
    });
  }
}