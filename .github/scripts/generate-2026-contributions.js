#!/usr/bin/env node

/**
 * Generate a simple contribution grid for 2026
 * This script fetches only 2026 contribution data and creates a basic SVG visualization
 */

const fs = require('fs');
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_REPOSITORY_OWNER;

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN is required');
  process.exit(1);
}

const query = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              contributionLevel
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'User-Agent': 'GitHub-Contribution-Script'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(responseData));
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function generateSVG(calendar) {
  const cellSize = 12;
  const cellGap = 3;
  const weeks = calendar.weeks;
  const width = weeks.length * (cellSize + cellGap) + 60;
  const height = 7 * (cellSize + cellGap) + 40;

  // Color scheme matching GitHub's contribution levels
  const colors = {
    0: '#ebedf0',  // No contributions
    1: '#9be9a8',  // Low
    2: '#40c463',  // Medium-low
    3: '#30a14e',  // Medium-high
    4: '#216e39'   // High
  };

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .contribution-cell { stroke: rgba(27,31,35,0.06); stroke-width: 1; }
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; fill: #586069; }
    .title { font-size: 16px; font-weight: 600; fill: #24292e; }
  </style>
  <text x="10" y="20" class="title">2026 Contributions: ${calendar.totalContributions}</text>\n`;

  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const x = weekIndex * (cellSize + cellGap) + 10;
      const y = day.weekday * (cellSize + cellGap) + 35;
      const level = day.contributionLevel === 'NONE' ? 0 :
                    day.contributionLevel === 'FIRST_QUARTILE' ? 1 :
                    day.contributionLevel === 'SECOND_QUARTILE' ? 2 :
                    day.contributionLevel === 'THIRD_QUARTILE' ? 3 : 4;
      
      svg += `  <rect class="contribution-cell" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${colors[level]}" data-date="${day.date}" data-count="${day.contributionCount}">
    <title>${day.date}: ${day.contributionCount} contributions</title>
  </rect>\n`;
    });
  });

  svg += '</svg>';
  return svg;
}

async function main() {
  const variables = {
    login: USERNAME,
    from: '2026-01-01T00:00:00Z',
    to: '2026-12-31T23:59:59Z'
  };

  console.log(`Fetching 2026 contributions for ${USERNAME}...`);
  
  const response = await makeRequest({ query, variables });
  
  if (response.errors) {
    console.error('GraphQL Error:', response.errors);
    process.exit(1);
  }

  const calendar = response.data.user.contributionsCollection.contributionCalendar;
  console.log(`Total 2026 contributions: ${calendar.totalContributions}`);

  const distDir = 'dist';
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const svg = generateSVG(calendar);
  fs.writeFileSync(`${distDir}/github-contributions-2026.svg`, svg);
  console.log('✅ Generated dist/github-contributions-2026.svg');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
