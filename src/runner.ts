import * as vscode from 'vscode';
import type { ResolvedConfig } from './config';
import { LaunchpadPty, TERMINAL_NAME } from './pty';

export class LaunchpadRunner {
	private terminal: vscode.Terminal | null = null;
	private pty: LaunchpadPty | null = null;
	private processCount = 0;
	private onStopped: (() => void) | null = null;

	/** Called when all processes stop (via Stop All or closing the terminal). */
	setOnStopped(cb: (() => void) | null): void {
		this.onStopped = cb;
	}

	async startAll(config: ResolvedConfig): Promise<void> {
		this.stopAll();

		const workspaceRoot = config.processes[0]?.cwd ?? process.cwd();
		const baseEnv = { ...process.env } as Record<string, string>;

		this.pty = new LaunchpadPty(config, baseEnv, workspaceRoot);
		this.terminal = vscode.window.createTerminal({
			name: TERMINAL_NAME,
			pty: this.pty,
		});
		const closeSub = vscode.window.onDidCloseTerminal((t) => {
			if (t === this.terminal) {
				this.terminal = null;
				this.pty = null;
				this.processCount = 0;
				closeSub.dispose();
				this.onStopped?.();
			}
		});
		this.terminal.show(true);
		this.processCount = config.processes.length;

		const count = config.processes.length;
		vscode.window.showInformationMessage(
			`Launchpad started ${count} process${count === 1 ? '' : 'es'} from ${config.source}`,
			{ modal: false }
		);
	}

	stopAll(): void {
		if (this.terminal) {
			this.terminal.dispose();
		}
		this.terminal = null;
		this.pty = null;
		this.processCount = 0;
		this.onStopped?.();
		vscode.window.showInformationMessage('Launchpad stopped all processes.');
	}

	getRunningCount(): number {
		return this.processCount;
	}
}
