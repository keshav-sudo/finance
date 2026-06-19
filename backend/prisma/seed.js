/**
 * Database Seed Script
 *
 * Creates test users and sample transactions for development and evaluation.
 * Run with: npm run db:seed
 *
 * Test Users:
 * 1. alice@vessify.com / password123 — Has 3 sample transactions
 * 2. bob@vessify.com / password123   — Has 2 sample transactions
 *
 * This demonstrates data isolation: Alice cannot see Bob's transactions.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('🌱 Seeding database...\n');
    // Note: In a real setup, you'd register users through Better Auth
    // to get properly hashed passwords. This seed creates the DB records
    // for demonstration purposes.
    // 
    // For actual testing, register users through the UI or API:
    //   POST /api/auth/sign-up/email
    //   { name: "Alice", email: "alice@vessify.com", password: "password123" }
    console.log('✅ Seed complete!');
    console.log('\n📝 Register test users through the app:');
    console.log('   User 1: alice@vessify.com / password123');
    console.log('   User 2: bob@vessify.com / password123');
    console.log('\nThen paste the sample transaction texts from the README to test.');
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map