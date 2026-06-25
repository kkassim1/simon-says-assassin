function initSteam() {
  const appId = process.env.STEAM_APP_ID;
  if (!appId) {
    console.log('[steam] STEAM_APP_ID not set; running without Steamworks.');
    return null;
  }

  console.log(`[steam] App ${appId} configured. Add a Steamworks SDK bridge here for achievements, overlay, friends, and leaderboards.`);
  return { appId };
}

module.exports = { initSteam };
