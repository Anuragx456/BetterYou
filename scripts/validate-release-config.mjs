#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const allowPlaceholders = args.includes('--allow-placeholders');
const isStrict = args.includes('--strict') || process.env.GITHUB_REF === 'refs/heads/main' || process.env.GITHUB_REF === 'refs/heads/master';

const APP_JSON_PATH = path.resolve(process.cwd(), 'app.json');
const EAS_JSON_PATH = path.resolve(process.cwd(), 'eas.json');

function validateReleaseConfig() {
  console.log(`[validate-release-config] Running check (strict=${isStrict}, allowPlaceholders=${allowPlaceholders})...`);

  const errors = [];
  const warnings = [];

  // 1. Validate app.json
  if (!fs.existsSync(APP_JSON_PATH)) {
    console.error(`Error: app.json not found at ${APP_JSON_PATH}`);
    process.exit(1);
  }

  let appJson;
  try {
    appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
  } catch (err) {
    console.error(`Error parsing app.json: ${err.message}`);
    process.exit(1);
  }

  const updatesUrl = appJson?.expo?.updates?.url || '';
  const projectId = appJson?.expo?.extra?.eas?.projectId || '';

  if (!updatesUrl) {
    errors.push('app.json: expo.updates.url is missing.');
  } else if (updatesUrl.includes('YOUR_EAS_PROJECT_ID_HERE')) {
    const msg = 'app.json: expo.updates.url contains placeholder "YOUR_EAS_PROJECT_ID_HERE". Run "bunx eas project:init" to populate.';
    if (isStrict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  if (!projectId) {
    errors.push('app.json: expo.extra.eas.projectId is missing.');
  } else if (projectId.includes('YOUR_EAS_PROJECT_ID_HERE')) {
    const msg = 'app.json: expo.extra.eas.projectId contains placeholder "YOUR_EAS_PROJECT_ID_HERE".';
    if (isStrict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  // 2. Validate eas.json
  if (!fs.existsSync(EAS_JSON_PATH)) {
    console.error(`Error: eas.json not found at ${EAS_JSON_PATH}`);
    process.exit(1);
  }

  let easJson;
  try {
    easJson = JSON.parse(fs.readFileSync(EAS_JSON_PATH, 'utf8'));
  } catch (err) {
    console.error(`Error parsing eas.json: ${err.message}`);
    process.exit(1);
  }

  const prodBuild = easJson?.build?.production;
  if (!prodBuild) {
    errors.push('eas.json: "production" build profile is missing.');
  } else {
    const prodEnv = prodBuild.env || {};
    const proxyUrl = prodEnv.EXPO_PUBLIC_PROXY_URL || '';

    if (!proxyUrl) {
      errors.push('eas.json: production profile is missing required "EXPO_PUBLIC_PROXY_URL" environment variable.');
    } else if (proxyUrl.includes('localhost') || proxyUrl.includes('127.0.0.1')) {
      errors.push(`eas.json: production profile EXPO_PUBLIC_PROXY_URL points to localhost ("${proxyUrl}"). Must point to production proxy URL.`);
    } else if (!proxyUrl.startsWith('https://')) {
      errors.push(`eas.json: production profile EXPO_PUBLIC_PROXY_URL must use HTTPS scheme ("${proxyUrl}").`);
    }

    // Check preview profile as well
    const previewBuild = easJson?.build?.preview;
    if (previewBuild) {
      const previewProxyUrl = previewBuild?.env?.EXPO_PUBLIC_PROXY_URL || '';
      if (previewProxyUrl && (previewProxyUrl.includes('localhost') || previewProxyUrl.includes('127.0.0.1'))) {
        warnings.push(`eas.json: preview profile EXPO_PUBLIC_PROXY_URL points to localhost ("${previewProxyUrl}").`);
      }
    }
  }

  // Summary output
  if (warnings.length > 0) {
    console.warn(`\n⚠️  [validate-release-config] ${warnings.length} warning(s):`);
    for (const w of warnings) {
      console.warn(`   - ${w}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n❌ [validate-release-config] FAILED with ${errors.length} error(s):`);
    for (const e of errors) {
      console.error(`   - ${e}`);
    }
    console.error('\nProduction builds cannot proceed with release-blocking placeholders or invalid configurations.');
    process.exit(1);
  }

  console.log('✅ [validate-release-config] Release configuration check passed successfully!\n');
  process.exit(0);
}

validateReleaseConfig();
