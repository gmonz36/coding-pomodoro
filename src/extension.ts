// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import PomodoroManager from "./pomodoro";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration("pomodoro");
	const pomodoroManager = new PomodoroManager(config.workTime, config.pauseTime);

	// list of commands
	const startDisposable = vscode.commands.registerCommand("extension.startPomodoro", () => {
		pomodoroManager.start();
	});

	const stopDisposable = vscode.commands.registerCommand("extension.pausePomodoro", () => {
		pomodoroManager.pause();
	});

	const resetDisposable = vscode.commands.registerCommand("extension.resetPomodoro", () => {
		pomodoroManager.reset();
	});

	// Add to a list of disposables which are disposed when this extension is deactivated.
	context.subscriptions.push(pomodoroManager, startDisposable, stopDisposable, resetDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
