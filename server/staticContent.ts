import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadScreenshotBase64(filename: string): string {
  const paths = [
    join(__dirname, 'public', 'screenshots', filename),
    join(__dirname, '..', 'server', 'public', 'screenshots', filename),
  ];
  
  for (const p of paths) {
    if (existsSync(p)) {
      const data = readFileSync(p);
      return `data:image/png;base64,${data.toString('base64')}`;
    }
  }
  return '';
}

const welcomeScreenshot = loadScreenshotBase64('welcome.png');
const workoutScreenshot = loadScreenshotBase64('workout-player.png');
const progressScreenshot = loadScreenshotBase64('progress.png');

export const privacyPolicyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - PulseKegel</title>
  <meta name="description" content="PulseKegel privacy policy. Learn how your data is stored locally on your device, what minimal information we collect, and your rights." />
  <link rel="canonical" href="https://pulsekegel.com/privacy" />
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/favicon.png">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 25%, #0a1a2e 75%, #0a0a1a 100%); min-height: 100vh; color: #fff; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(0, 255, 136, 0.3); }
    .logo { font-size: 32px; font-weight: 700; background: linear-gradient(90deg, #00ff88, #00ffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 10px; }
    h1 { font-size: 28px; color: #fff; margin-bottom: 20px; }
    .dates { color: rgba(255, 255, 255, 0.6); font-size: 14px; }
    .dates span { display: block; margin: 5px 0; }
    section { margin-bottom: 35px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 25px; border: 1px solid rgba(0, 255, 136, 0.1); }
    h2 { font-size: 20px; color: #00ff88; margin-bottom: 15px; text-shadow: 0 0 10px rgba(0, 255, 136, 0.3); }
    p { color: rgba(255, 255, 255, 0.85); margin-bottom: 12px; }
    ul { list-style: none; margin-top: 10px; }
    li { position: relative; padding-left: 25px; margin-bottom: 10px; color: rgba(255, 255, 255, 0.85); }
    li::before { content: ''; position: absolute; left: 0; top: 8px; width: 8px; height: 8px; background: #00ffff; border-radius: 50%; box-shadow: 0 0 8px #00ffff; }
    .highlight { color: #00ffff; font-weight: 600; }
    .contact-section { text-align: center; background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 255, 0.1)); }
    .contact-email { color: #00ff88; text-decoration: none; font-weight: 600; font-size: 18px; }
    .contact-email:hover { text-decoration: underline; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.4); font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="logo">PulseKegel</div>
      <h1>Privacy Policy</h1>
      <div class="dates">
        <span>Effective Date: 01/29/2026</span>
        <span>Last Updated: 01/29/2026</span>
      </div>
    </header>
    <section>
      <h2>Information We Collect</h2>
      <p>PulseKegel collects minimal personal information to provide our services:</p>
      <ul>
        <li><span class="highlight">First Name:</span> Used for personalization within the app</li>
        <li><span class="highlight">Anatomy Type:</span> Used to customize app functionality and recommendations</li>
      </ul>
    </section>
    <section>
      <h2>How We Use Your Information</h2>
      <p>The information we collect is used solely for:</p>
      <ul>
        <li>Personalizing your app experience</li>
        <li>Providing relevant content and features based on your anatomy type</li>
        <li>Improving app functionality</li>
      </ul>
    </section>
    <section>
      <h2>Data Storage and Security</h2>
      <p>Your data is stored securely on your device and our servers using industry-standard security measures.</p>
      <p>We do not share, sell, or distribute your personal information to third parties.</p>
    </section>
    <section>
      <h2>Your Rights and Data Control</h2>
      <ul>
        <li><span class="highlight">Data Deletion:</span> You can delete all your personal data at any time by using the delete button within the app</li>
        <li><span class="highlight">Data Access:</span> You have the right to know what data we have about you</li>
        <li><span class="highlight">Data Portability:</span> You can request a copy of your data</li>
      </ul>
    </section>
    <section>
      <h2>Data Retention</h2>
      <p>We retain your information only as long as necessary to provide our services.</p>
      <p>When you delete your data through the app, it is permanently removed from our systems.</p>
    </section>
    <section>
      <h2>Children's Privacy</h2>
      <p>PulseKegel is not intended for children under 13.</p>
      <p>We do not knowingly collect personal information from children under 13.</p>
    </section>
    <section>
      <h2>Changes to This Policy</h2>
      <p>We may update this privacy policy from time to time.</p>
      <p>We will notify users of any material changes through the app or via email.</p>
    </section>
    <section class="contact-section">
      <h2>Contact Us</h2>
      <p>If you have questions about this privacy policy, please contact us at:</p>
      <a href="mailto:info@avatargen.com" class="contact-email">info@avatargen.com</a>
    </section>
    <footer class="footer">
      <p>PulseKegel - Pelvic Floor Workout App</p>
    </footer>
  </div>
</body>
</html>`;

export function getAboutPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About PulseKegel - Pelvic Floor Exercise App for Men & Women</title>
    <meta name="description" content="PulseKegel is a pelvic floor exercise app with a 12-week progressive kegel training program, haptic feedback, AI progress reviews, guided breathwork, and ambient music. Built for real results." />
    <link rel="canonical" href="https://pulsekegel.com/about" />
    <meta property="og:title" content="About PulseKegel - Pelvic Floor Exercise App" />
    <meta property="og:description" content="A 12-week progressive kegel training program with haptic feedback, AI progress reviews, guided breathwork, and ambient music. Just $4.99/year." />
    <meta property="og:url" content="https://pulsekegel.com/about" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://pulsekegel.com/favicon.png" />
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="apple-touch-icon" href="/favicon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 25%, #16213e 50%, #0f0f23 75%, #0a0a1a 100%); color: #ffffff; min-height: 100vh; overflow-x: hidden; }
        .glow-orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.3; pointer-events: none; z-index: 0; }
        .orb-1 { width: 400px; height: 400px; background: #00FF88; top: -100px; right: -100px; }
        .orb-2 { width: 300px; height: 300px; background: #FF00FF; bottom: 20%; left: -100px; }
        .orb-3 { width: 250px; height: 250px; background: #00FFFF; bottom: -50px; right: 20%; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
        header { padding: 40px 0; text-align: center; }
        .logo-section { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px; }
        .app-icon { width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #1a1a2e, #16213e); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 30px rgba(0, 255, 136, 0.3); }
        .app-icon svg { width: 40px; height: 40px; }
        .logo { font-family: 'Orbitron', sans-serif; font-size: 2.5rem; font-weight: 700; background: linear-gradient(90deg, #00FF88, #00FFFF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0 0 40px rgba(0, 255, 136, 0.5); }
        .logo-subtitle { font-size: 1rem; font-weight: 400; display: block; margin-top: 4px; background: linear-gradient(90deg, #00FFFF, #FF00FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 0.05em; }
        .tagline { font-size: 1.1rem; color: rgba(255, 255, 255, 0.7); font-weight: 300; }
        .hero { padding: 60px 0; text-align: center; }
        .story-card { background: linear-gradient(135deg, rgba(26, 26, 46, 0.9), rgba(22, 33, 62, 0.9)); border: 1px solid rgba(0, 255, 136, 0.2); border-radius: 24px; padding: 48px; max-width: 800px; margin: 0 auto; position: relative; overflow: hidden; }
        .story-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #00FF88, #00FFFF, #FF00FF); }
        .quote-mark { font-family: 'Orbitron', sans-serif; font-size: 4rem; color: #00FF88; opacity: 0.3; line-height: 1; margin-bottom: -20px; }
        .story-text { font-size: 1.25rem; line-height: 1.8; color: rgba(255, 255, 255, 0.9); font-weight: 300; margin-bottom: 32px; }
        .story-text strong { color: #00FF88; font-weight: 500; }
        .cta-text { font-family: 'Orbitron', sans-serif; font-size: 1.5rem; font-weight: 600; background: linear-gradient(90deg, #00FFFF, #FF00FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .screenshots-section { padding: 80px 0; }
        .section-title { font-family: 'Orbitron', sans-serif; font-size: 2rem; text-align: center; margin-bottom: 48px; color: #00FFFF; }
        .screenshots-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; max-width: 1000px; margin: 0 auto; }
        @media (max-width: 900px) { .screenshots-grid { grid-template-columns: 1fr; gap: 48px; max-width: 320px; } }
        .screenshot-item { text-align: center; }
        .phone-frame { position: relative; display: inline-block; }
        .phone-frame::before { content: ''; position: absolute; inset: -8px; background: linear-gradient(135deg, #00FF88, #00FFFF, #FF00FF); border-radius: 44px; opacity: 0.5; filter: blur(8px); z-index: -1; }
        .phone-frame img { width: 260px; height: auto; border-radius: 36px; border: 4px solid #2a2a4e; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); }
        .screenshot-label { margin-top: 20px; font-family: 'Orbitron', sans-serif; font-size: 1rem; color: #00FF88; font-weight: 500; }
        .screenshot-desc { margin-top: 8px; font-size: 0.9rem; color: rgba(255, 255, 255, 0.6); }
        .features-section { padding: 80px 0; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 1000px; margin: 0 auto; }
        .feature-card { background: rgba(26, 26, 46, 0.6); border: 1px solid rgba(0, 255, 255, 0.15); border-radius: 16px; padding: 32px; text-align: center; transition: transform 0.3s ease, border-color 0.3s ease; }
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(0, 255, 136, 0.4); }
        .feature-icon { width: 56px; height: 56px; margin: 0 auto 16px; background: linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 255, 255, 0.2)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        .feature-title { font-family: 'Orbitron', sans-serif; font-size: 1.1rem; color: #00FFFF; margin-bottom: 8px; }
        .feature-desc { font-size: 0.95rem; color: rgba(255, 255, 255, 0.7); line-height: 1.6; }
        .cta-section { padding: 80px 0; text-align: center; }
        .cta-card { background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 255, 0.1)); border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 24px; padding: 48px; max-width: 600px; margin: 0 auto; }
        .cta-title { font-family: 'Orbitron', sans-serif; font-size: 1.8rem; margin-bottom: 16px; color: #00FF88; }
        .cta-subtitle { font-size: 1.1rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 32px; }
        .download-btn { display: inline-flex; align-items: center; gap: 12px; padding: 16px 48px; background: linear-gradient(135deg, #00FF88, #00FFAA); color: #0a0a1a; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; font-weight: 600; text-decoration: none; border-radius: 50px; transition: transform 0.3s ease, box-shadow 0.3s ease; box-shadow: 0 0 30px rgba(0, 255, 136, 0.4); }
        .download-btn:hover { transform: scale(1.05); box-shadow: 0 0 50px rgba(0, 255, 136, 0.6); }
        .download-btn svg { width: 24px; height: 24px; }
        footer { padding: 40px 0; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); }
        .footer-links { display: flex; justify-content: center; gap: 32px; margin-bottom: 16px; }
        .footer-links a { color: rgba(255, 255, 255, 0.6); text-decoration: none; font-size: 0.9rem; transition: color 0.3s ease; }
        .footer-links a:hover { color: #00FFFF; }
        .copyright { color: rgba(255, 255, 255, 0.4); font-size: 0.85rem; }
        @media (max-width: 600px) { .logo { font-size: 1.8rem; } .story-card { padding: 32px 24px; } .story-text { font-size: 1.1rem; } .cta-text { font-size: 1.2rem; } .section-title { font-size: 1.5rem; } .phone-frame img { width: 220px; } .cta-card { padding: 32px 24px; } .cta-title { font-size: 1.4rem; } }
    </style>
</head>
<body>
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>
    <div class="glow-orb orb-3"></div>
    <div class="container">
        <header>
            <div class="logo-section">
                <div class="app-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                </div>
                <h1 class="logo">PulseKegel <span class="logo-subtitle">Pelvic Floor Exercise App</span></h1>
            </div>
            <p class="tagline">Pelvic Floor Training, Simplified</p>
        </header>
        <section class="hero">
            <div class="story-card">
                <div class="quote-mark">"</div>
                <p class="story-text">
                    At 54, I hit a few speed bumps in the bedroom, and Kegels were the one recommendation that actually helped. I tried a popular app, but it was packed with extras I didn't want and a monthly subscription that was... <strong>disrespectful</strong>. So I built a simpler Kegel app that does the job, <strong>no fluff, just results</strong>, for a small fee to cover running costs.
                </p>
                <p class="cta-text">Ready to take control? Download it and start today.</p>
            </div>
        </section>
        <section class="screenshots-section">
            <h2 class="section-title">See It In Action</h2>
            <div class="screenshots-grid">
                <div class="screenshot-item">
                    <div class="phone-frame">
                        <img src="${welcomeScreenshot}" alt="PulseKegel Welcome Screen">
                    </div>
                    <p class="screenshot-label">Welcome</p>
                    <p class="screenshot-desc">Beautiful guided onboarding</p>
                </div>
                <div class="screenshot-item">
                    <div class="phone-frame">
                        <img src="${workoutScreenshot}" alt="PulseKegel Workout Player">
                    </div>
                    <p class="screenshot-label">Train</p>
                    <p class="screenshot-desc">Visual cues & haptic feedback</p>
                </div>
                <div class="screenshot-item">
                    <div class="phone-frame">
                        <img src="${progressScreenshot}" alt="PulseKegel Progress Tracking">
                    </div>
                    <p class="screenshot-label">Track</p>
                    <p class="screenshot-desc">Calendar & streak tracking</p>
                </div>
            </div>
        </section>
        <section class="features-section">
            <h2 class="section-title">Why PulseKegel?</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
                    <h3 class="feature-title">12-Week Program</h3>
                    <p class="feature-desc">Progressive training that builds strength over time with proven exercise patterns</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FFFF" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/></svg></div>
                    <h3 class="feature-title">Haptic Feedback</h3>
                    <p class="feature-desc">Feel the rhythm with distinct vibration patterns for each exercise type</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF00FF" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></div>
                    <h3 class="feature-title">Visual Power Bar</h3>
                    <p class="feature-desc">LED-style display guides your squeeze intensity in real-time</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
                    <h3 class="feature-title">Quick Sessions</h3>
                    <p class="feature-desc">Just 5-10 minutes per day. Fits easily into your routine</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FFFF" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                    <h3 class="feature-title">Private & Secure</h3>
                    <p class="feature-desc">All data stays on your device. No account required</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF00FF" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
                    <h3 class="feature-title">Intro Offer</h3>
                    <p class="feature-desc">$4.99 for 12 months. No hidden fees. Just honest value</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></div>
                    <h3 class="feature-title">Weekly AI Analysis</h3>
                    <p class="feature-desc">Personalized progress reviews and health tips each week, tailored just for you</p>
                </div>
            </div>
        </section>
        <section class="roadmap-section" style="padding: 3rem 1.5rem;">
            <h2 style="text-align: center; font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem; background: linear-gradient(135deg, #00FF88, #00FFFF); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">More Updates Planned</h2>
            <div style="max-width: 600px; margin: 0 auto;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 3px solid #00FF88;">
                    <div style="margin-right: 1rem; color: #00FF88;">&#10003;</div>
                    <div>
                        <strong style="color: #fff;">AI-Recommended Follow-On Maintenance Plan</strong>
                        <p style="color: rgba(255,255,255,0.6); margin: 0.25rem 0 0 0; font-size: 0.9rem;">Personalized workout recommendations based on your progress and goals</p>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 3px solid #00FFFF;">
                    <div style="margin-right: 1rem; color: #00FFFF;">&#10003;</div>
                    <div>
                        <strong style="color: #fff;">Advanced Progress Analytics</strong>
                        <p style="color: rgba(255,255,255,0.6); margin: 0.25rem 0 0 0; font-size: 0.9rem;">Detailed charts and insights to track your improvement over time</p>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 3px solid #FF00FF;">
                    <div style="margin-right: 1rem; color: #FF00FF;">&#10003;</div>
                    <div>
                        <strong style="color: #fff;">Custom Workout Builder</strong>
                        <p style="color: rgba(255,255,255,0.6); margin: 0.25rem 0 0 0; font-size: 0.9rem;">Create and save your own exercise routines</p>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 3px solid #8B5CF6;">
                    <div style="margin-right: 1rem; color: #8B5CF6;">&#10003;</div>
                    <div>
                        <strong style="color: #fff;">Apple Watch Integration</strong>
                        <p style="color: rgba(255,255,255,0.6); margin: 0.25rem 0 0 0; font-size: 0.9rem;">Discreet workout guidance right on your wrist</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="cta-section">
            <div class="cta-card">
                <h2 class="cta-title">Start Your Journey</h2>
                <p class="cta-subtitle">Download PulseKegel and take the first step toward better pelvic health.</p>
                <a href="#" class="download-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                    Download on App Store
                </a>
            </div>
        </section>
        <footer>
            <div class="footer-links"><a href="/privacy">Privacy Policy</a></div>
            <p class="copyright">2026 PulseKegel. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;
}
