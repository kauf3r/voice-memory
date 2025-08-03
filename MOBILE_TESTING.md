# Mobile Testing Guide

This guide covers testing Voice Memory on various mobile devices and screen sizes.

## Test Devices & Browsers

### iOS Devices
- **iPhone SE (375×667)** - Small screen
- **iPhone 12/13/14 (390×844)** - Standard iPhone
- **iPhone 14 Plus (428×926)** - Large iPhone
- **iPad (768×1024)** - Tablet portrait
- **iPad Pro (1024×1366)** - Large tablet

### Android Devices
- **Galaxy S20 (360×800)** - Compact Android
- **Galaxy S21 (384×854)** - Standard Android
- **Galaxy Note (412×915)** - Large Android
- **Galaxy Tab (800×1280)** - Android tablet

### Browsers to Test
- Safari (iOS)
- Chrome (Android/iOS)
- Firefox (Android)
- Samsung Internet
- Edge Mobile

## Testing Checklist

### 📱 Layout & Design
- [ ] All text is readable without zooming
- [ ] Buttons are at least 44px touch target
- [ ] Navigation is accessible with thumb
- [ ] No horizontal scrolling on any screen
- [ ] Content fits viewport on all devices
- [ ] Modals/dialogs work properly

### 🎙️ Audio Upload
- [ ] Drag and drop works (where supported)
- [ ] File picker opens correctly
- [ ] Upload progress shows clearly
- [ ] Error messages are readable
- [ ] Multiple file upload works
- [ ] File size validation works

### 🎵 Audio Playback
- [ ] Audio controls are touch-friendly
- [ ] Play/pause buttons work
- [ ] Volume controls accessible
- [ ] Seeking works on touch
- [ ] Audio loads properly
- [ ] Background playback (if supported)

### 📝 Text Input & Interaction
- [ ] Search input works with virtual keyboard
- [ ] Keyboard doesn't obscure content
- [ ] Form submission works
- [ ] Swipe gestures work (if implemented)
- [ ] Touch feedback is responsive
- [ ] Autocorrect/autocomplete behaves well

### 🔄 Loading & Performance
- [ ] Loading states are clear
- [ ] App loads quickly on 3G
- [ ] Images load progressively
- [ ] Infinite scroll works smoothly
- [ ] App works offline (cached content)
- [ ] No layout shifts while loading

### 🎨 Visual Polish
- [ ] Icons are crisp on high-DPI screens
- [ ] Colors are consistent
- [ ] Spacing is appropriate for touch
- [ ] Fonts render correctly
- [ ] Dark mode (if implemented)
- [ ] Orientation changes work

## Device-Specific Testing

### iPhone Testing
```bash
# Test with iOS Safari
# Focus on:
- PWA installation
- Home screen icon
- Status bar integration
- Swipe gestures
- Share sheet integration
```

### Android Testing  
```bash
# Test with Chrome for Android
# Focus on:
- PWA installation
- Android intent handling
- Back button behavior
- File access permissions
- Share functionality
```

### Tablet Testing
```bash
# Test larger screens
# Focus on:
- Multi-column layouts
- Touch targets size
- Content scaling
- Orientation changes
- Split screen (if supported)
```

## Browser Dev Tools Testing

### Chrome DevTools
1. Open DevTools (F12)
2. Click device toolbar icon
3. Test these presets:
   - iPhone SE
   - iPhone 12 Pro
   - Pixel 5
   - Samsung Galaxy S8+
   - iPad
   - iPad Pro

### Firefox DevTools
1. Open DevTools (F12)
2. Click responsive design mode
3. Test various screen sizes
4. Check touch simulation

### Safari DevTools
1. Enable Develop menu
2. Use Responsive Design Mode
3. Test iOS-specific features

## Performance Testing

### Network Conditions
Test on various network speeds:
- **Fast 3G** (1.5 Mbps)
- **Slow 3G** (400 Kbps)
- **Offline** (cached content)

### Performance Metrics
- [ ] First Contentful Paint < 2s
- [ ] Largest Contentful Paint < 3s
- [ ] Time to Interactive < 4s
- [ ] Cumulative Layout Shift < 0.1

## Accessibility Testing

### Touch Accessibility
- [ ] All interactive elements ≥ 44px
- [ ] Touch targets don't overlap
- [ ] Swipe gestures have alternatives
- [ ] Focus indicators visible

### Screen Reader Testing
- [ ] VoiceOver (iOS)
- [ ] TalkBack (Android)
- [ ] Proper heading structure
- [ ] Alt text for images
- [ ] ARIA labels where needed

## PWA Testing

### Installation
- [ ] "Add to Home Screen" prompt
- [ ] Icon appears correctly
- [ ] App launches in standalone mode
- [ ] Splash screen shows

### Offline Functionality
- [ ] Basic app loads offline
- [ ] Error messages for offline actions
- [ ] Data syncs when online
- [ ] Cached content available

## Testing Tools

### Browser Extensions
- **Lighthouse** - Performance auditing
- **axe DevTools** - Accessibility testing
- **Responsive Viewer** - Multi-device preview

### Online Tools
- **BrowserStack** - Real device testing
- **Sauce Labs** - Cross-browser testing
- **GTmetrix** - Performance analysis
- **WebPageTest** - Detailed performance

### Local Testing
```bash
# Test on local network
npm run dev -- --host 0.0.0.0

# Access from mobile devices:
# http://[your-ip]:3000
```

## Common Issues & Solutions

### Layout Issues
```css
/* Fix viewport on mobile */
<meta name="viewport" content="width=device-width, initial-scale=1">

/* Prevent zoom on input focus */
input { font-size: 16px; }

/* Fix 100vh on mobile */
height: 100dvh; /* Use dvh instead of vh */
```

### Touch Issues
```css
/* Better touch targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Remove tap highlight */
-webkit-tap-highlight-color: transparent;

/* Improve scrolling */
-webkit-overflow-scrolling: touch;
```

### Performance Issues
```javascript
// Lazy load images
<img loading="lazy" src="..." alt="..." />

// Preload critical resources
<link rel="preload" href="font.woff2" as="font" />

// Use intersection observer for infinite scroll
// (Already implemented in our app)
```

## Test Scenarios

### Critical User Journeys
1. **Sign Up Flow**
   - Open app on mobile
   - Tap sign up
   - Enter email
   - Check email on mobile
   - Complete registration

2. **Upload Audio**
   - Tap upload button
   - Select audio file
   - Wait for upload
   - Verify progress indicator
   - Check success state

3. **View Analysis**
   - Tap on note card
   - Scroll through analysis
   - Tap to play audio
   - Navigate back
   - Test pagination

### Edge Cases
- Very long transcriptions
- Multiple file uploads
- Network interruption
- Battery saver mode
- Low storage warning
- Orientation changes mid-task

## Reporting Issues

When reporting mobile issues, include:
- Device model and OS version
- Browser name and version
- Screen size and orientation
- Network conditions
- Steps to reproduce
- Screenshots/video if helpful
- Console errors (if accessible)

## Continuous Testing

Set up automated mobile testing:
```javascript
// Example Playwright mobile test
test('mobile upload flow', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 12']
  });
  const page = await context.newPage();
  
  await page.goto('/');
  await page.click('[data-testid="upload-button"]');
  // ... test steps
});
```

---

## Quick Mobile Test Commands

```bash
# Test responsive design
npm run dev

# Analyze bundle for mobile
npm run build:analyze

# Test on local network
npm run dev -- --host 0.0.0.0

# Run accessibility tests
npm run test:a11y
```

Remember: Mobile testing is ongoing - test with each feature addition and update!