/**
 * Normalizes Node options for Playwright collection and pre-capture builds.
 * The collector needs source-conditioned workspace exports, while package
 * builds must resolve their normal packed-package exports.
 */

const SOURCE_CONDITION = "--conditions=eliza-source";
const CONDITIONS_OPTION = "--conditions";
const SOURCE_CONDITION_NAME = "eliza-source";

function nodeOptionTokens(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().split(/\s+/)
    : [];
}

export function withElizaSourceNodeOptions(value) {
  const options = nodeOptionTokens(value);

  if (!options.includes(SOURCE_CONDITION)) {
    options.push(SOURCE_CONDITION);
  }

  return options.join(" ");
}

export function withoutElizaSourceNodeOptions(value) {
  const options = nodeOptionTokens(value);
  return options
    .filter((option, index) => {
      if (option === SOURCE_CONDITION) return false;
      if (
        option === CONDITIONS_OPTION &&
        options[index + 1] === SOURCE_CONDITION_NAME
      ) {
        return false;
      }
      if (
        option === SOURCE_CONDITION_NAME &&
        options[index - 1] === CONDITIONS_OPTION
      ) {
        return false;
      }
      return true;
    })
    .join(" ");
}
