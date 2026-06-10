const https = require('https');

const spots = [
  "Somapura Mahavihara", "Sixty Dome Mosque", "Khagrachari", "Nilachal", "Thanchi", "Ruma", "Keokradong", "Tajingdong", "Chimbuk Hill", "Alikadam", "Rowangchhari",
  "Mahamaya Lake", "Parki Sea Beach", "Kaptai Lake", "Hanging Bridge Rangamati", "Subalong Waterfall", "Alutila Cave", "Richang Waterfall", "Dighinala",
  "Chera Dwip", "Teknaf", "Sonar Char", "Gangamati Beach",
  "Nijhum Island", "Hatiya Island", "Sandwip", "Maheshkhali", "Kutubdia",
  "Shalban Vihara", "Mainamati",
  "War Cemetery", "Batali Hill", "Sitakunda", "Chandranath Temple",
  "Tanguar Haor", "Hakaluki Haor", "Madhabpur Lake", "Ham Ham Waterfall",
  "National Parliament House", "National Martyrs' Memorial", "Baitul Mukarram Mosque", "Dhakeshwari Temple", "National Museum",
  "Ramna Park", "Suhrawardy Udyan", "Botanical Garden", "National Zoo",
  "Bhola Island", "Char Kukri Mukri", "Monpura Island",
  "Kuakata Sea Beach", "Lebur Char", "Bhetua Beach",
  "Padma Bridge", "Mujibnagar",
  "Hardinge Bridge", "Puthia Rajbari", "Bagha Mosque",
  "Kantajew Temple",
  "Lalon Akhra", "Rabindra Kuthibari"
];

const fetchJSON = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'TourismAppAgent/1.0 (contact@example.com)' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch(e) {
        resolve(null);
      }
    });
  }).on('error', reject);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const newImages = {};
  for (const name of spots) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' Bangladesh')}&utf8=&format=json`;
      const searchData = await fetchJSON(searchUrl);
      await sleep(100);
      if (searchData && searchData.query && searchData.query.search.length > 0) {
        const title = searchData.query.search[0].title;
        const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=1000`;
        const imgData = await fetchJSON(imgUrl);
        await sleep(100);
        if (imgData && imgData.query && imgData.query.pages) {
          const pages = imgData.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail && pages[pageId].thumbnail.source) {
            newImages[name] = pages[pageId].thumbnail.source;
            console.log(`Found image for ${name}`);
          }
        }
      }
    } catch(e) {}
  }
  
  const fs = require('fs');
  fs.writeFileSync('scratch/newImages.json', JSON.stringify(newImages, null, 2));
  console.log("Done. Wrote scratch/newImages.json");
}

main();
