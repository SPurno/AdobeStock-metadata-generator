/**
 * Adobe Stock Category Mapper
 * 
 * Maps image analysis results to Adobe Stock categories.
 * Uses ImageNet classifications and scene detection to determine the best category.
 * 
 * Adobe Stock Categories (from contributor portal):
 * - Animals, Architecture, Backgrounds, Business, Drinks, Education
 * - Food, Graphic Resources, Hobbies and Leisure, Industrial
 * - Landscapes, Lifestyle, Nature, People, Plants and Flowers
 * - Science and Technology, Sports, Transportation, Travel
 */

const ADOBE_STOCK_CATEGORIES = [
  { id: "animals", label: "Animals", keywords: ["animal", "pet", "dog", "cat", "bird", "wildlife", "mammal", "fish", "horse", "elephant", "lion", "tiger", "bear", "zoo", "safari", "reptile", "insect"] },
  { id: "architecture", label: "Architecture", keywords: ["building", "architecture", "skyscraper", "bridge", "house", "cityscape", "skyline", "structure", "facade", "exterior", "modern architecture", "architectural", "construction", "historic building", "landmark"] },
  { id: "backgrounds", label: "Backgrounds/Textures", keywords: ["background", "texture", "pattern", "wallpaper", "abstract background", "bokeh", "backdrop", "surface", "grunge", "gradient"] },
  { id: "business", label: "Business", keywords: ["business", "corporate", "office", "meeting", "conference", "professional", "workplace", "career", "executive", "teamwork", "businessman", "businesswoman", "entrepreneur", "financial"] },
  { id: "drinks", label: "Drinks", keywords: ["drink", "beverage", "coffee", "tea", "wine", "beer", "juice", "cocktail", "water", "soda", "glass", "mug", "bottle", "alcohol", "refreshment"] },
  { id: "education", label: "Education", keywords: ["education", "school", "learning", "study", "classroom", "student", "teacher", "book", "library", "knowledge", "academic", "lesson", "training", "scholarship", "reading"] },
  { id: "food", label: "Food", keywords: ["food", "cuisine", "cooking", "meal", "dish", "fruit", "vegetable", "pizza", "salad", "dessert", "baking", "gourmet", "ingredient", "dining", "restaurant"] },
  { id: "graphic", label: "Graphic Resources", keywords: ["graphic", "illustration", "vector", "icon", "design element", "infographic", "logo", "typography", "symbol", "badge", "label", "ribbon", "frame", "border", "button"] },
  { id: "hobbies", label: "Hobbies and Leisure", keywords: ["hobby", "leisure", "craft", "gardening", "cooking", "reading", "gaming", "music", "art", "photography", "travel", "camping", "fishing", "painting", "knitting"] },
  { id: "industrial", label: "Industrial", keywords: ["industrial", "factory", "manufacturing", "warehouse", "machinery", "equipment", "worker", "construction site", "engineering", "production", "plant", "industry", "heavy machinery", "oil", "gas"] },
  { id: "landscapes", label: "Landscapes", keywords: ["landscape", "mountain", "ocean", "beach", "sunset", "sunrise", "valley", "forest", "field", "desert", "lake", "river", "waterfall", "countryside", "panorama", "scenery"] },
  { id: "lifestyle", label: "Lifestyle", keywords: ["lifestyle", "people", "family", "fitness", "health", "wellness", "fashion", "home", "travel", "leisure", "active", "modern lifestyle", "everyday life", "healthy living", "wellbeing"] },
  { id: "nature", label: "Nature", keywords: ["nature", "natural", "forest", "trees", "flowers", "plants", "garden", "outdoor", "environment", "ecology", "wilderness", "green", "organic", "season", "weather"] },
  { id: "people", label: "People", keywords: ["people", "person", "portrait", "man", "woman", "child", "family", "group", "friends", "couple", "senior", "youth", "adult", "multicultural", "diverse"] },
  { id: "plants", label: "Plants and Flowers", keywords: ["plant", "flower", "floral", "garden", "leaf", "botanical", "bloom", "nature", "petal", "herb", "succulent", "fern", "tropical plant", "rose", "tulip"] },
  { id: "science", label: "Science and Technology", keywords: ["science", "technology", "computer", "smartphone", "digital", "lab", "research", "innovation", "data", "medical", "scientist", "technology", "microscope", "experiment", "AI", "robot"] },
  { id: "sports", label: "Sports", keywords: ["sports", "fitness", "exercise", "running", "cycling", "swimming", "soccer", "basketball", "tennis", "yoga", "workout", "athlete", "training", "competition", "ball"] },
  { id: "transportation", label: "Transportation", keywords: ["car", "vehicle", "transportation", "airplane", "train", "bicycle", "truck", "bus", "boat", "ship", "motorcycle", "travel", "driving", "automobile", "traffic"] },
  { id: "travel", label: "Travel", keywords: ["travel", "tourism", "vacation", "adventure", "destination", "exploration", "journey", "holiday", "backpacking", "sightseeing", "traveler", "exotic", "culture", "trip", "tourist"] }
];

/**
 * Map ImageNet class names to Adobe Stock category
 * @param {Array} predictions - Array of {className, probability} objects from MobileNet
 * @returns {string} Category ID (e.g., "nature", "animals", "food")
 */
function predictCategory(predictions) {
  if (!predictions || predictions.length === 0) {
    return "landscapes"; // Default fallback
  }

  // Extract all class names from predictions
  const classNames = predictions.map(p => p.className ? p.className.toLowerCase() : '');
  const combinedText = classNames.join(' ');
  
  // Score each category based on keyword matches
  const scores = ADOBE_STOCK_CATEGORIES.map(category => {
    let score = 0;
    const words = combinedText.split(/[, ]+/).filter(w => w.length > 0);
    
    for (const word of words) {
      for (const kw of category.keywords) {
        if (word.includes(kw) || kw.includes(word)) {
          score += 1;
        }
      }
    }
    
    return { id: category.id, label: category.label, score };
  });
  
  // Sort by score and get the best match
  scores.sort((a, b) => b.score - a.score);
  
  // If best match has 0 score, use a smart default based on common ImageNet patterns
  if (scores[0].score === 0) {
    return detectCategoryFromFallback(classNames);
  }
  
  return scores[0].id;
}

/**
 * Fallback category detection using pattern matching on class names
 */
function detectCategoryFromFallback(classNames) {
  const combined = classNames.join(' ');
  
  // Animal detection
  const animalWords = ["dog", "cat", "bird", "fish", "horse", "lion", "tiger", "bear", 
    "elephant", "monkey", "rabbit", "duck", "chicken", "cow", "pig", "sheep",
    "whale", "dolphin", "shark", "snake", "lizard", "turtle", "butterfly", "insect",
    "canine", "feline", "mammal", "reptile", "amphibian", "rodent"];
  if (animalWords.some(w => combined.includes(w))) return "animals";
  
  // Food detection
  const foodWords = ["pizza", "burger", "sandwich", "soup", "salad", "cake", "pie",
    "bread", "rice", "pasta", "cheese", "chocolate", "fruit", "vegetable",
    "cooking", "baking", "grill", "kitchen", "food", "cuisine", "meal", "dinner"];
  if (foodWords.some(w => combined.includes(w))) return "food";
  
  // Building/architecture detection
  const buildingWords = ["building", "house", "skyscraper", "bridge", "castle",
    "church", "temple", "tower", "city", "urban", "architecture", "downtown",
    "village", "home", "apartment", "structure", "factory", "warehouse"];
  if (buildingWords.some(w => combined.includes(w))) return "architecture";
  
  // People detection
  const peopleWords = ["person", "people", "man", "woman", "child", "baby",
    "people", "crowd", "family", "portrait", "face", "human", "adult",
    "boy", "girl", "senior", "couple", "group", "person", "portrait", "model", "lifestyle"];
  if (peopleWords.some(w => combined.includes(w))) return "people";
  
  // Nature/landscape detection
  const natureWords = ["mountain", "ocean", "sea", "beach", "forest", "tree",
    "flower", "plant", "landscape", "river", "lake", "valley", "field",
    "snow", "ice", "desert", "waterfall", "sky", "cloud", "sunset",
    "sunrise", "nature", "outdoor", "scenic", "panorama", "golden hour", "water", "coastal", "seascape"];
  if (natureWords.some(w => combined.includes(w))) return "nature";
  
  // Technology detection
  const techWords = ["computer", "smartphone", "phone", "laptop", "tablet",
    "screen", "monitor", "keyboard", "robot", "electronic", "device",
    "technology", "digital", "tech", "circuit", "chip", "camera",
    "night", "dslr", "computer", "science"];
  if (techWords.some(w => combined.includes(w))) return "science";
  
  // Sports detection
  const sportsWords = ["ball", "sport", "game", "field", "court", "stadium",
    "player", "team", "running", "swimming", "bicycle", "bike", "tennis",
    "soccer", "football", "basketball", "baseball", "golf", "skiing"];
  if (sportsWords.some(w => combined.includes(w))) return "sports";
  
  // Vehicle/transportation detection
  const vehicleWords = ["car", "truck", "bus", "train", "airplane", "boat",
    "ship", "bicycle", "motorcycle", "vehicle", "transport", "traffic",
    "road", "highway", "automobile", "drive", "driving"];
  if (vehicleWords.some(w => combined.includes(w))) return "transportation";
  
  // Background/texture detection
  const bgWords = ["abstract", "pattern", "texture", "background", "bokeh",
    "wallpaper", "gradient", "marble", "wood", "fabric", "paper"];
  if (bgWords.some(w => combined.includes(w))) return "backgrounds";
  
  // Business detection
  const businessWords = ["office", "meeting", "conference", "business", "work",
    "desk", "computer", "document", "presentation", "chart", "graph"];
  if (businessWords.some(w => combined.includes(w))) return "business";
  
  // Default: map to nature as it's the most common stock photography category
  return "landscapes";
}

/**
 * Get the full list of Adobe Stock categories
 */
function getCategories() {
  return ADOBE_STOCK_CATEGORIES.map(c => ({ id: c.id, label: c.label }));
}

/**
 * Get category label from ID
 */
function getCategoryLabel(categoryId) {
  const cat = ADOBE_STOCK_CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.label : "Uncategorized";
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { predictCategory, getCategories, getCategoryLabel, ADOBE_STOCK_CATEGORIES };
}
