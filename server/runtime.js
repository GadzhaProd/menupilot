export function assertRuntime(version = process.versions.node) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (!((major === 24 && minor >= 15) || (major === 25 && (minor > 8 || (minor === 8 && patch >= 1))))) {
    throw new Error(`MenuPilot local preview requires Node 24.15.0 LTS or newer 24.x (also tested on 25.8.1+ in 25.x). Found ${version}. Install Node 24 LTS and run npm ci.`);
  }
}
