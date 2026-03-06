const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Delete all OFFLINE devices
  const deleted = await p.device.deleteMany({ where: { status: 'OFFLINE' } });
  console.log('Deleted OFFLINE devices:', deleted.count);
  
  // Show remaining devices
  const devices = await p.device.findMany();
  console.log('Remaining devices:');
  devices.forEach(d => console.log(`  ${d.id} | ${d.uuid} | ${d.name} | ${d.status}`));
}

main().catch(console.error).finally(() => p.$disconnect());
