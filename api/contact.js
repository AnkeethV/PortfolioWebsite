import { Resend } from 'resend';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Vercel Serverless Function: POST /api/contact
 * Handles contact form submissions with honeypot anti-spam and Resend email delivery
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = req.body || {};
    const { name, email, message, _gotcha, website } = body;

    // 1. Anti-spam Honeypot Check
    // Hidden fields filled only by automated scrapers/bots
    if (_gotcha || website) {
      console.log('🤖 Spam bot trapped by honeypot field. Discarding silently.');
      // Return synthetic 200 so bot does not retry
      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been sent.'
      });
    }

    // 2. Input Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid name (at least 2 characters).'
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a message (at least 5 characters).'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();
    const recipientEmail = process.env.NOTIFICATION_EMAIL || 'ankeeth.v@gmail.com';

    // 3. Email Delivery via Resend
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey && resendApiKey !== 'your_resend_api_key_here' && resendApiKey.startsWith('re_')) {
      const resend = new Resend(resendApiKey);

      const emailResponse = await resend.emails.send({
        from: 'Portfolio Contact <onboarding@resend.dev>',
        to: recipientEmail,
        reply_to: cleanEmail,
        subject: `[Portfolio Inquiry] Message from ${cleanName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2E2E2E; color: #F4F3EF; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-family: Georgia, serif;">New Portfolio Contact Message</h2>
            </div>
            <div style="padding: 24px;">
              <p><strong>From:</strong> ${cleanName}</p>
              <p><strong>Email:</strong> <a href="mailto:${cleanEmail}">${cleanEmail}</a></p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p><strong>Message:</strong></p>
              <div style="background-color: #f9f9f9; padding: 16px; border-radius: 6px; white-space: pre-wrap;">${cleanMessage}</div>
            </div>
            <div style="background-color: #f4f3ef; color: #777; padding: 12px 24px; font-size: 12px; text-align: center;">
              Sent from Ankeeth V Portfolio Website
            </div>
          </div>
        `
      });

      if (emailResponse.error) {
        console.error('Resend delivery error:', emailResponse.error);
        return res.status(500).json({
          success: false,
          error: 'Failed to deliver message via email provider.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been sent successfully.'
      });
    } else {
      // Local development simulation
      console.log('----------------------------------------------------');
      console.log('📨 [Contact Form Simulated Delivery]');
      console.log(`From:    ${cleanName} <${cleanEmail}>`);
      console.log(`To:      ${recipientEmail}`);
      console.log(`Message: ${cleanMessage}`);
      console.log('Notice:  Set RESEND_API_KEY in .env for live email dispatch.');
      console.log('----------------------------------------------------');

      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been sent successfully.',
        simulated: true
      });
    }
  } catch (err) {
    console.error('Error in contact form handler:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while processing your message.'
    });
  }
}
