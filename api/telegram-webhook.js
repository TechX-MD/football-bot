const { handleTelegramUpdate } = require('../src/handlers/commandHandler');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (body) {
        await handleTelegramUpdate(body);
      }
    } catch (err) {
      console.error('Webhook processing error:', err.message);
    }
    return res.status(200).send('OK');
  }

  return res.status(200).send('Telegram Webhook Endpoint is Active & Ready!');
};
