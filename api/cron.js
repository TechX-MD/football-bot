require('dotenv').config();
const { checkLiveMatches } = require('../src/services/matchTracker');

module.exports = async (req, res) => {
  try {
    // Check 1 pakarepo
    const check1 = await checkLiveMatches();

    // Mira masekonzi 4 woita Check 2 mukati me request imwe chete
    await new Promise(r => setTimeout(r, 4000));
    const check2 = await checkLiveMatches();

    return res.status(200).json({
      success: true,
      message: "Double high-speed check completed",
      alerts: (check1.alertsSent || 0) + (check2.alertsSent || 0)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
