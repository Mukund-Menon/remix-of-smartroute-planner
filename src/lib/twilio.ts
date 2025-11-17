import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !phoneNumber) {
  console.warn('⚠️ Twilio credentials not configured. SMS messaging will not work.');
}

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;
export const twilioPhoneNumber = phoneNumber;

export async function sendSMS(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!twilioClient || !twilioPhoneNumber) {
    return {
      success: false,
      error: 'Twilio not configured'
    };
  }

  try {
    const response = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to,
    });

    return {
      success: true,
      sid: response.sid,
    };
  } catch (error: any) {
    console.error('Twilio SMS error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    };
  }
}

export async function sendBulkSMS(recipients: Array<{ phone: string; message: string }>): Promise<{
  successful: number;
  failed: number;
  results: Array<{ phone: string; success: boolean; sid?: string; error?: string }>;
}> {
  const results = await Promise.all(
    recipients.map(async ({ phone, message }) => {
      const result = await sendSMS(phone, message);
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
