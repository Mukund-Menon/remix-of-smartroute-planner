import { db } from '@/db';
import { userProfiles, user } from '@/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
    const existingUsers = await db.select({ id: user.id }).from(user).limit(5);
    
    if (existingUsers.length === 0) {
        console.log('⚠️  No users found in database. Please seed users first.');
        return;
    }

    const transportModes = ['flight', 'car', 'train'];
    const budgetRanges = ['low', 'medium', 'high'];
    const seatPreferences = ['window', 'aisle', 'middle'];
    const emergencyContacts = ['John Smith', 'Sarah Johnson', 'Mike Williams', 'Emily Davis', 'Robert Brown'];

    const sampleProfiles = existingUsers.map((existingUser, index) => ({
        userId: existingUser.id,
        phone: `+1-555-01${String(index + 1).padStart(2, '0')}`,
        emergencyContactName: emergencyContacts[index],
        emergencyContactPhone: `+1-555-10${String(index + 1).padStart(2, '0')}`,
        travelPreferences: JSON.stringify({
            preferredTransport: transportModes[index % transportModes.length],
            budgetRange: budgetRanges[index % budgetRanges.length],
            seatPreference: seatPreferences[index % seatPreferences.length],
            dietaryRestrictions: index === 0 ? ['vegetarian'] : index === 2 ? ['gluten-free'] : []
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }));

    await db.insert(userProfiles).values(sampleProfiles);
    
    console.log(`✅ User profiles seeder completed successfully (${sampleProfiles.length} profiles created)`);
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});