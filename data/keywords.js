/**
 * Adobe Stock Keyword Database
 * 
 * Maps ImageNet class labels and general concepts to Adobe Stock keywords.
 * Each entry provides highly relevant keywords for stock photography.
 * 
 * Adobe Stock allows up to 50 keywords per asset.
 * We generate 47 keywords as requested.
 */

// Common high-frequency keywords for stock photography
const COMMON_KEYWORDS = [
  "stock photo", "photography", "image", "picture", "visual",
  "digital image", "royalty-free", "stock image", "photograph", "shot"
];

// Video-specific keywords for video assets on Adobe Stock
const VIDEO_KEYWORDS = [
  "video", "footage", "motion", "moving image", "video clip",
  "motion video", "stock footage", "cinematic", "video footage", "motion picture",
  "video production", "clip", "moving footage", "video content", "4K video",
  "HD video", "video asset", "motion content", "video recording", "digital video"
];

// Keywords by general scene type
const SCENE_KEYWORDS = {
  outdoor: [
    "outdoor", "outside", "open air", "daylight", "sunlight",
    "natural light", "exterior", "nature scene", "landscape", "scenic"
  ],
  indoor: [
    "indoor", "inside", "interior", "room", "building interior",
    "artificial light", "indoor scene", "home", "office", "indoor setting"
  ],
  nature: [
    "nature", "natural", "wild", "organic", "green",
    "environment", "ecology", "conservation", "natural world", "wilderness"
  ],
  urban: [
    "urban", "city", "metropolitan", "downtown", "street",
    "cityscape", "skyline", "architecture", "buildings", "city life"
  ],
  studio: [
    "studio", "studio shot", "controlled lighting", "backdrop", "indoor studio",
    "professional", "clean background", "isolated", "product shot", "studio photography"
  ],
  abstract: [
    "abstract", "artistic", "creative", "contemporary", "modern art",
    "design element", "pattern", "texture", "graphic", "conceptual"
  ]
};

// ImageNet class ID to Adobe Stock keyword mappings
// Organized by category
const IMAGENET_KEYWORDS = {
  // === DOGS ===
  "golden retriever": ["dog", "canine", "golden retriever", "pet", "animal",
    "domestic dog", "retriever", "friendly", "loyal", "companion",
    "golden", "retriever dog", "dog breed", "canine pet", "four-legged",
    "mammal", "animal portrait", "dog portrait", "faithful", "puppy"],
  
  "Labrador retriever": ["dog", "Labrador", "Labrador retriever", "pet", "animal",
    "domestic dog", "retriever", "friendly", "active", "companion",
    "Lab", "dog breed", "canine pet", "four-legged", "energetic",
    "mammal", "animal portrait", "dog portrait", "working dog", "puppy"],
  
  "German shepherd": ["dog", "German shepherd", "shepherd dog", "pet", "animal",
    "domestic dog", "working dog", "intelligent", "protective", "companion",
    "German shepherd dog", "dog breed", "canine pet", "four-legged", "loyal",
    "mammal", "animal portrait", "dog portrait", "service dog", "police dog"],
  
  "dog": ["dog", "canine", "pet", "animal", "domestic dog",
    "four-legged", "mammal", "companion animal", "dog portrait", "friendly",
    "loyal", "canine pet", "animal portrait", "faithful", "domestic animal",
    "mammal pet", "pet dog", "cute animal", "animal lover", "dog breed"],

  // === CATS ===
  "cat": ["cat", "feline", "pet", "animal", "domestic cat",
    "four-legged", "mammal", "companion animal", "cat portrait", "elegant",
    "graceful", "feline pet", "animal portrait", "independent", "domestic animal",
    "mammal pet", "pet cat", "cute animal", "whiskers", "cat breed"],

  "tabby cat": ["cat", "tabby", "tabby cat", "pet", "feline",
    "striped cat", "domestic cat", "mammal", "cat portrait", "four-legged",
    "companion animal", "feline pet", "animal portrait", "orange cat", "gray cat",
    "mammal pet", "pet cat", "cute animal", "indoor cat", "cat breed"],

  // === BIRDS ===
  "bird": ["bird", "avian", "wildlife", "feathers", "winged",
    "animal", "flying", "wild bird", "nature", "beak",
    "colorful", "feathered", "bird watching", "ornithology", "wild animal",
    "avian wildlife", "perched", "birds", "small bird", "wildlife photography"],

  // === LANDSCAPES & NATURE ===
  "mountain": ["mountain", "mountains", "mountain range", "peak", "summit",
    "landscape", "scenic", "nature", "alpine", "snow-capped",
    "mountain view", "high altitude", "mountain landscape", "rugged", "wilderness",
    "grandiose", "natural landscape", "outdoor scenery", "mountain peak", "elevation"],

  "valley": ["valley", "valley view", "mountain valley", "landscape", "scenic",
    "nature", "rural", "countryside", "panorama", "green valley",
    "rolling hills", "valley landscape", "natural", "wide view", "outdoor",
    "vista", "scenic view", "landscape view", "pastoral", "beautiful landscape"],

  "ocean": ["ocean", "sea", "water", "coastal", "marine",
    "waves", "beach", "coast", "seascape", "blue water",
    "ocean view", "sea waves", "body of water", "nautical", "horizon",
    "deep blue", "ocean scenery", "water surface", "marine view", "seaside"],

  "beach": ["beach", "coast", "shore", "seaside", "sand",
    "ocean", "coastal", "waves", "summer", "tropical",
    "beach view", "seashore", "vacation", "coastline", "waterfront",
    "sandy beach", "sunny", "beach scenery", "leisure", "seaside resort"],

  "forest": ["forest", "woods", "trees", "nature", "woodland",
    "green", "wilderness", "natural", "foliage", "canopy",
    "forest path", "biodiversity", "forest landscape", "tall trees", "shade",
    "outdoor", "forest scene", "lush", "vegetation", "wooded area"],

  "sunset": ["sunset", "sunrise", "dusk", "twilight", "evening",
    "golden hour", "sky", "colorful sky", "sun", "horizon",
    "dramatic sky", "orange sky", "sunset view", "evening sky", "beautiful sunset",
    "natural phenomenon", "warm colors", "sun rays", "atmosphere", "serene"],

  "lake": ["lake", "water", "lake view", "reflection", "still water",
    "nature", "landscape", "scenic", "waterfront", "calm water",
    "mountain lake", "lake scenery", "peaceful", "outdoor", "tranquil",
    "water surface", "blue water", "lake landscape", "reflection in water", "serene"],

  "river": ["river", "water", "river view", "stream", "flowing water",
    "nature", "landscape", "creek", "waterway", "riverbank",
    "scenic", "river landscape", "flowing", "outdoor", "watercourse",
    "natural", "river scene", "fresh water", "peaceful", "nature scene"],

  "desert": ["desert", "arid", "sand", "dunes", "dry",
    "landscape", "barren", "hot", "wilderness", "sandy",
    "desert landscape", "arid climate", "sand dunes", "scarce vegetation", "remote",
    "expanse", "dry landscape", "desert scenery", "extreme environment", "sunny"],

  "waterfall": ["waterfall", "cascade", "falling water", "water", "nature",
    "scenic", "mist", "water flow", "natural wonder", "landscape",
    "waterfall view", "rushing water", "forest waterfall", "beautiful", "tropical",
    "natural phenomenon", "spray", "water feature", "outdoor", "rocky"],

  "field": ["field", "meadow", "grassland", "pasture", "rural",
    "green", "countryside", "open field", "agricultural", "farmland",
    "grassy field", "rural landscape", "nature", "outdoor", "wide open",
    "rolling field", "wildflowers", "prairie", "country landscape", "pastoral"],

  "flower": ["flower", "floral", "bloom", "blossom", "petals",
    "nature", "plant", "garden", "botanical", "colorful",
    "wildflower", "flowering plant", "stamen", "floral photography", "close-up",
    "beautiful flower", "spring", "botany", "flora", "macro photography"],

  "trees": ["trees", "forest", "woodland", "nature", "foliage",
    "green", "trunks", "branches", "leaves", "canopy",
    "tall trees", "wooded", "natural", "outdoor", "shade",
    "tree line", "vegetation", "forest scene", "woods", "timber"],

  // === URBAN & ARCHITECTURE ===
  "skyscraper": ["skyscraper", "building", "architecture", "city", "urban",
    "high-rise", "modern architecture", "cityscape", "downtown", "skyscrapers",
    "tall building", "glass building", "corporate", "metropolitan", "city skyline",
    "architectural", "urban landscape", "city view", "commercial building", "steel and glass"],

  "cityscape": ["cityscape", "city", "skyline", "urban", "metropolitan",
    "city view", "downtown", "buildings", "city panorama", "skyline view",
    "city scene", "urban landscape", "modern city", "city center", "metropolis",
    "architecture", "city horizon", "cityscape view", "urban scenery", "city life"],

  "house": ["house", "home", "residential", "building", "real estate",
    "house exterior", "suburban", "home exterior", "property", "architecture",
    "family home", "house front", "dwelling", "suburb", "neighborhood",
    "residential building", "modern house", "traditional house", "housing", "domestic"],

  "bridge": ["bridge", "architecture", "structure", "crossing", "infrastructure",
    "suspension bridge", "river crossing", "engineering", "transportation", "span",
    "bridge structure", "steel bridge", "cable-stayed", "landmark", "pedestrian bridge",
    "road bridge", "arch bridge", "concrete bridge", "bridge over water", "city bridge"],

  // === PEOPLE ===
  "person": ["person", "people", "human", "individual", "adult",
    "man", "woman", "portrait", "lifestyle", "human interest",
    "person standing", "person posing", "human being", "real people", "model",
    "photography", "portrait photography", "adult", "casual", "genuine"],

  "people": ["people", "group", "crowd", "humans", "social",
    "together", "community", "gathering", "friends", "team",
    "people group", "interaction", "social gathering", "diverse", "crowded",
    "group of people", "public", "event", "conference", "audience"],

  "family": ["family", "parents", "children", "together", "home",
    "family bonding", "parenting", "childhood", "domestic life", "loving",
    "family time", "family together", "happy family", "mother father child", "nurturing",
    "family relationship", "care", "family portrait", "family lifestyle", "quality time"],

  // === FOOD & DRINK ===
  "food": ["food", "cuisine", "meal", "culinary", "dish",
    "delicious", "cooking", "gourmet", "dining", "eating",
    "fresh food", "food photography", "plate", "ingredients", "nutrition",
    "healthy food", "foodie", "gastronomy", "meal time", "tasty"],

  "pizza": ["pizza", "food", "Italian cuisine", "cheese", "tomato",
    "pizza slice", "baked", "fast food", "meal", "gourmet pizza",
    "dough", "mozzarella", "pizza toppings", "restaurant food", "delicious",
    "food photography", "cuisine", "Italian food", "takeout", "baking"],

  "fruit": ["fruit", "fresh", "healthy", "organic", "vitamins",
    "produce", "nutrition", "natural food", "colorful", "fresh fruit",
    "ripe", "delicious", "food", "healthy eating", "harvest",
    "fruit bowl", "tropical fruit", "berries", "juicy", "fresh produce"],

  "vegetables": ["vegetables", "fresh", "healthy", "organic", "produce",
    "cooking", "nutrition", "natural food", "vegetarian", "fresh vegetables",
    "farm fresh", "green vegetables", "healthy eating", "food", "vegan",
    "harvest", "raw vegetables", "grocery", "ingredients", "colorful vegetables"],

  "coffee": ["coffee", "beverage", "hot drink", "caffeine", "morning",
    "coffee cup", "espresso", "brew", "coffee beans", "mug",
    "coffee shop", "cafe", "drink", "hot beverage", "coffee break",
    "aroma", "coffee time", "relaxation", "warm drink", "caffeine fix"],

  // === TRANSPORTATION ===
  "car": ["car", "automobile", "vehicle", "transportation", "auto",
    "sedan", "motor vehicle", "driving", "road", "automotive",
    "luxury car", "modern car", "car exterior", "passenger car", "vehicle design",
    "sports car", "electric car", "car model", "transport", "car photography"],

  "bicycle": ["bicycle", "bike", "cycling", "transportation", "sports",
    "exercise", "outdoor", "recreation", "cyclist", "bicycle riding",
    "bike ride", "two-wheeler", "eco-friendly", "fitness", "active lifestyle",
    "bicycle transportation", "urban cycling", "sport", "leisure activity", "pedal"],

  "airplane": ["airplane", "aircraft", "aviation", "flight", "air travel",
    "jet", "airliner", "airplane wing", "transportation", "travel",
    "aviation photography", "airplane exterior", "flying", "commercial aviation", "airport",
    "jet aircraft", "passenger plane", "air transport", "aeroplane", "airline"],

  "train": ["train", "railway", "locomotive", "rail", "transportation",
    "railroad", "passenger train", "rail transport", "train track", "travel",
    "commuter train", "high-speed train", "train station", "railway line", "public transport",
    "locomotive engine", "cargo train", "train travel", "railroad track", "transport"],

  // === TECHNOLOGY ===
  "computer": ["computer", "technology", "digital", "electronics", "laptop",
    "computing", "PC", "desktop", "workstation", "monitor",
    "technology device", "computer screen", "keyboard", "modern technology", "digital device",
    "information technology", "tech", "electronic device", "computing device", "IT"],

  "smartphone": ["smartphone", "mobile phone", "cell phone", "technology", "communication",
    "mobile device", "smartphone screen", "digital", "touch screen", "handheld",
    "mobile technology", "phone", "modern technology", "wireless", "gadget",
    "smart phone", "mobile communication", "tech device", "smart device", "portable"],

  // === NATURE / SCENERY GENERAL ===
  "landscape": ["landscape", "scenery", "panorama", "view", "vista",
    "natural landscape", "scenic view", "wide view", "landscape photography", "outdoor view",
    "countryside", "beautiful view", "nature view", "scenic landscape", "horizon",
    "breathtaking view", "landscape scene", "majestic", "picturesque", "natural beauty"],

  "sky": ["sky", "clouds", "atmosphere", "weather", "heavens",
    "blue sky", "cloudy sky", "sky view", "cloudscape", "sky background",
    "dramatic sky", "sun", "sky above", "cloud formation", "clear sky",
    "sky texture", "aerial", "firmament", "horizon", "overhead"],

  "clouds": ["clouds", "sky", "cloudscape", "weather", "atmosphere",
    "white clouds", "fluffy clouds", "sky view", "cloudy", "cloud formation",
    "dramatic clouds", "cumulus", "overcast", "cloudy sky", "sky scene",
    "cloud pattern", "cloud background", "nature", "storm clouds", "blue sky"],

  "snow": ["snow", "winter", "snowy", "cold", "snowfall",
    "snow-covered", "white snow", "winter landscape", "snow scene", "frozen",
    "snowy landscape", "ice", "snowflakes", "winter scenery", "blizzard",
    "snowy day", "powder snow", "winter wonderland", "fresh snow", "snowy ground"],

  "rain": ["rain", "rainy", "rainfall", "weather", "water drops",
    "rain shower", "umbrella", "rainy day", "rain drops", "precipitation",
    "wet", "rain drop", "storm", "rain water", "puddle",
    "rain weather", "raindrops", "wet surface", "rainy weather", "shower"],

  // === ANIMALS (general) ===
  "horse": ["horse", "equine", "animal", "mammal", "riding",
    "stallion", "mare", "horseback", "equestrian", "pasture",
    "horse portrait", "domestic animal", "farm animal", "four-legged", "graceful",
    "horse riding", "animal photography", "horse running", "wild horse", "horse breed"],

  "elephant": ["elephant", "wildlife", "animal", "mammal", "safari",
    "elephant portrait", "large animal", "endangered species", "wild animal", "tusks",
    "african elephant", "asian elephant", "exotic animal", "wildlife photography", "herbivore",
    "protected species", "nature", "exotic wildlife", "trunk", "wild mammal"],

  "fish": ["fish", "aquatic", "underwater", "marine life", "ocean",
    "sea life", "tropical fish", "aquarium", "water animal", "colorful fish",
    "swimming", "sea creature", "water", "marine", "coral reef",
    "wildlife", "aquatic animal", "pet fish", "underwater photography", "school of fish"],

  // === SPORTS ===
  "sports": ["sports", "athletic", "fitness", "exercise", "active",
    "sporting", "competition", "game", "physical activity", "workout",
    "sports equipment", "sports field", "athlete", "training", "sport activity",
    "professional sports", "sports event", "team sports", "recreation", "sports photography"],

  "running": ["running", "runner", "jogging", "athletic", "fitness",
    "exercise", "marathon", "sprint", "active lifestyle", "track",
    "running person", "outdoor exercise", "sports", "fitness activity", "cardio",
    "running race", "health", "wellness", "running track", "physical fitness"],

  // === BUSINESS & WORK ===
  "business": ["business", "corporate", "professional", "office", "work",
    "career", "business people", "meeting", "conference", "workplace",
    "businessman", "businesswoman", "business environment", "executive", "corporate world",
    "busines meeting", "office work", "professional setting", "teamwork", "business concept"],

  "office": ["office", "workplace", "work", "corporate", "professional",
    "office interior", "cubicle", "desk", "modern office", "workspace",
    "office building", "office workers", "business environment", "open office", "work station",
    "commercial", "office space", "coworking", "professional environment", "office setting"],

  // === HEALTH & WELLNESS ===
  "medical": ["medical", "health", "healthcare", "hospital", "doctor",
    "medicine", "clinical", "medical professional", "patient", "treatment",
    "health care", "medical equipment", "laboratory", "surgery", "diagnosis",
    "hospital room", "medical staff", "healthcare professional", "medical science", "pharmacy"],

  "fitness": ["fitness", "exercise", "workout", "health", "gym",
    "physical fitness", "training", "active lifestyle", "strength", "exercise routine",
    "fitness equipment", "healthy lifestyle", "wellness", "body building", "cardio",
    "gym workout", "fitness motivation", "sport", "health and fitness", "personal training"],

  // === EDUCATION ===
  "education": ["education", "learning", "school", "study", "knowledge",
    "academic", "classroom", "student", "teaching", "educational",
    "learn", "training", "school supplies", "lesson", "teacher",
    "education concept", "library", "reading", "studying", "educational environment"],

  "book": ["book", "reading", "literature", "knowledge", "education",
    "library", "paperback", "hardcover", "book cover", "story",
    "bookshelf", "textbook", "reading book", "learning", "study",
    "education", "pages", "book collection", "literary", "reading material"],

  // === TRAVEL ===
  "travel": ["travel", "tourism", "vacation", "holiday", "destination",
    "adventure", "exploration", "journey", "trip", "tourism industry",
    "traveler", "touring", "travel photography", "sightseeing", "tourist",
    "vacation travel", "travel concept", "exploring", "world travel", "getaway"],

  "luggage": ["luggage", "suitcase", "travel", "baggage", "suitcases",
    "travel bag", "vacation", "bag", "luggage set", "travel accessory",
    "packing", "travel luggage", "baggage claim", "carry-on", "travel gear",
    "suitcase bag", "travel equipment", "tourism", "suitcase travel", "baggage luggage"],

  // === WATER ACTIVITIES ===
  "swimming": ["swimming", "swim", "pool", "water sport", "diving",
    "swimmer", "swimming pool", "water activity", "recreation", "summer activity",
    "swim pool", "sports", "lap swimming", "water recreation", "aquatic sport",
    "pool swimming", "fitness swimming", "water", "exercise", "outdoor pool"],

  // === HOLIDAYS ===
  "Christmas": ["Christmas", "holiday", "Christmas tree", "celebration", "festive",
    "winter holiday", "decorations", "ornaments", "Santa Claus", "Christmas decoration",
    "holiday season", "Christmas celebration", "festive season", "Christmas lights", "New Year",
    "Christmas holiday", "Christmas Eve", "winter celebration", "holiday spirit", "Christmas joy"],

  // === MUSIC ===
  "musical instrument": ["music", "musical instrument", "musician", "instrument", "melody",
    "guitar", "piano", "violin", "drum", "musical performance",
    "music concept", "playing instrument", "orchestra", "band", "music making",
    "classical music", "music education", "performance", "concert", "musical equipment"],

  // === FASHION ===
  "fashion": ["fashion", "style", "clothing", "apparel", "fashionable",
    "trend", "designer", "model", "fashion photography", "elegant",
    "fashionable clothing", "wardrobe", "fashion industry", "style concept", "trendy",
    "fashion model", "haute couture", "fashion design", "luxury fashion", "dressed"],

  // === HOME & INTERIOR ===
  "interior": ["interior", "room", "interior design", "home decor", "furniture",
    "living room", "bedroom", "kitchen", "modern interior", "house interior",
    "interior decoration", "home interior", "designer interior", "decor", "indoor space",
    "interior architecture", "decorated room", "home design", "interior styling", "elegant interior"],

  // === MACRO/CLOSEUP ===
  "macro": ["macro", "close-up", "close up", "detail shot", "extreme close-up",
    "macro photography", "detailed view", "tight shot", "macro shot", "small detail",
    "close-up view", "magnified", "macro detail", "texture detail", "close-up photography",
    "macro lens", "closeup", "fine detail", "intricate", "macro image"],

  // === SUNRISE/MORNING ===
  "sunrise": ["sunrise", "dawn", "morning", "daybreak", "early morning",
    "golden hour", "sunrise sky", "morning light", "new day", "first light",
    "sunrise view", "dawn sky", "morning sun", "beautiful sunrise", "sunrise over landscape",
    "awakening", "start of day", "sun rays", "horizon sunrise", "sunrise colors"]
};

// Fallback keywords when ImageNet labels don't have a direct mapping
const FALLBACK_KEYWORDS_BY_CATEGORY = {
  "Animals": ["animal", "wildlife", "mammal", "nature", "fauna",
    "animal photography", "living creature", "wild", "natural habitat", "animal portrait",
    "creature", "wild animal", "life", "zoology", "animal species",
    "multi-colored", "fine art", "animal world", "organic life", "wildlife photography"],
  
  "Architecture": ["architecture", "building", "structure", "design", "architectural",
    "construction", "facade", "modern design", "architectural detail", "exterior",
    "built environment", "architectural photography", "man-made structure", "architectural design", "urban design",
    "building design", "architectural style", "geometric", "structural design", "architectural element"],
  
  "Business": ["business", "corporate", "professional", "commerce", "enterprise",
    "office", "work", "career", "industry", "management",
    "corporate environment", "business concept", "financial", "entrepreneurship", "company",
    "business world", "corporate culture", "professionalism", "organization", "trade"],
  
  "Food": ["food", "cuisine", "culinary", "gastronomy", "cooking",
    "delicious", "meal", "dining", "gourmet", "recipe",
    "food photography", "dish", "ingredients", "nutrition", "tasty",
    "fresh food", "gastronomic", "food culture", "cuisine photography", "eating"],
  
  "Nature": ["nature", "natural", "environment", "organic", "wildlife",
    "landscape", "outdoor", "scenery", "ecology", "conservation",
    "natural world", "biodiversity", "natural environment", "nature photography", "flora and fauna",
    "pristine", "natural beauty", "earth", "outdoor scene", "nature scene"],
  
  "People": ["people", "person", "human", "portrait", "lifestyle",
    "individual", "adult", "man", "woman", "human interest",
    "personality", "expression", "real people", "human being", "candid",
    "people photography", "portrait photography", "character", "genuine person", "authentic"],
  
  "Technology": ["technology", "digital", "innovation", "modern", "electronic",
    "tech", "device", "future", "digital technology", "innovation concept",
    "technological", "cutting-edge", "information technology", "science and technology", "high tech",
    "modern technology", "computer technology", "advanced", "digital world", "tech concept"],
  
  "Travel": ["travel", "tourism", "vacation", "journey", "destination",
    "adventure", "exploration", "holiday", "trip", "wanderlust",
    "traveler", "tourist", "exploring", "travel concept", "sightseeing",
    "travel photography", "vacation travel", "world travel", "getaway", "exploration concept"],
  
  "Backgrounds": ["background", "texture", "pattern", "design element", "abstract",
    "wallpaper", "backdrop", "surface", "canvas", "digital background",
    "background texture", "background pattern", "background design", "decorative background", "background image",
    "textured background", "abstract background", "pattern background", "colorful background", "bokeh background"],
  
  "Sports": ["sports", "athletic", "fitness", "exercise", "active",
    "game", "competition", "training", "physical activity", "sport",
    "sports concept", "workout", "team sport", "individual sport", "sports activity",
    "recreation", "sports event", "athlete", "sports enthusiast", "sports action"]
};

/**
 * Get keywords for a given set of ImageNet predictions.
 * @param {Array} predictions - Array of {className, probability} objects
 * @param {string} category - Detected category
 * @returns {Array} Array of up to 47 keyword strings
 */
function getKeywordsFromPredictions(predictions, category) {
  const keywordSet = new Set();
  
  // Add keywords from specific ImageNet match
  if (predictions && predictions.length > 0) {
    for (const pred of predictions) {
      const className = pred.className ? pred.className.toLowerCase() : '';
      
      // Try exact match
      if (IMAGENET_KEYWORDS[className]) {
        IMAGENET_KEYWORDS[className].forEach(k => keywordSet.add(k));
      }
      
      // Try partial matches for multi-word class names
      const words = className.split(/[, ]+/).filter(w => w.length > 3);
      for (const word of words) {
        if (IMAGENET_KEYWORDS[word]) {
          IMAGENET_KEYWORDS[word].slice(0, 8).forEach(k => keywordSet.add(k));
        }
      }
    }
  }
  
  // Add category-specific keywords
  if (category && FALLBACK_KEYWORDS_BY_CATEGORY[category]) {
    FALLBACK_KEYWORDS_BY_CATEGORY[category].forEach(k => keywordSet.add(k));
  }
  
  // Add common stock keywords
  COMMON_KEYWORDS.forEach(k => keywordSet.add(k));
  
  // Add video-specific keywords when appropriate
  // Currently always added since we can analyze both images and videos
  VIDEO_KEYWORDS.slice(0, 10).forEach(k => keywordSet.add(k));
  
  // Convert to array, limit to 47, and clean up
  const keywords = Array.from(keywordSet)
    .map(k => k.trim())
    .filter(k => k.length > 0)
    .filter((k, i, arr) => arr.indexOf(k) === i); // Remove duplicates
  
  // Ensure we have enough keywords by adding generic ones
  if (keywords.length < 10) {
    const generics = [
      "digital", "professional", "high quality", "stock image", "royalty free",
      "commercial use", "creative", "modern", "contemporary", "artistic"
    ];
    generics.forEach(k => {
      if (!keywords.includes(k)) keywords.push(k);
    });
  }
  
  return keywords.slice(0, 47);
}

/**
 * Get keywords based on detected scene type
 */
function getKeywordsForScene(sceneType) {
  const keywords = [...COMMON_KEYWORDS];
  
  if (SCENE_KEYWORDS[sceneType]) {
    SCENE_KEYWORDS[sceneType].forEach(k => {
      if (!keywords.includes(k)) keywords.push(k);
    });
  }
  
  return keywords.slice(0, 47);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IMAGENET_KEYWORDS,
    FALLBACK_KEYWORDS_BY_CATEGORY,
    SCENE_KEYWORDS,
    COMMON_KEYWORDS,
    getKeywordsFromPredictions,
    getKeywordsForScene
  };
}
