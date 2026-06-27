# Adobe Stock Metadata Generator

A Firefox add-on that uses AI-powered client-side image analysis to automatically generate metadata for Adobe Stock contributor uploads.

## Features

- **🔍 Visual Analysis** - Analyzes images using TensorFlow.js + MobileNet to identify objects, scenes, colors, and lighting
- **📝 Auto Title Generation** - Generates descriptive, SEO-friendly titles based on image content
- **🏷️ Category Selection** - Automatically selects the best Adobe Stock category for your image
- **🔑 Keyword Generation** - Generates up to 47 relevant keywords (Adobe Stock maximum compatible)
- **☑️ Bulk Selection** - Select multiple images and generate metadata for all at once
- **📊 Analysis Panel** - View detailed analysis results including object detection probabilities, color palette, and lighting information
- **100% Client-Side** - All processing happens in your browser. No data is sent to external servers.

## How It Works

1. **Navigate** to the Adobe Stock contributor portal (`https://contributor.stock.adobe.com/`)
2. **Upload** your images as usual
3. **Click "Analyze Image"** to analyze a single image, or **"Bulk Select"** for multiple images
4. The extension uses TensorFlow.js with MobileNet running locally in your browser to:
   - Identify objects, animals, scenes, and concepts in the image
   - Analyze colors, brightness, and contrast
   - Map the analysis to relevant Adobe Stock keywords
   - Determine the best category match
   - Generate a descriptive title
5. **Review and apply** the generated metadata with one click

## Installation

### From Firefox Add-ons Store (Coming Soon)

1. Visit the Firefox Add-ons page
2. Click "Add to Firefox"
3. Grant the requested permissions

### Manual Installation (Developer Mode)

1. Build or download the extension package:
   ```bash
   # Clone or download this repository
   # Package the extension
   ```

2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

3. Click "Load Temporary Add-on" and select the `manifest.json` file

4. Navigate to `https://contributor.stock.adobe.com/` to start using

### Packaging for Distribution

```bash
# Install web-ext if needed
npm install -g web-ext

# Build the extension
web-ext build

# The .xpi file will be created in the web-ext-artifacts directory
```

## Requirements

- Firefox 109+ (Manifest V3 support)
- Internet connection for first-time ML model download (~5MB)
- An Adobe Stock contributor account

## Permissions

The extension requires the following permissions:

- `storage` - To save your settings
- `activeTab` - To interact with the contributor page
- `https://contributor.stock.adobe.com/*` - To run only on Adobe Stock

## Project Structure

```
metadata-generator/
├── manifest.json           # Extension manifest (MV3)
├── background.js           # Background event page
├── popup/
│   ├── popup.html         # Popup interface
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── content/
│   ├── content.js         # Adobe Stock page integration
│   └── content.css        # Injected styles
├── lib/
│   ├── analysis.html      # ML analysis page (loaded in iframe)
│   └── analysis.js        # TensorFlow.js + MobileNet logic
├── data/
│   ├── keywords.js        # Keyword database & mapping
│   ├── categories.js      # Adobe Stock category mapper
│   └── titles.js          # Title generation engine
├── icons/                 # Extension icons
└── README.md
```

## Technology Stack

- **Firefox Extension API** - Manifest V3
- **TensorFlow.js** - Client-side machine learning
- **MobileNet v2** - Image classification model
- **Vanilla JavaScript** - No frameworks, lightweight

## Privacy

- **All processing happens locally** in your browser
- **No images are sent to external servers**
- ML model is downloaded from Hugging Face CDN on first use
- No data collection or analytics
- No account or API key needed

## Development

```bash
# Clone the repository
git clone https://github.com/your-username/adobe-stock-metadata-generator
cd adobe-stock-metadata-generator

# Test the extension
# Open about:debugging in Firefox and load the manifest.json

# Package for distribution
npx web-ext build
```

## Limitations

- First-time use requires downloading the MobileNet model (~5MB), which may take a moment
- Analysis quality depends on MobileNet's 1000 ImageNet classes - it's good for broad categories but may not identify extremely specific subjects
- Adobe Stock's dynamic DOM may require selector updates if the site changes significantly

## License

MIT License - feel free to use, modify, and distribute.

## Support

For issues, feature requests, or contributions, please open an issue or pull request.
