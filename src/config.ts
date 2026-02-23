import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ProcessDef {
	name: string;
	command: string;
	cwd?: string;
	env?: Record<string, string>;
}

export type ConfigSource = 'launchpad.json' | 'Procfile';

export interface ResolvedConfig {
	processes: ProcessDef[];
	source: ConfigSource;
	configPath: string;
}

const PROCFILE = 'Procfile';
const LAUNCHPAD_JSON = 'launchpad.json';

/**
 * Procfile line: optional comment, then "name: command"
 * Supports continuation with backslash (optional for v1 we can keep it simple).
 */
function parseProcfile(content: string, baseDir: string): ProcessDef[] {
	const processes: ProcessDef[] = [];
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const colonIndex = trimmed.indexOf(':');
		if (colonIndex <= 0) {
			continue;
		}
		const name = trimmed.slice(0, colonIndex).trim();
		const command = trimmed.slice(colonIndex + 1).trim();
		if (name && command) {
			processes.push({ name, command, cwd: baseDir });
		}
	}
	return processes;
}

function parseLaunchpadJson(content: string, configDir: string): ProcessDef[] {
	const data = JSON.parse(content) as { processes?: Array<{ name: string; command: string; cwd?: string; env?: Record<string, string> }> };
	const list = data?.processes;
	if (!Array.isArray(list) || list.length === 0) {
		throw new Error('launchpad.json must have a non-empty "processes" array');
	}
	return list.map((p) => ({
		name: p.name,
		command: p.command,
		cwd: p.cwd ? path.resolve(configDir, p.cwd) : configDir,
		env: p.env,
	}));
}

function readFileSafe(uri: vscode.Uri): string | null {
	try {
		return fs.readFileSync(uri.fsPath, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Find and load config from workspace. Prefers launchpad.json over Procfile.
 */
export async function loadConfig(workspaceFolder: vscode.WorkspaceFolder): Promise<ResolvedConfig | null> {
	const root = workspaceFolder.uri.fsPath;
	const launchpadPath = path.join(root, LAUNCHPAD_JSON);
	const procfilePath = path.join(root, PROCFILE);

	if (fs.existsSync(launchpadPath)) {
		const content = readFileSafe(vscode.Uri.file(launchpadPath));
		if (content !== null) {
			try {
				const processes = parseLaunchpadJson(content, root);
				return { processes, source: 'launchpad.json', configPath: launchpadPath };
			} catch (e) {
				throw new Error(`Invalid ${LAUNCHPAD_JSON}: ${e instanceof Error ? e.message : String(e)}`);
			}
		}
	}

	if (fs.existsSync(procfilePath)) {
		const content = readFileSafe(vscode.Uri.file(procfilePath));
		if (content !== null) {
			const processes = parseProcfile(content, root);
			if (processes.length > 0) {
				return { processes, source: PROCFILE, configPath: procfilePath };
			}
		}
	}

	return null;
}

export function getConfigPath(workspaceFolder: vscode.WorkspaceFolder): string | null {
	const root = workspaceFolder.uri.fsPath;
	if (fs.existsSync(path.join(root, LAUNCHPAD_JSON))) {
		return path.join(root, LAUNCHPAD_JSON);
	}
	if (fs.existsSync(path.join(root, PROCFILE))) {
		return path.join(root, PROCFILE);
	}
	return null;
}
