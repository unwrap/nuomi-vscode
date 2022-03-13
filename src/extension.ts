/*
 *  @file: src\extension.ts
 *  @author: nuomifans
 *  @created: 2022-03-09 01:19:51
 *  @description: nuomi-vscode
 *  -----
 *  @last-modified: 2022-03-13 22:35:23
 *  @modified: by nuomifans
 *  -----
 *  @Copyright (c) 2022 nuomi.studio
 *  -----
 */

import * as vscode from 'vscode';
import { FileHeaderWatcher } from './fileheader/FileHeaderWatcher';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "nuomi-vscode" is now active!');

	const watcher: FileHeaderWatcher = new FileHeaderWatcher();
	watcher.registerCommands.forEach((command) => {
		context.subscriptions.push(vscode.commands.registerCommand(command.name, command.handler));
	});
	context.subscriptions.push(watcher);

}

export function deactivate() { }