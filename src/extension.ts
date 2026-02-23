import * as vscode from 'vscode';
import { loadConfig } from './config';
import { LaunchpadRunner } from './runner';
import {
	getWorkspaceFolder,
	createSampleProcfile,
	createSampleLaunchpadJson,
} from './workspace';

let runner: LaunchpadRunner;

export function activate(context: vscode.ExtensionContext) {
	console.log('[Launchpad] extension activated');
	runner = new LaunchpadRunner();

	function setStatusBarToStart(): void {
		statusBarItem.text = '$(play) Launchpad';
		statusBarItem.tooltip = 'Start all processes (Procfile / launchpad.json)';
		statusBarItem.command = 'launchpad.startAll';
	}
	function setStatusBarToStop(): void {
		statusBarItem.text = '$(debug-stop) Launchpad';
		statusBarItem.tooltip = 'Stop all Launchpad processes';
		statusBarItem.command = 'launchpad.stopAll';
	}

	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100
	);
	setStatusBarToStart();
	statusBarItem.show();
	runner.setOnStopped(setStatusBarToStart);
	context.subscriptions.push(statusBarItem);

	const startAll = vscode.commands.registerCommand('launchpad.startAll', async () => {
		const folder = getWorkspaceFolder();
		if (!folder) {
			return;
		}

		try {
			const config = await loadConfig(folder);
			if (!config) {
				const create = await vscode.window.showWarningMessage(
					'No Procfile or launchpad.json found in the workspace root. Create a sample?',
					'Create Procfile',
					'Create launchpad.json',
					'Cancel'
				);
				if (create === 'Create Procfile') {
					await createSampleProcfile(folder);
				}
				if (create === 'Create launchpad.json') {
					await createSampleLaunchpadJson(folder);
				}
				return;
			}
			await runner.startAll(config);
			setStatusBarToStop();
		} catch (e) {
			vscode.window.showErrorMessage(
				`Launchpad: ${e instanceof Error ? e.message : String(e)}`
			);
		}
	});

	const stopAll = vscode.commands.registerCommand('launchpad.stopAll', () => {
		runner.stopAll();
		setStatusBarToStart();
	});

	context.subscriptions.push(startAll, stopAll);
}

export function deactivate() {
	runner?.stopAll();
}
