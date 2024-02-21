// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as gsp from './gostackparser';
import { GostmortemDataGridPanel } from './gostmortem';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('gostmortem-table.analyze', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		var editor = vscode.window.activeTextEditor;
		if (editor) {

			var text = editor.document.getText();
			var results = gsp.parse(text);
			if (Object.keys(results[1]).length !== 0) {
				vscode.window.showInformationMessage('Not a valid go stack');
				return;
			}

			if (results[0]) {
				GostmortemDataGridPanel.render(context.extensionUri,results[0]);
			}

		} else {
			vscode.window.showInformationMessage('No file open');
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}


