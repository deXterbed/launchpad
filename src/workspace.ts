import * as vscode from 'vscode';
import { getConfigPath } from './config';

export function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		vscode.window.showErrorMessage('Launchpad: Open a folder first.');
		return undefined;
	}
	if (folders.length > 1) {
		const withConfig = folders.find((f) => getConfigPath(f));
		return withConfig ?? folders[0];
	}
	return folders[0];
}

export async function createSampleProcfile(folder: vscode.WorkspaceFolder): Promise<void> {
	const path = vscode.Uri.joinPath(folder.uri, 'Procfile');
	const content = `# Procfile - one process per line (name: command)
# Example:
# web: npm run dev
# api: npm run start:api
# worker: npm run worker
web: echo "Replace with your start command"
`;
	await vscode.workspace.fs.writeFile(path, Buffer.from(content, 'utf8'));
	await vscode.window.showTextDocument(path);
	vscode.window.showInformationMessage('Edit Procfile and run Launchpad: Start All again.');
}

export async function createSampleLaunchpadJson(folder: vscode.WorkspaceFolder): Promise<void> {
	const path = vscode.Uri.joinPath(folder.uri, 'launchpad.json');
	const content = `{
  "processes": [
    { "name": "web", "command": "npm run dev" },
    { "name": "api", "command": "npm run start:api", "cwd": "./apps/api" }
  ]
}
`;
	await vscode.workspace.fs.writeFile(path, Buffer.from(content, 'utf8'));
	await vscode.window.showTextDocument(path);
	vscode.window.showInformationMessage('Edit launchpad.json and run Launchpad: Start All again.');
}
