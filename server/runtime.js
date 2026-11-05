export function assertRuntime(version = process.versions.node) {
  const [major, minor, patch] = version.split('.').map(Number);
  const supported = (major === 24 && minor >= 15) ||
    (major === 25 && (minor > 8 || (minor === 8 && patch >= 1)));
  if (!/^\d+\.\d+\.\d+$/.test(version) || !supported) {
    throw new Error(
      'MenuPilot local preview supports Node >=24.15.0 <25.0.0 OR >=25.8.1 <26.0.0. ' +
      `Found ${version}. Install Node 24 LTS and run npm ci.`
    );
  }
}
