const db = require('../config/db');

const spotsData = [
  ["Cox's Bazar Sea Beach", "Cox's Bazar", "beach", [21.4159, 91.9810]],
  ["Sundarbans", "Khulna", "nature", [21.9497, 89.1833]],
  ["Somapura Mahavihara", "Naogaon", "history", [25.0311, 88.9769]],
  ["Lalbagh Fort", "Dhaka", "history", [23.7190, 90.3881]],
  ["Sonargaon", "Narayanganj", "history", [23.6445, 90.5984]],
  ["Sixty Dome Mosque", "Bagerhat", "religious", [22.6744, 89.7419]],
  ["Ahsan Manzil", "Dhaka", "history", [23.7086, 90.4061]],
  ["Bandarban", "Bandarban", "nature", [22.2053, 92.2384]],
  ["Rangamati", "Rangamati", "nature", [23.4159, 92.2985]],
  ["Khagrachari", "Khagrachari", "nature", [23.4126, 91.9868]],
  ["Sajek Valley", "Rangamati", "nature", [23.3909, 92.2855]],
  ["Nilgiri","Bandarban","nature"],
  ["Nilachal","Bandarban","nature"],
  ["Thanchi","Bandarban","nature"],
  ["Ruma","Bandarban","nature"],
  ["Keokradong","Bandarban","nature"],
  ["Tajingdong","Bandarban","nature"],
  ["Chimbuk Hill","Bandarban","nature"],
  ["Alikadam","Bandarban","nature"],
  ["Rowangchhari","Bandarban","nature"],
  ["Mahamaya Lake","Chattogram","nature"],
  ["Foy's Lake","Chattogram","nature"],
  ["Patenga Sea Beach","Chattogram","beach"],
  ["Parki Sea Beach","Chattogram","beach"],
  ["Kaptai Lake","Rangamati","nature"],
  ["Hanging Bridge Rangamati","Rangamati","nature"],
  ["Subalong Waterfall","Rangamati","nature"],
  ["Alutila Cave","Khagrachari","nature"],
  ["Richang Waterfall","Khagrachari","nature"],
  ["Dighinala","Khagrachari","nature"],
  ["Saint Martin's Island", "Cox's Bazar", "beach", [20.6131, 92.3267]],
  ["Chera Dwip","Cox's Bazar","beach"],
  ["Teknaf","Cox's Bazar","beach"],
  ["Himchari","Cox's Bazar","beach"],
  ["Inani Beach","Cox's Bazar","beach"],
  ["Kuakata","Patuakhali","beach"],
  ["Sonar Char","Patuakhali","beach"],
  ["Gangamati Beach","Patuakhali","beach"],
  ["Nijhum Island","Noakhali","ecotourism"],
  ["Hatiya Island","Noakhali","nature"],
  ["Sandwip","Chattogram","nature"],
  ["Maheshkhali","Cox's Bazar","nature"],
  ["Kutubdia","Cox's Bazar","nature"],
  ["Shalban Vihara","Cumilla","history"],
  ["Mainamati","Cumilla","history"],
  ["War Cemetery","Chattogram","history"],
  ["Batali Hill","Chattogram","nature"],
  ["Sitakunda","Chattogram","nature"],
  ["Chandranath Temple","Chattogram","religious"],
  ["Tanguar Haor", "Sunamganj", "wetland", [25.1414, 91.0664]],
  ["Hakaluki Haor","Moulvibazar","wetland"],
  ["Srimangal Tea Garden","Moulvibazar","nature"],
  ["Madhabpur Lake","Moulvibazar","nature"],
  ["Ham Ham Waterfall","Moulvibazar","nature"],
  ["Lawachara National Park","Moulvibazar","ecotourism"],
  ["Jaflong","Sylhet","nature"],
  ["Bichanakandi","Sylhet","nature"],
  ["Ratargul Swamp Forest","Sylhet","wetland"],
  ["National Parliament House","Dhaka","city"],
  ["National Martyrs' Memorial","Dhaka","history"],
  ["Baitul Mukarram Mosque","Dhaka","religious"],
  ["Dhakeshwari Temple","Dhaka","religious"],
  ["National Museum","Dhaka","culture"],
  ["Ramna Park","Dhaka","city"],
  ["Suhrawardy Udyan","Dhaka","city"],
  ["Botanical Garden","Dhaka","nature"],
  ["National Zoo","Dhaka","city"],
  ["Bhola Island","Bhola","nature"],
  ["Char Kukri Mukri","Bhola","ecotourism"],
  ["Monpura Island","Bhola","nature"],
  ["Kuakata Sea Beach","Patuakhali","beach"],
  ["Lebur Char","Patuakhali","beach"],
  ["Bhetua Beach","Barguna","beach"],
  ["Padma Bridge","Madaripur","city"],
  ["Mujibnagar","Meherpur","history"],
  ["Hardinge Bridge","Pabna","history"],
  ["Puthia Rajbari","Rajshahi","history"],
  ["Bagha Mosque","Rajshahi","religious"],
  ["Kantajew Temple","Dinajpur","religious"],
  ["Ramsagar","Dinajpur","nature"],
  ["Lalon Akhra","Kushtia","culture"],
  ["Rabindra Kuthibari","Kushtia","culture"]
];

const districtCoords = {
  "Dhaka": [23.8103, 90.4125],
  "Cox's Bazar": [21.4425, 91.9674],
  "Khulna": [22.8456, 89.5339],
  "Naogaon": [24.1959, 88.9315],
  "Bandarban": [22.2053, 92.2384],
  "Rangamati": [23.4159, 92.2985],
  "Khagrachari": [23.4126, 91.9868],
  "Chattogram": [22.3569, 91.7832],
  "Patuakhali": [22.2526, 90.3298],
  "Noakhali": [23.0137, 91.6309],
  "Cumilla": [23.4607, 91.1809],
  "Sylhet": [24.8949, 91.8687],
  "Sunamganj": [25.2581, 91.3955],
  "Moulvibazar": [24.4829, 91.7271],
  "Narayanganj": [23.6327, 90.5],
  "Bagerhat": [22.6510, 89.7869],
  "Madaripur": [23.1641, 90.1882],
  "Meherpur": [23.7657, 88.6313],
  "Pabna": [23.9169, 89.2334],
  "Rajshahi": [24.3745, 88.6042],
  "Dinajpur": [25.6270, 88.6389],
  "Kushtia": [23.9012, 89.1210],
  "Bhola": [22.6859, 90.6482],
  "Barguna": [22.1586, 90.1261]
};

const districtToDivision = {
  "Dhaka": "dhaka",
  "Narayanganj": "dhaka",
  "Madaripur": "dhaka",
  "Chattogram": "chattogram",
  "Cox's Bazar": "chattogram",
  "Bandarban": "chattogram",
  "Rangamati": "chattogram",
  "Khagrachari": "chattogram",
  "Cumilla": "chattogram",
  "Noakhali": "chattogram",
  "Khulna": "khulna",
  "Bagerhat": "khulna",
  "Kushtia": "khulna",
  "Meherpur": "khulna",
  "Patuakhali": "barishal",
  "Bhola": "barishal",
  "Barguna": "barishal",
  "Naogaon": "rajshahi",
  "Rajshahi": "rajshahi",
  "Pabna": "rajshahi",
  "Dinajpur": "rangpur",
  "Sylhet": "sylhet",
  "Sunamganj": "sylhet",
  "Moulvibazar": "sylhet"
};

const spotFilterProfiles = {
  beach: { budget: 'high' },
  nature: { budget: 'mid' },
  history: { budget: 'low' },
  religious: { budget: 'low' },
  city: { budget: 'high' },
  wetland: { budget: 'mid' },
  ecotourism: { budget: 'low' },
  culture: { budget: 'low' }
};

const spotFilterOverrides = {
  Sundarbans: { budget: 'high' },
  'Saint Martin\'s Island': { budget: 'high' },
  Nilgiri: { budget: 'high' },
  'Sajek Valley': { budget: 'mid' },
  Kuakata: { budget: 'mid' },
  'Srimangal Tea Garden': { budget: 'mid' },
  Jaflong: { budget: 'mid' }
};

const spotImages = {
  "Cox's Bazar Sea Beach": "Coxs bazar.jpg",
  "Sundarbans": "Sundarban_Tiger.jpg",
  "Lalbagh Fort": "Lalbagh fort.jpg",
  "Sonargaon": "Sonargaon .jpg",
  "Ahsan Manzil": "ahsan-monjil.jpg",
  "Bandarban": "Bandarban.jpg",
  "Rangamati": "Rangamati.jpg",
  "Sajek Valley": "Chittagong hill tracks.jpg",
  "Nilgiri": "Nilgiri.jpg",
  "Foy's Lake": "Foys lake.jpg",
  "Patenga Sea Beach": "Potenga sea Beach .jpg",
  "Saint Martin's Island": "Saint martin.jpg",
  "Kuakata": "Kuyakata.jpg",
  "Srimangal Tea Garden": "SRIMANGAL.jpg",
  "Jaflong": "Jaflang.jpg",
  "Bichanakandi": "Bishankandi-4.jpg",
  "Lawachara National Park": "LAWYACHORA GARDEN.jpg",
  "Ramsagar": "Ramsagar national park.jpg",
  "Inani Beach": "Coxs bazar.jpg",
  "Himchari": "Coxs bazar.jpg",
  "Ratargul Swamp Forest": "Bishankandi-4.jpg"
};

const firstNames = ['Arif', 'Nusrat', 'Rafiq', 'Maya', 'Tasnim', 'Sujon', 'Jahan', 'Rumana', 'Faruk', 'Lima', 'Kamal', 'Habib', 'Yasmin', 'Zaman', 'Rashed', 'Jamil', 'Tariq', 'Sania', 'Anis', 'Nipa'];
const lastNames = ['Rahman', 'Islam', 'Khan', 'Begum', 'Ahmed', 'Chowdhury', 'Akter', 'Uddin', 'Hassan', 'Ali', 'Siddique', 'Kabir'];
const languagesList = [
  'Bengali, English',
  'Bengali, English, Hindi',
  'Bengali, English, Arabic',
  'Bengali, English, French'
];
const specialtiesList = [
  'Local History, Trekking, Photography',
  'Wildlife, Eco-tourism, Camping',
  'Cultural Tours, Culinary Guiding',
  'Historical Architecture, Photography',
  'Adventure Hiking, Local Tribes & Culture'
];
const experienceOptions = ['2 years', '3 years', '4 years', '5 years', '6 years', '7 years', '8 years'];

async function seed() {
  console.log('[seeder] Starting database migration & synchronization...');
  
  try {
    // 1. Alter spots table enum to support 'Mid'
    await db.query(`
      ALTER TABLE spots 
      MODIFY COLUMN budget_category ENUM('Low', 'Mid', 'High') DEFAULT 'Low'
    `);
    console.log('[seeder] Successfully altered spots budget_category column to support Mid');

    // 2. Fetch existing divisions, districts, spots, and guides
    const [divisionsRows] = await db.query('SELECT * FROM divisions');
    const [districtsRows] = await db.query('SELECT * FROM districts');
    const [spotsRows] = await db.query('SELECT * FROM spots');

    const divisionsMap = {}; // name.toLowerCase() -> id
    divisionsRows.forEach(row => {
      divisionsMap[row.name.toLowerCase()] = row.id;
    });

    const districtsMap = {}; // name.toLowerCase() -> id
    districtsRows.forEach(row => {
      districtsMap[row.name.toLowerCase()] = row.id;
    });

    const spotsMap = {}; // name.toLowerCase() -> id
    spotsRows.forEach(row => {
      spotsMap[row.name.toLowerCase()] = row.id;
    });

    // Helper to capitalize first letter
    const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

    // 3. Process all 82 spots
    for (const spot of spotsData) {
      const [name, districtName, categoryKey, coords] = spot;
      
      // Determine Division Name
      const divKey = districtToDivision[districtName] || 'dhaka';
      const divisionName = capitalize(divKey);

      // Find or create Division
      let divisionId = divisionsMap[divisionName.toLowerCase()];
      if (!divisionId) {
        const [res] = await db.query('INSERT INTO divisions (name) VALUES (?)', [divisionName]);
        divisionId = res.insertId;
        divisionsMap[divisionName.toLowerCase()] = divisionId;
        console.log(`[seeder] Created division: ${divisionName} (ID: ${divisionId})`);
      }

      // Find or create District
      let districtId = districtsMap[districtName.toLowerCase()];
      if (!districtId) {
        const [res] = await db.query('INSERT INTO districts (name, division_id) VALUES (?, ?)', [districtName, divisionId]);
        districtId = res.insertId;
        districtsMap[districtName.toLowerCase()] = districtId;
        console.log(`[seeder] Created district: ${districtName} under ${divisionName} (ID: ${districtId})`);
      }

      // Determine Category
      const category = capitalize(categoryKey);

      // Determine Coordinates
      const lat = coords ? coords[0] : (districtCoords[districtName] ? districtCoords[districtName][0] : 23.685);
      const lng = coords ? coords[1] : (districtCoords[districtName] ? districtCoords[districtName][1] : 90.3563);

      // Determine Budget
      const rawBudget = spotFilterOverrides[name]?.budget || spotFilterProfiles[categoryKey]?.budget || 'low';
      const budgetCategory = capitalize(rawBudget); // 'Low', 'Mid', or 'High'

      // Determine Image
      const image = spotImages[name] || '';

      const description = `${name} is a beautiful ${categoryKey} spot located in the ${districtName} district of ${divisionName} division.`;
      const history = `${name} has rich history and cultural significance, making it a must-visit destination.`;

      let spotId = spotsMap[name.toLowerCase()];
      if (!spotId) {
        // Insert spot
        const [res] = await db.query(`
          INSERT INTO spots 
          (name, district_id, division_id, category, description, history, image, budget_category, latitude, longitude) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, districtId, divisionId, category, description, history, image, budgetCategory, lat, lng]);
        spotId = res.insertId;
        spotsMap[name.toLowerCase()] = spotId;
        console.log(`[seeder] Seeded spot: ${name} (ID: ${spotId})`);
      } else {
        // Update coordinates and budget category to make sure existing spots are fully initialized
        await db.query(`
          UPDATE spots 
          SET latitude = ?, longitude = ?, budget_category = ?, category = ?, image = IF(image = '', ?, image)
          WHERE id = ?
        `, [lat, lng, budgetCategory, category, image, spotId]);
      }

      // 4. Populate Guides for this spot
      const [guidesCount] = await db.query('SELECT COUNT(*) as count FROM guides WHERE spot_id = ?', [spotId]);
      const currentCount = guidesCount[0].count;

      if (currentCount < 2) {
        const guidesToInsert = 2 - currentCount;
        const usedNames = new Set();

        for (let i = 0; i < guidesToInsert; i++) {
          let gName = '';
          // Ensure unique names
          do {
            const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
            const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
            gName = `${fn} ${ln}`;
          } while (usedNames.has(gName));
          
          usedNames.add(gName);

          const experience = experienceOptions[Math.floor(Math.random() * experienceOptions.length)];
          const rating = (4.2 + Math.random() * 0.7).toFixed(1); // 4.2 to 4.9
          const languages = languagesList[Math.floor(Math.random() * languagesList.length)];
          const specialties = specialtiesList[Math.floor(Math.random() * specialtiesList.length)];
          const price = 2000 + Math.floor(Math.random() * 7) * 500; // 2000 to 5000 in multiples of 500
          const contact = `+880 171${Math.floor(1 + Math.random() * 9)}-${Math.floor(100000 + Math.random() * 900000)}`;

          await db.query(`
            INSERT INTO guides 
            (name, experience, rating, languages, specialties, price, contact, spot_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [gName, experience, rating, languages, specialties, price, contact, spotId]);
        }
        console.log(`[seeder] Generated ${guidesToInsert} guides for spot: ${name}`);
      }
    }

    console.log('[seeder] Database migration and seeding successfully completed!');
  } catch (err) {
    console.error('[seeder] Error during database seeding:', err.message);
  }
}

module.exports = seed;
