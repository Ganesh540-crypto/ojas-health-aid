# Google Weather API Setup

## You're absolutely right! Google DOES have a Weather API! 🌤️

The Google Weather API is part of **Google Maps Platform** and provides high-quality weather data.

---

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable billing (required for API usage, but there's a free tier)

### Step 2: Enable Weather API

1. Go to [APIs & Services](https://console.cloud.google.com/apis/library)
2. Search for "Weather API"
3. Click on "Weather API"
4. Click "Enable"

### Step 3: Create API Key

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials"
3. Select "API Key"
4. Copy your API key
5. (Recommended) Click "Restrict Key" and limit to:
   - API restrictions: Select "Weather API" only
   - Application restrictions: HTTP referrers (websites)
   - Add your website domain

### Step 4: Add API Key to .env File

1. Open or create `.env` file in the project root
2. Add your Google Weather API key:

```bash
VITE_GOOGLE_WEATHER_API=AIzaSyD...your-actual-key-here
```

3. **Important:** Restart your dev server after adding the key:
   - Stop server (Ctrl+C)
   - Run `npm run dev` again
   
**Note:** The `.env` file is gitignored for security. Never commit API keys to Git!

### Step 5: Test

1. Clear browser cache: `localStorage.removeItem('ojas_weather_cache')`
2. Refresh page
3. Click weather refresh button
4. Check console for success message

---

## API Features

The Google Weather API provides:

✅ **Current Conditions**
- Temperature (actual & feels-like)
- Weather description & icon
- Humidity, UV index
- Wind speed & direction
- Precipitation probability
- Visibility, cloud cover
- Air pressure

✅ **5-Day Forecast**
- Daily high/low temperatures
- Weather conditions (day & night)
- Precipitation chances
- Sunrise/sunset times
- Moon phase
- Wind forecasts

✅ **Historical Data**
- Temperature changes
- Max/min temps
- Precipitation amounts

---

## Pricing

Google Weather API has a **generous free tier**:

- **$200 free credit per month**
- Current conditions: $0.001 per call (1000 calls = $1)
- Daily forecast: $0.002 per call (1000 calls = $2)

With 6-hour caching, you'll make ~4 calls/day = **~$0.024/month** (well within free tier)

---

## Fallback System

The code has a fallback system:
1. **Try Google API** (best quality)
2. **On failure → Dynamic mock data** (so app never breaks)

Mock data will:
- Generate current weekday names
- Create realistic varying temperatures
- Update every time (not stuck on old values)

---

## API Documentation

📚 [Google Weather API Docs](https://developers.google.com/maps/documentation/weather)
- [Current Conditions](https://developers.google.com/maps/documentation/weather/current-conditions)
- [Daily Forecast](https://developers.google.com/maps/documentation/weather/daily-forecast)
- [Pricing](https://mapsplatform.google.com/pricing/)

---

## Need Help?

If you encounter issues:
1. Check browser console for error messages
2. Verify API key is correct
3. Ensure Weather API is enabled in Google Cloud
4. Check billing is enabled (required even for free tier)
5. Verify API key restrictions allow your domain

---

**Once setup, you'll have real-time accurate weather with Google's world-class data!** 🌍
