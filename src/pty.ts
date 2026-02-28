import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import * as os from 'os';
import type { ResolvedConfig } from './config';
import { createLineBufferedWriter } from './lineBuffer';

export const TERMINAL_NAME = 'Launchpad';

export class LaunchpadPty implements vscode.Pseudoterminal {
	private readonly writeEmitter = new vscode.EventEmitter<string>();
	private readonly closeEmitter = new vscode.EventEmitter<void | number>();
	readonly onDidWrite = this.writeEmitter.event;
	readonly onDidClose = this.closeEmitter.event;

	private children: childProcess.ChildProcess[] = [];
	private firstProcessStdin: NodeJS.WritableStream | null = null;

	constructor(
		private readonly config: ResolvedConfig,
		private readonly baseEnv: Record<string, string>,
		private readonly workspaceRoot: string
	) {}

	open(): void {
		for (const proc of this.config.processes) {
			const prefix = `[${proc.name}]`;

			this.writeEmitter.fire(`${prefix} starting: ${proc.command}\r\n`);

			const cwd = proc.cwd ?? this.workspaceRoot;
			// Force color output (many CLIs disable it when stdout isn't a TTY)
			const env = {
				...this.baseEnv,
				FORCE_COLOR: '1',
				TERM: 'xterm-256color',
				...proc.env,
			};
			// VS Code is an Electron app and sets ELECTRON_RUN_AS_NODE=1 in its environment.
			// Remove it so that any Electron apps spawned here run as Electron, not plain Node.js.
			delete (env as Record<string, string | undefined>)['ELECTRON_RUN_AS_NODE'];

			const child = childProcess.spawn(proc.command, [], {
				shell: true,
				cwd,
				env,
				windowsHide: true,
				// On Unix, use a new process group so we can kill shell + all children (e.g. conda, python) together
				...(os.platform() !== 'win32' ? { detached: true } : {}),
			});

			this.children.push(child);
			if (this.firstProcessStdin === null && child.stdin) {
				this.firstProcessStdin = child.stdin;
			}

			const fire = (s: string) => this.writeEmitter.fire(s);
			const stdoutWriter = createLineBufferedWriter(fire, prefix);
			const stderrWriter = createLineBufferedWriter(fire, prefix);

			child.stdout?.on('data', (data: Buffer | string) => stdoutWriter.write(data));
			child.stderr?.on('data', (data: Buffer | string) => stderrWriter.write(data));

			child.on('error', (err) => {
				this.writeEmitter.fire(`${prefix} error: ${err.message}\r\n`);
			});

			child.on('exit', (code, signal) => {
				stdoutWriter.flush();
				stderrWriter.flush();
				const how = signal ? `signal ${signal}` : `exit ${code ?? '?'}`;
				this.writeEmitter.fire(`${prefix} ended (${how})\r\n`);
			});
		}
	}

	handleInput(data: string): void {
		if (data === '\x03') {
			this.close();
			return;
		}
		if (this.firstProcessStdin?.writable) {
			this.firstProcessStdin.write(data);
		}
	}

	close(): void {
		for (const child of this.children) {
			try {
				this.killProcessTree(child);
			} catch {
				// ignore if already exited
			}
		}
		this.children = [];
		this.writeEmitter.fire(`[${TERMINAL_NAME}] All processes stopped.\r\n`);
		this.closeEmitter.fire();
	}

	/**
	 * Kill the process and its entire tree (e.g. shell -> conda -> python).
	 * Plain child.kill() only kills the shell, leaving Python/conda running.
	 */
	private killProcessTree(child: childProcess.ChildProcess): void {
		if (child.pid === undefined) {
			child.kill();
			return;
		}
		if (os.platform() === 'win32') {
			try {
				childProcess.execSync(`taskkill /T /F /PID ${child.pid}`, {
					stdio: 'ignore',
					windowsHide: true,
				});
			} catch {
				// Process or tree may already be gone
				child.kill();
			}
		} else {
			// Unix: we spawned with detached: true so the shell is the process group leader
			try {
				process.kill(-child.pid, 'SIGTERM');
			} catch {
				child.kill();
			}
		}
	}
}
