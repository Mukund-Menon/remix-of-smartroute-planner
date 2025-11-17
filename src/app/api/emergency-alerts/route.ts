import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emergencyAlerts, emergencyContacts, trips, user } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { sendBulkSMS } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  try {
    // Extract session using better-auth
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { tripId, locationType, message, currentLocation } = body;

    // Validate locationType
    if (!locationType || !['current', 'destination'].includes(locationType)) {
      return NextResponse.json(
        { 
          error: 'Invalid locationType. Must be "current" or "destination"',
          code: 'INVALID_LOCATION_TYPE' 
        },
        { status: 400 }
      );
    }

    // Get all emergency contacts for the user
    const contacts = await db.select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId));

    // Check if user has emergency contacts
    if (contacts.length === 0) {
      return NextResponse.json(
        { 
          error: 'No emergency contacts configured. Please add emergency contacts before triggering SOS.',
          code: 'NO_EMERGENCY_CONTACTS' 
        },
        { status: 400 }
      );
    }

    // Determine location based on locationType
    let locationLat: number;
    let locationLng: number;
    let locationName: string;
    let tripIdToSave: number | null = null;

    if (locationType === 'current') {
      // Validate currentLocation
      if (!currentLocation || 
          typeof currentLocation.lat !== 'number' || 
          typeof currentLocation.lng !== 'number' || 
          !currentLocation.name) {
        return NextResponse.json(
          { 
            error: 'For current location type, currentLocation with lat, lng, and name is required',
            code: 'MISSING_CURRENT_LOCATION' 
          },
          { status: 400 }
        );
      }

      locationLat = currentLocation.lat;
      locationLng = currentLocation.lng;
      locationName = currentLocation.name;
      tripIdToSave = tripId || null;
    } else {
      // locationType === 'destination'
      if (!tripId) {
        return NextResponse.json(
          { 
            error: 'tripId is required for destination location type',
            code: 'MISSING_TRIP_ID' 
          },
          { status: 400 }
        );
      }

      // Fetch trip destination
      const trip = await db.select()
        .from(trips)
        .where(eq(trips.id, tripId))
        .limit(1);

      if (trip.length === 0) {
        return NextResponse.json(
          { error: 'Trip not found', code: 'TRIP_NOT_FOUND' },
          { status: 404 }
        );
      }

      const tripData = trip[0];
      
      // Parse destination coordinates
      if (!tripData.destinationCoordinates) {
        return NextResponse.json(
          { 
            error: 'Trip does not have destination coordinates',
            code: 'MISSING_DESTINATION_COORDINATES' 
          },
          { status: 400 }
        );
      }

      const coordinates = tripData.destinationCoordinates.split(',').map(parseFloat);
      locationLat = coordinates[0];
      locationLng = coordinates[1];
      locationName = tripData.destination;
      tripIdToSave = tripId;
    }

    // Get user name for alert message
    const userData = await db.select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const userName = userData[0]?.name || 'User';
    const userPhone = userData[0]?.email || 'Unknown';

    // Build alert message
    const alertMessage = message || 
      `🆘 EMERGENCY ALERT from ${userName}! Location: ${locationName}. Coordinates: ${locationLat.toFixed(6)}, ${locationLng.toFixed(6)}`;

    // Create sentTo array with contact IDs
    const sentToArray = contacts.map(contact => contact.id);

    // Create emergencyAlerts record
    const newAlert = await db.insert(emergencyAlerts)
      .values({
        userId,
        tripId: tripIdToSave,
        alertType: 'manual_sos',
        locationLat,
        locationLng,
        locationName,
        message: alertMessage,
        sentTo: sentToArray,
        createdAt: new Date().toISOString(),
      })
      .returning();

    // Prepare SMS messages for all contacts
    const smsRecipients = contacts.map(contact => ({
      phone: contact.phone,
      message: `${alertMessage}\n\nContact ${userName} immediately at ${userPhone}.\n\nView location: https://www.google.com/maps?q=${locationLat},${locationLng}`
    }));

    // Send SMS messages via Twilio
    const smsResults = await sendBulkSMS(smsRecipients);

    // Log notification details
    console.log('=== EMERGENCY ALERT NOTIFICATIONS ===');
    console.log(`Alert ID: ${newAlert[0].id}`);
    console.log(`From: ${userName} (${userId})`);
    console.log(`Message: ${alertMessage}`);
    console.log(`\nSMS Results: ${smsResults.successful} successful, ${smsResults.failed} failed`);
    console.log('\nNotifications sent to:');
    
    smsResults.results.forEach(result => {
      const contact = contacts.find(c => c.phone === result.phone);
      console.log(`\n- Contact: ${contact?.name || 'Unknown'} (${contact?.relationship || 'N/A'})`);
      console.log(`  Phone: ${result.phone}`);
      console.log(`  SMS Status: ${result.success ? '✅ Sent' : '❌ Failed'}`);
      if (result.sid) console.log(`  Message SID: ${result.sid}`);
      if (result.error) console.log(`  Error: ${result.error}`);
    });
    
    console.log('\n=====================================\n');

    // Format contacts for response
    const contactsForResponse = contacts.map(contact => {
      const smsResult = smsResults.results.find(r => r.phone === contact.phone);
      return {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        smsDelivered: smsResult?.success || false,
      };
    });

    return NextResponse.json(
      {
        success: true,
        alertId: newAlert[0].id,
        contactsNotified: contacts.length,
        smsDelivered: smsResults.successful,
        smsFailed: smsResults.failed,
        message: `Emergency alert sent to ${contacts.length} contact(s). ${smsResults.successful} SMS delivered.`,
        contacts: contactsForResponse,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract session using better-auth
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get all emergency alerts for the user, ordered by most recent first
    const alerts = await db.select({
      id: emergencyAlerts.id,
      userId: emergencyAlerts.userId,
      tripId: emergencyAlerts.tripId,
      alertType: emergencyAlerts.alertType,
      locationLat: emergencyAlerts.locationLat,
      locationLng: emergencyAlerts.locationLng,
      locationName: emergencyAlerts.locationName,
      message: emergencyAlerts.message,
      sentTo: emergencyAlerts.sentTo,
      createdAt: emergencyAlerts.createdAt,
      trip: trips,
    })
      .from(emergencyAlerts)
      .leftJoin(trips, eq(emergencyAlerts.tripId, trips.id))
      .where(eq(emergencyAlerts.userId, userId))
      .orderBy(desc(emergencyAlerts.createdAt));

    // Format response to parse sentTo JSON and include trip details
    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      userId: alert.userId,
      tripId: alert.tripId,
      alertType: alert.alertType,
      locationLat: alert.locationLat,
      locationLng: alert.locationLng,
      locationName: alert.locationName,
      message: alert.message,
      sentTo: alert.sentTo || [],
      createdAt: alert.createdAt,
      trip: alert.trip || null,
    }));

    return NextResponse.json(formattedAlerts, { status: 200 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}