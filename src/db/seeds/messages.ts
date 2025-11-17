import { db } from '@/db';
import { messages, groups, user } from '@/db/schema';

async function main() {
    // First, check if groups exist
    const existingGroups = await db.select({ id: groups.id }).from(groups);
    
    if (existingGroups.length === 0) {
        console.log('⚠️ No groups found. Please seed groups first.');
        return;
    }

    // Check if users exist
    const existingUsers = await db.select({ id: user.id }).from(user);
    
    if (existingUsers.length === 0) {
        console.log('⚠️ No users found. Please seed users first.');
        return;
    }

    // Extract group and user IDs
    const groupIds = existingGroups.map(g => g.id);
    const userIds = existingUsers.map(u => u.id);

    // Generate base timestamp (3 days ago)
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 3);

    const sampleMessages = [
        {
            groupId: groupIds[0],
            userId: userIds[0],
            message: "Hey everyone! Excited for this trip!",
            createdAt: new Date(baseDate.getTime()).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[1 % userIds.length],
            message: "Me too! Can't wait to explore together!",
            createdAt: new Date(baseDate.getTime() + 15 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[2 % userIds.length],
            message: "What time should we meet at the airport?",
            createdAt: new Date(baseDate.getTime() + 2 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[0],
            message: "I was thinking 9 AM. That gives us plenty of time before boarding.",
            createdAt: new Date(baseDate.getTime() + 2 * 3600000 + 20 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[1 % userIds.length],
            message: "Perfect! I'll be there at 8:45 AM to help with check-in.",
            createdAt: new Date(baseDate.getTime() + 3 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[Math.min(1, groupIds.length - 1)],
            userId: userIds[2 % userIds.length],
            message: "I've booked our accommodation, sending details soon",
            createdAt: new Date(baseDate.getTime() + 24 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[Math.min(1, groupIds.length - 1)],
            userId: userIds[0],
            message: "Great! Does anyone need help with visa arrangements?",
            createdAt: new Date(baseDate.getTime() + 24 * 3600000 + 30 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[2 % userIds.length],
            message: "Can we share a taxi from the airport to save costs?",
            createdAt: new Date(baseDate.getTime() + 25 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[1 % userIds.length],
            message: "Absolutely! Let's coordinate once we all land.",
            createdAt: new Date(baseDate.getTime() + 25 * 3600000 + 10 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[0],
            message: "I found a great restaurant we should try on the first evening!",
            createdAt: new Date(baseDate.getTime() + 26 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[Math.min(1, groupIds.length - 1)],
            userId: userIds[2 % userIds.length],
            message: "What's the weather forecast looking like?",
            createdAt: new Date(baseDate.getTime() + 36 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[Math.min(1, groupIds.length - 1)],
            userId: userIds[1 % userIds.length],
            message: "It's going to be around 15-20°C. Don't forget to pack warm clothes!",
            createdAt: new Date(baseDate.getTime() + 36 * 3600000 + 45 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[0],
            message: "Has everyone completed check-in?",
            createdAt: new Date(baseDate.getTime() + 48 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[2 % userIds.length],
            message: "Yes! All set. Got my boarding pass.",
            createdAt: new Date(baseDate.getTime() + 48 * 3600000 + 15 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[1 % userIds.length],
            message: "Same here! Looking forward to meeting you all tomorrow!",
            createdAt: new Date(baseDate.getTime() + 48 * 3600000 + 30 * 60000).toISOString(),
        },
        {
            groupId: groupIds[Math.min(1, groupIds.length - 1)],
            userId: userIds[0],
            message: "Should we create a shared expense tracker for the trip?",
            createdAt: new Date(baseDate.getTime() + 50 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[Math.min(1, groupIds.length - 1)],
            userId: userIds[2 % userIds.length],
            message: "Good idea! I'll set up a Splitwise group for us.",
            createdAt: new Date(baseDate.getTime() + 50 * 3600000 + 20 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[1 % userIds.length],
            message: "Does anyone have dietary restrictions I should know about for restaurant bookings?",
            createdAt: new Date(baseDate.getTime() + 60 * 3600000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[0],
            message: "I'm vegetarian, but I can always find options. Thanks for asking!",
            createdAt: new Date(baseDate.getTime() + 60 * 3600000 + 10 * 60000).toISOString(),
        },
        {
            groupId: groupIds[0],
            userId: userIds[2 % userIds.length],
            message: "See you all at the airport! Safe travels everyone! ✈️",
            createdAt: new Date(baseDate.getTime() + 70 * 3600000).toISOString(),
        },
    ];

    await db.insert(messages).values(sampleMessages);
    
    console.log('✅ Messages seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});