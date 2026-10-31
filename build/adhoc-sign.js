// Mac builds made without an Apple Developer ID (CSC_IDENTITY_AUTO_DISCOVERY=false):
// give the whole app one valid ad-hoc signature. Without it the app's seal is broken and a downloaded
// copy on Apple Silicon says "Cuey is damaged" (fix = Terminal). With it, macOS only says it couldn't
// verify the developer, and System Settings → Privacy & Security → "Open Anyway" opens it — no Terminal.
// Once the Developer ID secrets exist, electron-builder signs + notarizes as usual and this does nothing.
const { execFileSync } = require('child_process');
const path = require('path');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false') return;      // a real certificate will sign it
  if (/-temp$/.test(ctx.appOutDir)) return;                              // halves of the universal build: signed once merged
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
  const ent = path.join(__dirname, 'entitlements.mac.plist');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--entitlements', ent, app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
  console.log('ad-hoc signed + verified:', app);
};
