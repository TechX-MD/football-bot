require('dotenv').config();
const { checkLiveMatches } = require('../src/services/matchTracker');

module.exports = async (req, res) => {
  try {
    await checkLiveMatches();
    return res.status(200).json({ status: 'Live check completed successfully' });
  } catch (err) {
    console.error('Cron error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
