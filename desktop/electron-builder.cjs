/* oxlint-disable no-template-curly-in-string -- electron-builder fills in ${version} and ${ext} */

const canary = process.env.SPOTLIGHT_DESKTOP_CHANNEL === 'canary';

/** @type {import('electron-builder').Configuration} */
// oxlint-disable-next-line import/no-commonjs -- electron-builder loads its config with require
module.exports = {
  appId: 'ai.usespotlight.desktop',
  productName: 'Spotlight',
  copyright: 'Copyright © Spotlight',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**', 'package.json'],
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    enableCookieEncryption: true,
  },
  protocols: [{ name: 'Spotlight', schemes: ['spotlight'] }],
  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'build/Spotlight.icon',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: true,
    artifactName: 'Spotlight-${version}-mac.${ext}',
    target: [
      { target: 'dmg', arch: 'universal' },
      { target: 'zip', arch: 'universal' },
    ],
  },
  dmg: {
    artifactName: 'Spotlight-${version}.dmg',
  },
  publish: canary
    ? {
        provider: 'generic',
        url: 'https://github.com/usespotlightai/spotlight/releases/download/canary',
        channel: 'canary',
      }
    : {
        provider: 'github',
        owner: 'usespotlightai',
        repo: 'spotlight',
        releaseType: 'release',
      },
};
