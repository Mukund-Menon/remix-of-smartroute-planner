import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

if (!accountSid || !authToken || !whatsappNumber) {
  console.warn('⚠️ Twilio credentials not configured. WhatsApp messaging will not work.');
}

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;
export const twilioWhatsAppNumber = whatsappNumber;

export async function sendWhatsApp(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!twilioClient || !twilioWhatsAppNumber) {
    return {
      success: false,
      error: 'Twilio WhatsApp not configured'
    };
  }

  try {
    // Format phone numbers for WhatsApp
    const formattedFrom = twilioWhatsAppNumber.startsWith('whatsapp:') 
      ? twilioWhatsAppNumber 
      : `whatsapp:${twilioWhatsAppNumber}`;
    
    const formattedTo = to.startsWith('whatsapp:') 
      ? to 
      : `whatsapp:${to}`;

    const response = await twilioClient.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
    });

    return {
      success: true,
      sid: response.sid,
    };
  } catch (error: any) {
    console.error('Twilio WhatsApp error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message',
    };
  }
}

export async function sendBulkWhatsApp(recipients: Array<{ phone: string; message: string }>): Promise<{
  successful: number;
  failed: number;
  results: Array<{ phone: string; success: boolean; sid?: string; error?: string }>;
}> {
  const results = await Promise.all(
    recipients.map(async ({ phone, message }) => {
      const result = await sendWhatsApp(phone, message);
      return {
        phone,
        ...result,
      };
    })
  );

  return {
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };
}