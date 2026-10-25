const fs = require("node:fs");
const path = require("node:path");

function existingProjectFile(filePath) {
  if (!filePath) return false;
  return fs.existsSync(path.resolve(__dirname, filePath));
}

const hasGoogleServices =
  existingProjectFile(process.env.GOOGLE_SERVICES_PLIST) &&
  existingProjectFile(process.env.GOOGLE_SERVICES_JSON);

const skipped = hasGoogleServices
  ? {}
  : {
      "@react-native-firebase/app": { platforms: { ios: null, android: null } },
      "@react-native-firebase/messaging": { platforms: { ios: null, android: null } },
      "@react-native-google-signin/google-signin": { platforms: { ios: null, android: null } },
    };

module.exports = { dependencies: skipped };
