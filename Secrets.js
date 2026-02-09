// Secrets.js - Script Properties helpers

function getSecret(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getOptionalSecret(key, defaultValue) {
  const value = getSecret(key);
  return value !== null && value !== undefined && value !== "" ? value : defaultValue;
}

function requireSecret(key) {
  const value = getSecret(key);
  if (!value) {
    throw new Error(`Missing Script Property: ${key}`);
  }
  return value;
}

function getFlag(key, defaultValue) {
  const value = getSecret(key);
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  return String(value).toLowerCase() === "true";
}
