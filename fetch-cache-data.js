import fs from 'fs';
import path from 'path';

// Note: Using built-in fetch API available in Node.js 18+
// Google Sheets configuration
const SHEET_ID = "1jUOqG0PaCYFsqNd1Sq2etqJ0prbZgPIoJVuwWh192IQ";

// Just fetch the actual sheets that exist
const SHEET_NAMES = ["lovable", "weights"]; // Simplified - just fetch what exists

async function fetchGoogleSheetData(sheetName) {
  const timestamp = Date.now();
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&range=A1:BH1048576&headers=1&timestamp=${timestamp}`;
  
  console.log(`Fetching ${sheetName}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName}: ${response.statusText}`);
  }
  
  const text = await response.text();
  
  // Parse Google Sheets JSONP response
  const jsonStartIndex = text.indexOf('(') + 1;
  const jsonEndIndex = text.lastIndexOf('}') + 1;
  const jsonText = text.substring(jsonStartIndex, jsonEndIndex);
  const data = JSON.parse(jsonText);
  
  if (!data.table || !data.table.rows) {
    throw new Error(`No data found in ${sheetName}`);
  }
  
  // Convert to our format
  const headers = data.table.cols?.map(col => col.label || '') || [];
  const rows = data.table.rows.map(row => 
    row.c?.map(cell => cell?.v || '') || []
  );
  
  return {
    headers,
    rows,
    weightedColumns: sheetName === 'weights' ? 
      rows[0]?.map(cell => cell && typeof cell === 'string' && cell.toLowerCase().includes('weighted')) || [] :
      Array(headers.length).fill(false)
  };
}

async function main() {
  try {
    console.log('🔄 Fetching fresh Google Sheets data...');
    
    // Create cache directory
    const cacheDir = path.join(process.cwd(), 'public', 'cached-data');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Fetch all sheets (simple approach - no duplication)
    const allData = {};
    for (const sheetName of SHEET_NAMES) {
      try {
        allData[sheetName] = await fetchGoogleSheetData(sheetName);
        console.log(`✅ ${sheetName}: ${allData[sheetName].rows.length} rows`);
      } catch (error) {
        console.error(`❌ Failed to fetch ${sheetName}:`, error.message);
        // Continue with other sheets instead of failing completely
        console.log(`⚠️ Skipping ${sheetName} and continuing...`);
      }
    }
    
    // Save to cache file
    const cacheData = {
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      data: allData
    };
    
    // Save as both file names for compatibility
    const localCacheFile = path.join(cacheDir, 'sheets-data.json');
    const githubCacheFile = path.join(cacheDir, 'investor-cache.json');
    
    fs.writeFileSync(localCacheFile, JSON.stringify(cacheData, null, 2));
    fs.writeFileSync(githubCacheFile, JSON.stringify(allData, null, 2)); // GitHub expects just the data object
    
    console.log(`✅ Cache updated successfully!`);
    console.log(`📁 Local cache: ${localCacheFile}`);
    console.log(`📁 GitHub cache: ${githubCacheFile}`);
    console.log(`📊 Total sheets cached: ${Object.keys(allData).length}`);
    console.log(`🕒 Timestamp: ${cacheData.timestamp}`);
    
  } catch (error) {
    console.error('❌ Cache update failed:', error);
    process.exit(1);
  }
}

main();
