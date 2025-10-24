# Firebase Hosting Setup for Multiple Domains

## Overview
This setup allows you to serve:
- `ojasai.co.in` → Landing page
- `app.ojasai.co.in` → Main Ojas app

## Firebase Hosting Configuration

### 1. Configure Hosting Targets
```bash
# Set up hosting targets
firebase target:apply hosting app app-ojasai
firebase target:apply hosting landing ojasai
```

### 2. Deploy to Specific Targets
```bash
# Deploy to landing page (ojasai.co.in)
firebase deploy --only hosting:landing

# Deploy to app (app.ojasai.co.in)  
firebase deploy --only hosting:app

# Deploy to both
firebase deploy --only hosting
```

### 3. Domain Configuration in Firebase Console

1. Go to Firebase Console → Hosting
2. Add custom domains:
   - Add `ojasai.co.in` to the `ojasai` site
   - Add `app.ojasai.co.in` to the `app-ojasai` site

### 4. Route Configuration

The app will automatically route:
- `/` → Landing page (public)
- `/app` → Main Ojas app (requires auth)
- `/login`, `/signup` → Auth pages
- `/privacy`, `/terms` → Landing-specific legal pages
- `/app/privacy`, `/app/terms` → App-specific legal pages

## Landing Page Structure

```
src/pages/Landing/
├── index.tsx              # Main landing page
└── components/
    ├── LandingHeader.tsx  # Navigation header
    ├── HeroSection.tsx    # Hero section with CTA
    ├── FeaturesSection.tsx # Features showcase
    ├── LogoCloud.tsx      # Trust indicators
    └── LandingFooter.tsx  # Footer with links
```

## Key Features

### Landing Page
- ✅ Ojas branding with hero font
- ✅ Modern glassmorphism design
- ✅ Health-focused messaging
- ✅ Privacy-first positioning
- ✅ Clear CTAs to signup/login
- ✅ Responsive design
- ✅ SEO-friendly structure

### Firebase Hosting
- ✅ Multiple domain support
- ✅ SPA routing configuration
- ✅ Separate deployment targets
- ✅ Custom domain setup ready

## Next Steps

1. **Test the landing page**: Visit `/landing` in your app
2. **Deploy to Firebase**: Use the commands above
3. **Configure domains**: Add custom domains in Firebase Console
4. **Update DNS**: Point your domains to Firebase hosting
5. **SSL**: Firebase automatically provides SSL certificates

## GCP Brand Verification

For GCP brand verification, you can now submit:
- **Landing page**: `ojasai.co.in` 
- **App**: `app.ojasai.co.in`

The landing page showcases your product professionally with proper branding, privacy policy links, and terms of service - exactly what GCP verification requires.
