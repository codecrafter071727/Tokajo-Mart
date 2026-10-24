import path from "node:path";

const PRETTIER_GLOB = "*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml,css}";
/** Keep each spawn well under the Windows cmd.exe 8191-character limit. */
const FILES_PER_PRETTIER = 20;

/**
 * @param {string[]} files
 * @returns {string[]}
 */
function prettierCommands(files) {
  const cwd = process.cwd();
  const quoted = files.map((file) => JSON.stringify(path.relative(cwd, file)));
  const commands = [];

  for (let i = 0; i < quoted.length; i += FILES_PER_PRETTIER) {
    commands.push(`prettier --write ${quoted.slice(i, i + FILES_PER_PRETTIER).join(" ")}`);
  }

  return commands;
}

/** @type {import("lint-staged").Configuration} */
export default {
  [PRETTIER_GLOB]: prettierCommands,
};
