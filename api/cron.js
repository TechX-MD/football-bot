require('dotenv').config();
const { checkLiveMatches } = require('../src/services/matchTracker');

module.exports = async (req, res) => {
  try {
    const summary = await checkLiveMatches();
    return res.status(200).json({
      success: true,
      message: "Cron live check executed successfully",
      summary
    });
  } catch (err) {
    console.error('Cron execution error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
