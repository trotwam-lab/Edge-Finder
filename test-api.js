// test-api.js — Local test script for game-research API
// Run: node test-api.js

// Load env vars from .env.local if present
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed, continue
}

const ODDS_API_KEY = process.env.ODDS_API_KEY;

if (!ODDS_API_KEY) {
  console.error('❌ ERROR: ODDS_API_KEY not found in environment');
  console.log('\nTo test locally, create a .env.local file with:');
  console.log('ODDS_API_KEY=your_api_key_here');
  console.log('\nOr run: export ODDS_API_KEY=your_key');
  process.exit(1);
}

console.log('✅ ODDS_API_KEY found');
console.log('Testing API calls...\n');

// Test 1: Fetch recent scores
async function testRecentScores(teamName, sport = 'basketball_nba') {
  console.log(`🔍 Testing: Recent scores for ${teamName}`);
  
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${ODDS_API_KEY}&daysFrom=30`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) {
      console.error(`❌ HTTP Error: ${res.status}`);
      return null;
    }
    
    const games = await res.json();
    
    const teamGames = games
      .filter(g => 
        g.completed && 
        (g.home_team.includes(teamName.split(' ').pop()) || 
         g.away_team.includes(teamName.split(' ').pop()))
      )
      .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
      .slice(0, 5);
    
    console.log(`✅ Found ${teamGames.length} games for ${teamName}`);
    
    if (teamGames.length > 0) {
      console.log('   Latest game:', {
        date: teamGames[0].commence_time,
        teams: `${teamGames[0].home_team} vs ${teamGames[0].away_team}`,
        score: `${teamGames[0].scores?.[0]?.score}-${teamGames[0].scores?.[1]?.score}`,
      });
    }
    
    return teamGames;
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    return null;
  }
}

// Test 2: Check API quota
async function testQuota() {
  console.log('\n🔍 Testing: API Quota');
  
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${ODDS_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    const remaining = res.headers.get('x-requests-remaining');
    const used = res.headers.get('x-requests-used');
    
    console.log(`✅ API Quota: ${remaining} remaining, ${used} used`);
  } catch (e) {
    console.log('⚠️ Could not check quota');
  }
}

// Run tests
async function runTests() {
  console.log('=================================');
  console.log('EdgeFinder API Test');
  console.log('=================================\n');
  
  // Test NHL (has games now)
  await testRecentScores('Boston Bruins', 'icehockey_nhl');
  await testRecentScores('Vegas Golden Knights', 'icehockey_nhl');
  
  // Test NBA
  await testRecentScores('Boston Celtics', 'basketball_nba');
  await testRecentScores('Los Angeles Lakers', 'basketball_nba');
  
  // Check quota
  await testQuota();
  
  console.log('\n=================================');
  console.log('Test Complete');
  console.log('=================================');
}

runTests();
