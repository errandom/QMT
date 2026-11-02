const { HttpError } = require('./bookings.cjs');

function createMailbox(env = process.env, fetcher = fetch) {
  const keys = ['QMT_MAIL_TENANT_ID', 'QMT_MAIL_CLIENT_ID', 'QMT_MAIL_CLIENT_SECRET', 'QMT_MAIL_SENDER'];
  const configured = keys.every(key => Boolean(env[key]?.trim()));
  let token;
  let expires = 0;
  async function accessToken() {
    if (!configured) throw new HttpError(503, 'Mail is not configured. Configure the QMT mailbox before sending or syncing.');
    if (Date.now() < expires) return token;
    const response = await fetcher(`https://login.microsoftonline.com/${encodeURIComponent(env.QMT_MAIL_TENANT_ID)}/oauth2/v2.0/token`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ client_id: env.QMT_MAIL_CLIENT_ID, client_secret: env.QMT_MAIL_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    });
    if (!response.ok) throw new HttpError(503, 'Mailbox authentication failed; check the deployment configuration');
    const data = await response.json();
    if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in)) throw new HttpError(503, 'Invalid mailbox authentication response');
    token = data.access_token;
    expires = Date.now() + Math.max(0, data.expires_in - 60) * 1000;
    return token;
  }
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.QMT_MAIL_SENDER || '')}`;
  return {
    configured,
    async send({ recipient, subject, message }) {
      const bearer = await accessToken();
      let response;
      try {
        response = await fetcher(`${base}/sendMail`, {
          method: 'POST', signal: AbortSignal.timeout(20000),
          headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { subject, body: { contentType: 'Text', content: message },
            toRecipients: [{ emailAddress: { address: recipient } }] } }),
        });
      } catch (error) {
        const unknown = new HttpError(503, 'Send outcome is unknown. Check Sent Items before sending again.');
        unknown.deliveryUnknown = true;
        unknown.cause = error;
        throw unknown;
      }
      if (response.status !== 202) {
        const error = new HttpError(503, `Mailbox rejected the send (${response.status}); review mailbox permissions and limits`);
        error.deliveryUnknown = response.status >= 500;
        throw error;
      }
      return 'accepted';
    },
    async replies(requestId, since) {
      const bearer = await accessToken();
      const query = new URLSearchParams({
        '$filter': `receivedDateTime ge ${new Date(since).toISOString()} and contains(subject,'[QMT-${requestId}]')`,
        '$select': 'id,internetMessageId,subject,from,body,receivedDateTime', '$top': '100',
      });
      let next = `${base}/mailFolders/inbox/messages?${query}`;
      const messages = [];
      for (let page = 0; next && page < 20; page++) {
        const url = new URL(next);
        if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/users/')) throw new HttpError(503, 'Invalid mailbox pagination URL');
        const response = await fetcher(next, { signal: AbortSignal.timeout(20000), headers: {
          Authorization: `Bearer ${bearer}`, Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
        } });
        if (!response.ok) throw new HttpError(503, `Mailbox sync failed (${response.status})`);
        const data = await response.json();
        if (!Array.isArray(data.value)) throw new HttpError(503, 'Invalid mailbox sync response');
        messages.push(...data.value);
        next = data['@odata.nextLink'];
      }
      if (next) throw new HttpError(409, 'Reply sync exceeds 2,000 messages; archive the request thread before retrying');
      return messages;
    },
  };
}
module.exports = { createMailbox };
