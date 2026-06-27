/**
 * Title Generator
 * 
 * Generates descriptive, SEO-friendly titles for Adobe Stock images and videos
 * based on ImageNet classification results and detected scene properties.
 * 
 * Adobe Stock title best practices:
 * - Brief and descriptive
 * - Accurately describe the content
 * - Avoid camera technical details
 * - Natural language
 */

/**
 * Title templates organized by scene type
 */
const TITLE_TEMPLATES = {
  landscape: [
    "Beautiful {adj} {scene} at {time}",
    "Scenic {adj} {scene} with {element}",
    "Panoramic view of {scene} during {time}",
    "{adj} {scene} landscape with {element}",
    "{scene} landscape, {time}, beautiful nature scenery",
    "A stunning view of {scene} featuring {element}",
    "{adj} {scene} scenery, perfect for background",
    "Dramatic {scene} scene with {element} at {time}"
  ],
  
  nature: [
    "{adj} {scene} in natural {setting}",
    "Beautiful {scene} surrounded by {element}",
    "{adj} nature scene of {scene}",
    "Close-up of {adj} {element} in a {scene}",
    "Natural beauty of {scene} with {element}",
    "{adj} {scene} detail, nature photography",
    "Peaceful view of {scene} in {setting}",
    "{adj} {scene} showcasing {element}"
  ],
  
  animal: [
    "{adj} {animal} in natural habitat",
    "Portrait of a {adj} {animal}",
    "Close-up of {adj} {animal} looking {mood}",
    "Beautiful {animal} resting in {setting}",
    "{adj} {animal} sitting in {setting}",
    "{animal} animal portrait, {adj} and {adj2}",
    "A {adj} {animal} enjoying the {time}",
    "{animal} wildlife photography, {adj} creature"
  ],
  
  food: [
    "{adj} {food} presentation on {setting}",
    "Delicious {food} with {element}",
    "Freshly prepared {food} in {setting}",
    "Close-up of {adj} {food} dish",
    "{adj} {food} served with {element}",
    "Gourmet {food} photography, {adj} cuisine",
    "Tasty {food} with fresh {element}",
    "{adj} {food} meal, ready to eat"
  ],

  people: [
    "{adj} {person} in {setting} during {time}",
    "Portrait of a {adj} {person} in {setting}",
    "A {adj} {person} enjoying {time}",
    "{adj} {person} with {element} in {setting}",
    "Happy {person} in {setting} looking {mood}",
    "Young {person} spending time in {setting}",
    "{adj} {person} posing in {setting}",
    "Lifestyle portrait of {adj} {person} in {setting}"
  ],

  architecture: [
    "{adj} architecture of {scene} at {time}",
    "Modern {scene} building with {element}",
    "{adj} {scene} exterior at {time}",
    "Architectural detail of {scene}, {adj} design",
    "Beautiful {scene} architecture in {setting}",
    "{adj} {scene} facade with {element}",
    "{scene} building, {adj} architectural photography",
    "Contemporary {scene} structure at {time}"
  ],

  urban: [
    "{adj} cityscape of {setting} at {time}",
    "Busy {setting} streets with {element}",
    "City {scene} showcasing {element}",
    "{adj} {setting} skyline at {time}",
    "Urban {scene} in {setting} during {time}",
    "Modern {setting} view with {element}",
    "{adj} city scene in {setting}",
    "Downtown {setting} streets, {adj} atmosphere"
  ],

  technology: [
    "{adj} {scene} with modern technology",
    "Close-up of {scene} in {setting}",
    "{adj} {scene} device on {setting}",
    "Modern {scene} technology in {setting}",
    "{scene} with {element}, technology concept",
    "{adj} {scene} displaying {element}",
    "Digital {scene} in {setting}",
    "Contemporary {scene} technology, {adj} design"
  ],

  general: [
    "Beautiful {adj} view of {scene}",
    "{adj} {scene} in natural {setting}",
    "Close-up of {adj} {element}",
    "{adj} {scene} with vibrant {element}",
    "{mood} {scene} photography at {time}",
    "A beautiful {scene} in {setting}",
    "{adj} {scene} detail, stock photography",
    "Creative view of {scene} with {element}"
  ],

  // === VIDEO-SPECIFIC TEMPLATES ===
  video_general: [
    "{adj} {scene} video footage at {time}",
    "Cinematic video of {adj} {scene} in {setting}",
    "Smooth motion video of {adj} {scene}",
    "{adj} {scene} video clip with {element}",
    "Stock video footage of {adj} {scene}",
    "Cinematic {adj} {scene} video at {time}",
    "Motion video of {adj} {scene} in {setting}",
    "Beautiful {adj} {scene} video, stock footage"
  ],
  
  video_nature: [
    "{adj} nature video of {scene} with {element}",
    "Cinematic {adj} {scene} nature footage",
    "Smooth motion video of {adj} {scene} landscape",
    "{adj} {scene} nature video, stock footage",
    "Beautiful {adj} {scene} in motion, nature video",
    "Aerial-style video of {adj} {scene}",
    "{scene} video footage, {adj} natural setting",
    "Peaceful {adj} {scene} video clip"
  ],
  
  video_urban: [
    "{adj} city video footage of {setting}",
    "Cinematic {adj} cityscape video clip",
    "Dynamic video of {adj} {setting} streets",
    "{adj} urban video footage at {time}",
    "Modern {setting} city video with {element}",
    "Motion video of {adj} {setting} skyline",
    "{adj} city life video, stock footage",
    "Smooth urban video of {adj} {scene}"
  ],
  
  video_action: [
    "Dynamic action video of {scene} in motion",
    "{adj} {scene} in action, video footage",
    "Active video of {adj} {scene} in {setting}",
    "Fast-paced video of {adj} {scene}",
    "{adj} {scene} movement video, stock clip",
    "Cinematic action video of {adj} {scene}"
  ]
};

/**
 * Adjectives for generating descriptive titles
 */
const ADJECTIVES = [
  "beautiful", "stunning", "serene", "peaceful", "majestic",
  "dramatic", "breathtaking", "picturesque", "gorgeous", "magnificent",
  "charming", "fascinating", "vibrant", "colorful", "bright",
  "calm", "tranquil", "warm", "golden", "soft",
  "moody", "atmospheric", "striking", "impressive", "spectacular",
  "natural", "authentic", "genuine", "fresh", "vivid",
  "elegant", "sophisticated", "clean", "minimal", "artistic",
  "dynamic", "energetic", "lively", "quiet", "gentle",
  "rich", "deep", "crisp", "clear", "exquisite"
];

// Video-specific adjectives
const VIDEO_ADJECTIVES = [
  "cinematic", "smooth", "dynamic", "flowing", "steady",
  "professional", "high-quality", "fluid", "slow-motion", "aerial",
  "tracking", "panning", "timelapse", "hyperlapse", "handheld",
  "gimbal-stabilized", "dolly", "static", "moving", "creative"
];

/**
 * Mood words for titles
 */
const MOODS = [
  "peaceful", "serene", "calm", "tranquil", "happy",
  "joyful", "contemplative", "thoughtful", "relaxed", "content",
  "vibrant", "lively", "energetic", "dynamic", "dramatic",
  "reflective", "quiet", "gentle", "warm", "bright"
];

/**
 * Time of day descriptions
 */
const TIME_DESCRIPTIONS = [
  "sunrise", "sunset", "golden hour", "morning", "afternoon",
  "evening", "dusk", "twilight", "night", "daytime",
  "midday", "dawn", "late afternoon", "early morning", "blue hour"
];

/**
 * Elements commonly found in stock photography
 */
const ELEMENTS = [
  "natural light", "soft shadows", "clear sky", "warm colors",
  "vibrant colors", "rich details", "natural textures", "soft focus",
  "beautiful composition", "striking contrast", "gentle breeze",
  "natural beauty", "golden light", "tranquil atmosphere", "clean lines"
];

/**
 * Generate a title from predictions and analysis
 * @param {Array} predictions - ImageNet predictions
 * @param {string} category - Detected category
 * @param {Object} sceneData - Additional scene data (includes isVideo flag)
 * @returns {string} Generated title
 */
function generateTitle(predictions, category, sceneData = {}) {
  // Extract main subject from predictions
  const topPrediction = predictions && predictions.length > 0 
    ? predictions[0].className.toLowerCase() 
    : "scene";
  
  const secondPrediction = predictions && predictions.length > 1
    ? predictions[1].className.toLowerCase()
    : "";
  
  // Check if it's a video asset
  const isVideo = sceneData && sceneData.isVideo;
  
  // Determine the template category
  let templateCategory = isVideo ? "video_general" : "general";
  const allNames = predictions ? predictions.map(p => p.className.toLowerCase()).join(' ') : '';
  
  // Detect scene type from class names
  const animalWords = ["dog", "cat", "bird", "fish", "horse", "lion", "tiger", "elephant", "bear", "monkey", "rabbit", "duck", "cow", "pig", "sheep", "whale", "dolphin", "snake", "turtle", "butterfly"];
  const foodWords = ["pizza", "burger", "sandwich", "soup", "salad", "cake", "pie", "bread", "rice", "pasta", "cheese", "chocolate", "fruit", "vegetable", "food", "cuisine", "meal"];
  const landscapeWords = ["mountain", "ocean", "sea", "beach", "valley", "field", "desert", "lake", "river", "waterfall", "landscape", "panorama", "horizon"];
  const natureWords = ["forest", "tree", "flower", "plant", "garden", "nature", "woodland", "leaf", "bloom", "wildflower"];
  const peopleWords = ["person", "people", "man", "woman", "child", "baby", "portrait", "face", "human", "family", "crowd", "adult", "boy", "girl"];
  const archWords = ["building", "house", "skyscraper", "bridge", "castle", "church", "temple", "tower", "architecture", "facade"];
  const urbanWords = ["city", "street", "downtown", "urban", "skyline", "traffic", "sidewalk"];
  const techWords = ["computer", "smartphone", "phone", "laptop", "tablet", "screen", "robot", "electronic", "device", "technology", "digital"];
  
  if (animalWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_general" : "animal";
  } else if (foodWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_general" : "food";
  } else if (landscapeWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_nature" : "landscape";
  } else if (natureWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_nature" : "nature";
  } else if (peopleWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_general" : "people";
  } else if (archWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_urban" : "architecture";
  } else if (urbanWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_urban" : "urban";
  } else if (techWords.some(w => allNames.includes(w))) {
    templateCategory = isVideo ? "video_general" : "technology";
  } else if (category) {
    // Map Adobe Stock category to template category
    const categoryMap = {
      "animals": isVideo ? "video_general" : "animal",
      "food": isVideo ? "video_general" : "food",
      "landscapes": isVideo ? "video_nature" : "landscape",
      "nature": isVideo ? "video_nature" : "nature",
      "people": isVideo ? "video_general" : "people",
      "architecture": isVideo ? "video_urban" : "architecture",
      "travel": isVideo ? "video_nature" : "landscape",
      "transportation": isVideo ? "video_general" : "general",
      "technology": isVideo ? "video_general" : "technology"
    };
    templateCategory = categoryMap[category] || (isVideo ? "video_general" : "general");
  }
  
  // Get templates for this category
  const templates = TITLE_TEMPLATES[templateCategory] || TITLE_TEMPLATES.general;
  
  // Select a template - use the subject to pick a good one
  const templateIndex = Math.abs(hashCode(topPrediction)) % templates.length;
  let template = templates[templateIndex];
  
  // Build replacement values - use video-specific adjectives for videos
  const adjSource = isVideo ? [...ADJECTIVES, ...VIDEO_ADJECTIVES] : ADJECTIVES;
  const adj = adjSource[Math.abs(hashCode(topPrediction + "adj")) % adjSource.length];
  const adj2 = adjSource[Math.abs(hashCode(topPrediction + "adj2")) % adjSource.length];
  const mood = MOODS[Math.abs(hashCode(topPrediction + "mood")) % MOODS.length];
  const time = TIME_DESCRIPTIONS[Math.abs(hashCode(topPrediction + "time")) % TIME_DESCRIPTIONS.length];
  const element = ELEMENTS[Math.abs(hashCode(topPrediction + "element")) % ELEMENTS.length];
  
  // Extract the main subject, removing numbers and common prefixes
  let mainSubject = topPrediction
    .replace(/\d+/g, '')
    .replace(/^[,\s]+/, '')
    .trim();
  
  // Use the most descriptive part of the class name
  const parts = mainSubject.split(/[,]/);
  mainSubject = (parts[0] || topPrediction).trim();
  
  const secondSubject = secondPrediction && secondPrediction !== topPrediction
    ? secondPrediction.split(/[,]/)[0].trim()
    : "";
  
  // Determine scene/setting from context
  const scene = mainSubject;
  const animal = mainSubject;
  const food = mainSubject;
  const person = mainSubject;
  const setting = getSettingFromCategory(category);
  
  // Fill the template
  const replacements = {
    adj: adj,
    adj2: adj2,
    scene: scene,
    animal: animal,
    food: food,
    person: person,
    element: element || (secondSubject || "natural details"),
    mood: mood,
    time: time,
    setting: setting
  };
  
  let title = template;
  for (const [key, value] of Object.entries(replacements)) {
    title = title.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);
  
  // Remove any remaining template placeholders
  title = title.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
  
  // Ensure title isn't too long (Adobe Stock prefers concise titles)
  if (title.length > 80) {
    title = title.substring(0, 77).trim() + '...';
  }
  
  return title;
}

/**
 * Simple string hash function
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get setting description from category
 */
function getSettingFromCategory(category) {
  const settings = {
    "animals": "natural habitat",
    "architecture": "urban environment",
    "landscapes": "natural landscape",
    "nature": "wilderness",
    "people": "natural setting",
    "food": "table setting",
    "travel": "travel destination",
    "business": "office environment",
    "sports": "sports venue",
    "technology": "modern workspace",
    "lifestyle": "everyday setting"
  };
  return settings[category] || "beautiful setting";
}

/**
 * Generate multiple title options
 */
function generateTitleOptions(predictions, category, count = 3) {
  const titles = [];
  for (let i = 0; i < count; i++) {
    titles.push(generateTitle(predictions, category, { variation: i }));
  }
  // Remove duplicates and return
  return [...new Set(titles)].slice(0, count);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateTitle, generateTitleOptions };
}
