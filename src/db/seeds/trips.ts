import { db } from '@/db';
import { trips, user } from '@/db/schema';

async function main() {
    // First, get existing user IDs from the database
    const existingUsers = await db.select({ id: user.id }).from(user).limit(8);
    
    if (existingUsers.length === 0) {
        console.error('❌ No users found in database. Please seed users first.');
        return;
    }

    const userIds = existingUsers.map(u => u.id);
    
    const sampleTrips = [
        {
            userId: userIds[0] || 'user_01h4kxt2e8z9y3b1n7m6q5w8r4',
            source: 'Los Angeles',
            destination: 'Paris, France',
            travelDate: '2024-12-20',
            travelTime: '08:00',
            transportMode: 'flight',
            optimizationMode: 'fastest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            userId: userIds[1] || 'user_01h4kxt2e8z9y3b1n7m6q5w8r5',
            source: 'San Francisco',
            destination: 'Paris, France',
            travelDate: '2024-12-22',
            travelTime: '14:30',
            transportMode: 'flight',
            optimizationMode: 'cheapest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            userId: userIds[2] || 'user_01h4kxt2e8z9y3b1n7m6q5w8r6',
            source: 'Chicago',
            destination: 'Paris, France',
            travelDate: '2024-12-25',
            travelTime: '10:00',
            transportMode: 'flight',
            optimizationMode: 'shortest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            userId: userIds[3] || 'user_01h4kxt2e8z9y3b1n7m6q5w8r7',
            source: 'Boston',
            destination: 'Tokyo, Japan',
            travelDate: '2025-01-05',
            travelTime: '18:00',
            transportMode: 'flight',
            optimizationMode: 'fastest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            userId: userIds[4] || 'user_01h4kxt2e8z9y3b1n7m6q5w8r8',
            source: 'Seattle',
            destination: 'Tokyo, Japan',
            travelDate: '2025-01-08',
            travelTime: '09:30',
            transportMode: 'flight',
            optimizationMode: 'cheapest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            userId: userIds[5] || 'user_01h4kxt2e8z9y3b1n7m6q5w8r9',
            source: 'Miami',
            destination: 'London, UK',
            travelDate: '2025-01-15',
            travelTime: '11:00',
            transportMode: 'flight',
            optimizationMode: 'shortest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            userId: userIds[6] || 'user_01h4kxt2e8z9y3b1n7m6q5w8ra',
            source: 'Austin',
            destination: 'Barcelona, Spain',
            travelDate: '2025-01-20',
            travelTime: '15:45',
            transportMode: 'flight',
            optimizationMode: 'fastest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            userId: userIds[7] || 'user_01h4kxt2e8z9y3b1n7m6q5w8rb',
            source: 'Portland',
            destination: 'Sydney, Australia',
            travelDate: '2025-01-25',
            travelTime: '07:00',
            transportMode: 'flight',
            optimizationMode: 'cheapest',
            status: 'active',
            routeData: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
    ];

    await db.insert(trips).values(sampleTrips);
    
    console.log('✅ Trips seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});