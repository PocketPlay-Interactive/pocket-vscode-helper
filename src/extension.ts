import * as cp from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

type GitResult = {
  stdout: string;
  stderr: string;
};

const cachePaths = [
  'jobs.db',
  'jobs.db-shm',
  'jobs.db-wal',
  'uploads',
  'outputs',
  'temp',
  'logs',
  '__pycache__'
];

const rootFilePatterns = [
  /\.mp4$/i,
  /\.srt$/i,
  /\.pyc$/i,
  /\.pyo$/i
];

let output: vscode.OutputChannel;
let statusItems: vscode.StatusBarItem[] = [];

export function activate(context: vscode.ExtensionContext) {
  output = vscode.window.createOutputChannel('Pocket Helper');

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('pocketHelper.runOmniWorkflow', runWorkflow),
    vscode.commands.registerCommand('pocketHelper.moveOmniCache', () => runWithProgress('Moving cache/runtime files', moveCacheRuntimeFiles)),
    vscode.commands.registerCommand('pocketHelper.pullLatest', () => runWithProgress('Pulling latest code', pullLatest)),
    vscode.commands.registerCommand('pocketHelper.commitAndPush', () => runWithProgress('Committing and pushing changes', commitAndPush))
  );

  createStatusBar(context);
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('pocketHelper.showStatusBarButtons')) {
      createStatusBar(context);
    }
  }));
}

export function deactivate() {
  disposeStatusItems();
}

async function runWorkflow() {
  await runWithProgress('Running Omni helper workflow', async () => {
    await moveCacheRuntimeFiles();
    const action = await vscode.window.showQuickPick(
      [
        { label: 'Pull latest code from remote', action: pullLatest },
        { label: 'Commit current changes and push', action: commitAndPush },
        { label: 'Skip Git action', action: undefined }
      ],
      { placeHolder: 'Choose Git action' }
    );

    if (action?.action) {
      await action.action();
    }
  });
}

async function runWithProgress(title: string, task: () => Promise<void>) {
  output.show(true);
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
      },
      task
    );
    vscode.window.showInformationMessage(`${title}: done.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`[ERROR] ${message}`);
    vscode.window.showErrorMessage(`${title} failed: ${message}`);
  }
}

async function moveCacheRuntimeFiles() {
  const repoDir = getRepositoryPath();
  const parentDir = path.dirname(repoDir);
  const cacheRoot = path.resolve(parentDir, 'omni-reup-video-cache-backups');

  assertInside(cacheRoot, parentDir, 'Backup root is outside expected parent folder');
  await fs.mkdir(cacheRoot, { recursive: true });

  const stamp = getTimestamp();
  const backupDir = path.join(cacheRoot, stamp);
  await fs.mkdir(backupDir, { recursive: true });

  output.appendLine('');
  output.appendLine('========================================');
  output.appendLine('Omni Reup Video - Move Cache');
  output.appendLine('========================================');
  output.appendLine(`Repository: ${repoDir}`);
  output.appendLine(`Cache backup root: ${cacheRoot}`);

  let moved = 0;
  for (const name of cachePaths) {
    const src = path.join(repoDir, name);
    if (!(await exists(src))) {
      continue;
    }

    const full = path.resolve(src);
    assertInside(full, repoDir, 'Refusing to move outside repo');
    await moveToBackup(full, backupDir);
    output.appendLine(`[MOVED] ${name}`);
    moved++;
  }

  const entries = await fs.readdir(repoDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !rootFilePatterns.some((pattern) => pattern.test(entry.name))) {
      continue;
    }

    const full = path.resolve(repoDir, entry.name);
    assertInside(full, repoDir, 'Refusing to move outside repo');
    await moveToBackup(full, backupDir);
    output.appendLine(`[MOVED] ${entry.name}`);
    moved++;
  }

  for (const dir of ['uploads', 'outputs', 'temp', 'logs']) {
    const dirPath = path.join(repoDir, dir);
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(path.join(dirPath, '.gitkeep'), '');
  }

  if (moved === 0) {
    output.appendLine('[INFO] No cache/runtime files were found to move.');
  } else {
    output.appendLine(`[OK] Moved ${moved} item(s) to ${backupDir}`);
  }

  await logGitStatus(repoDir);
}

async function pullLatest() {
  const repoDir = getRepositoryPath();
  output.appendLine('');
  output.appendLine('Pulling latest code with autostash...');
  await ensureGitAvailable(repoDir);
  await runGit(repoDir, ['pull', '--ff-only', '--autostash']);
  await logGitStatus(repoDir);
}

async function commitAndPush() {
  const repoDir = getRepositoryPath();
  await ensureGitAvailable(repoDir);

  const commitMessage = await vscode.window.showInputBox({
    title: 'Commit message',
    prompt: 'Enter a commit message',
    value: 'update project'
  });

  if (commitMessage === undefined) {
    output.appendLine('[INFO] Commit cancelled.');
    return;
  }

  const message = commitMessage.trim() || 'update project';

  output.appendLine('');
  output.appendLine('Staging changes...');
  await runGit(repoDir, ['add', '-A']);

  const hasStagedChanges = await hasCachedDiff(repoDir);
  if (!hasStagedChanges) {
    output.appendLine('[INFO] Nothing staged to commit.');
    return;
  }

  await runGit(repoDir, ['commit', '-m', message]);

  output.appendLine('');
  output.appendLine('Rebasing on latest remote before push...');
  await runGit(repoDir, ['pull', '--rebase', '--autostash']);
  await runGit(repoDir, ['push']);
  await logGitStatus(repoDir);
}

async function hasCachedDiff(repoDir: string) {
  try {
    await execFile('git', ['diff', '--cached', '--quiet'], repoDir);
    return false;
  } catch (error) {
    if (isExitCode(error, 1)) {
      return true;
    }
    throw error;
  }
}

async function logGitStatus(repoDir: string) {
  const status = await runGit(repoDir, ['status', '--short']);
  output.appendLine('');
  output.appendLine('Git status:');
  output.appendLine(status.stdout.trim() || '(clean)');
}

async function ensureGitAvailable(repoDir: string) {
  await runGit(repoDir, ['--version']);
}

async function runGit(repoDir: string, args: string[]) {
  const command = `git ${args.join(' ')}`;
  output.appendLine(`> ${command}`);
  const result = await execFile('git', args, repoDir);
  appendProcessOutput(result);
  return result;
}

function execFile(command: string, args: string[], cwd: string) {
  return new Promise<GitResult>((resolve, reject) => {
    cp.execFile(command, args, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        appendProcessOutput({ stdout, stderr });
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function appendProcessOutput(result: GitResult) {
  if (result.stdout.trim()) {
    output.appendLine(result.stdout.trimEnd());
  }

  if (result.stderr.trim()) {
    output.appendLine(result.stderr.trimEnd());
  }
}

async function moveToBackup(src: string, backupDir: string) {
  const destination = await nextAvailablePath(path.join(backupDir, path.basename(src)));
  await fs.rename(src, destination);
}

async function nextAvailablePath(target: string) {
  if (!(await exists(target))) {
    return target;
  }

  const parsed = path.parse(target);
  let counter = 1;
  while (true) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
    if (!(await exists(candidate))) {
      return candidate;
    }
    counter++;
  }
}

function getRepositoryPath() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    throw new Error('Open the Omni Reup Video repository folder first.');
  }

  const activeFile = vscode.window.activeTextEditor?.document.uri;
  if (activeFile?.scheme === 'file') {
    const match = folders.find((folder) => isInsideOrEqual(activeFile.fsPath, folder.uri.fsPath));
    if (match) {
      return match.uri.fsPath;
    }
  }

  return folders[0].uri.fsPath;
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function assertInside(target: string, container: string, message: string) {
  if (!isInsideOrEqual(target, container)) {
    throw new Error(`${message}: ${target}`);
  }
}

function isInsideOrEqual(target: string, container: string) {
  const relative = path.relative(path.resolve(container), path.resolve(target));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function isExitCode(error: unknown, code: number) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === code;
}

function createStatusBar(context: vscode.ExtensionContext) {
  disposeStatusItems();

  const enabled = vscode.workspace
    .getConfiguration('pocketHelper')
    .get<boolean>('showStatusBarButtons', true);

  if (!enabled) {
    return;
  }

  statusItems = [
    makeStatusItem('$(tools) Omni Helper', 'pocketHelper.runOmniWorkflow', 100),
    makeStatusItem('$(archive) Move Cache', 'pocketHelper.moveOmniCache', 99),
    makeStatusItem('$(cloud-download) Pull', 'pocketHelper.pullLatest', 98),
    makeStatusItem('$(cloud-upload) Commit & Push', 'pocketHelper.commitAndPush', 97)
  ];

  for (const item of statusItems) {
    context.subscriptions.push(item);
    item.show();
  }
}

function makeStatusItem(text: string, command: string, priority: number) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
  item.text = text;
  item.command = command;
  item.tooltip = text.replace(/\$\([^)]+\)\s*/g, '');
  return item;
}

function disposeStatusItems() {
  for (const item of statusItems) {
    item.dispose();
  }
  statusItems = [];
}
