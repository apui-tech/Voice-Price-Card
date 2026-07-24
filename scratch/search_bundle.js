const fs = require('fs');
const path = require('path');

const bundleDir = 'd:/code/mother_app/dist/assets';
const files = fs.readdirSync(bundleDir).filter(f => f.endsWith('.js'));
if (files.length === 0) {
  console.log("No js files found");
  process.exit(1);
}

const filepath = path.join(bundleDir, files[0]);
console.log("Reading bundle:", filepath);
const content = fs.readFileSync(filepath, 'utf8');

// Find occurrences of "ze" or look at the surrounding of the error trace
// We know from stack trace:
// jo (index-CKy4LOCp.js:42:61886)
// Let's print around character index or search for some key strings.
// Since the bundle changed, let's look for how configService or LoginScreen are minified.

// Let's find "LoginScreen" or "Login"
const indexLogin = content.indexOf('LoginScreen');
if (indexLogin !== -1) {
  console.log("Found 'LoginScreen' at index:", indexLogin);
  console.log(content.substring(indexLogin - 200, indexLogin + 200));
} else {
  console.log("'LoginScreen' not found in bundle");
}

// Let's search for "hashPin" or "configService"
const indexHash = content.indexOf('hashPin');
if (indexHash !== -1) {
  console.log("Found 'hashPin' at index:", indexHash);
  console.log(content.substring(indexHash - 200, indexHash + 200));
}

// Let's search for "app_config"
const indexAppConfig = content.indexOf('app_config');
if (indexAppConfig !== -1) {
  console.log("Found 'app_config' at index:", indexAppConfig);
  console.log(content.substring(indexAppConfig - 200, indexAppConfig + 200));
}
