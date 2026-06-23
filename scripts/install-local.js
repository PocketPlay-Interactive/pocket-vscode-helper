const { existsSync } = require("node:fs");
const { delimiter, join } = require("node:path");
const { spawnSync } = require("node:child_process");

const packageJson = require("../package.json");
const vsix = `${packageJson.name}-${packageJson.version}.vsix`;

const candidateCommands = [
  process.env.VSCODE_CLI,
  "code",
  "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
  "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders"
].filter(Boolean);

function commandExists(command) {
  if (command.includes("/")) {
    return existsSync(command);
  }

  return (process.env.PATH || "")
    .split(delimiter)
    .some((path) => existsSync(join(path, command)));
}

const codeCommand = candidateCommands.find(commandExists);

if (!codeCommand) {
  console.error("Could not find the VS Code CLI.");
  console.error("Set VSCODE_CLI to your VS Code CLI path, or install the 'code' shell command from VS Code.");
  process.exit(1);
}

const result = spawnSync(codeCommand, ["--install-extension", vsix, "--force"], {
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
