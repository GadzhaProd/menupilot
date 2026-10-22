export function hasValidLaunchUrl(address, url) {
  return typeof url === 'string' && url.startsWith(address + '/menupilot/#k=') && url.length > (address + '/menupilot/#k=').length;
}
