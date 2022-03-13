/*
 *  @file: src\fileheader\FileHeaderWatcher.ts
 *  @author: nuomifans
 *  @created: 2022-03-09 01:19:39
 *  @description: 插入文件头部信息。
 *  -----
 *  @last-modified: 2022-03-13 22:37:19
 *  @modified: by nuomifans
 *  -----
 *  @Copyright (c) 2022 nuomi.studio
 *  -----
 */

import {
    Disposable,
    WorkspaceConfiguration,
    workspace,
    TextDocumentWillSaveEvent,
    TextEditor,
    Selection,
    window,
    Position,
    TextDocument,
    commands,
    Range
} from "vscode";
import * as vscode from "vscode";
import * as fs from "fs";
import * as FileHeaderConst from "./FileHeaderConstants";
import { escapeRegExp, mapProperty } from "../helper";
import { IConfig, IInspectableConfig, ILangConfig, IMappableLanguage, ILangTemplateConfig, ITemplateConfigList, IVariable, IVariableList } from "./FileHeaderInterfaces";
import path = require("path");
import fullName = require("fullname");
import moment = require("moment");

interface ICommands {
    name: string;
    handler(...args: any[]): any;
}

var artTemplate = require("art-template");

artTemplate.defaults.imports.upper = function (value: string) {
    return value.toUpperCase();
};


artTemplate.defaults.imports.lower = function (value: string) {
    return value.toLowerCase();
};


artTemplate.defaults.imports.replace = function (value: string, searchValue: string, replaceValue: string) {
    if (replaceValue === undefined) {
        replaceValue = "";
    }
    return value.replace(new RegExp(escapeRegExp(searchValue), "g"), replaceValue);
};

artTemplate.defaults.imports.dateformat = function (value: string, format: string) {
    return moment(value).format(format);
};

export class FileHeaderWatcher {
    private disposable: Disposable;

    constructor() {
        const subscriptions: Disposable[] = [];
        workspace.onWillSaveTextDocument(this.onWillSave, this, subscriptions);
        window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, subscriptions);
        this.disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this.disposable.dispose();
    }

    public get registerCommands(): ICommands[] {
        return [
            {
                name: FileHeaderConst.FILE_HEADER_COMMAND,
                handler: this.insertFileHeader.bind(this),
            },
            {
                name: FileHeaderConst.CHANGE_LOG_INSERT_COMMAND,
                handler: this.insertChangeLog.bind(this),
            }
        ];
    }

    //#region 处理事件回调

    private onWillSave(e: TextDocumentWillSaveEvent): void {
        const activeTextEditor: TextEditor = window.activeTextEditor;
        const doc: TextDocument = e.document;
        if (doc && doc.isDirty) {
            const wsConfig: WorkspaceConfiguration = workspace.getConfiguration(FileHeaderConst.BASE_SETTINGS, doc.uri);
            if (this.docNeedsHeader(doc)) {
                if (!this.docNeedsAutoHeader(doc)) {
                    return;
                }
                this.insertFileHeader();
            }
            this.updateFileHeader();
        }

    }

    //自动加入文件头信息
    private onDidChangeActiveTextEditor(editor: TextEditor): void {
        if (editor && editor.document) {
            const doc = editor.document;
            if (this.fileIsNew(doc.fileName) && this.docNeedsHeader(doc) && this.docNeedsAutoHeader(doc)) {
                const $this = this;
                commands.executeCommand(FileHeaderConst.FILE_HEADER_COMMAND).then(() => {
                    doc.save();
                });
            }
        }
    }

    //#endregion

    /**
     * 插入文件头信息
     */
    private async insertFileHeader() {
        const editor: TextEditor = window.activeTextEditor;
        if (!editor) {
            window.showErrorMessage('nuomi-vscode requires an active document.');
            return;
        }

        if (!this.docNeedsHeader(editor.document)) {
            //window.showInformationMessage('nuomi-vscode: file header has exist.');
            return;
        }

        const wsConfig: WorkspaceConfiguration = workspace.getConfiguration(FileHeaderConst.BASE_SETTINGS, editor.document.uri);
        const config: IConfig = this.getConfig(wsConfig);
        const templateConfig: ILangTemplateConfig = this.getTemplateConfig(wsConfig, editor.document.languageId, editor.document.fileName);

        let authorName: string = config.hasOwnProperty("author") ? config.author : await this.getAuthorName();

        const headerComment: string = this.mergeTemplate(templateConfig);
        let ret = this.doArtTemplateRender(headerComment, authorName, editor, wsConfig, templateConfig, config);
        ret += "\n";

        editor.edit(function (editObj) {
            editObj.insert(new Position(0, 0), ret);
        });
        //editor.document.save();

        window.showInformationMessage('nuomi-vscode insert file header.');
    }

    /**
     * 更新文件头信息：最后修改者，修改时间
     */
    private async updateFileHeader() {
        const editor: TextEditor = window.activeTextEditor;
        if (!editor) {
            window.showErrorMessage('nuomi-vscode requires an active document.');
            return;
        }

        let doc: TextDocument = editor.document;
        if (!doc) {
            return;
        }

        if (this.docNeedsHeader(doc)) {
            return;
        }

        const wsConfig: WorkspaceConfiguration = workspace.getConfiguration(FileHeaderConst.BASE_SETTINGS, doc.uri);
        const config: IConfig = this.getConfig(wsConfig);
        const templateConfig: ILangTemplateConfig = this.getTemplateConfig(wsConfig, doc.languageId, doc.fileName);

        let authorName: string = config.hasOwnProperty("author") ? config.author : await this.getAuthorName();

        let findBegin: boolean = false;
        let beginLine: number = -1;
        let endLine: number = -1;
        let lastModifiedLine: number = -1;
        let modifiedByLine: number = -1;
        let start: number = 0;

        for (let i: number = 0; i < doc.lineCount; i++) {
            const lineText = doc.lineAt(i).text;
            if (lineText) {
                if (!findBegin) {
                    //先找到开始的标记
                    if (lineText === templateConfig.headerBegin) {
                        findBegin = true;
                        beginLine = i;
                    }
                } else {
                    if (lineText === templateConfig.headerEnd) {
                        endLine = i;
                        break;
                    }
                    if (lineText && lineText.indexOf("last-modified:") !== -1) {
                        lastModifiedLine = i;
                    }
                    if (lineText && lineText.indexOf("modified by:") !== -1) {
                        modifiedByLine = i;
                    }
                }
            }
        }

        editor.edit(editObj => {
            if (lastModifiedLine > -1) {
                start = editor.document.lineAt(lastModifiedLine).text.indexOf(":") + 1;
                editObj.replace(new Range(lastModifiedLine, start, lastModifiedLine, 100), " " + this.getDateTime());
            }
            if (modifiedByLine > -1) {
                start = editor.document.lineAt(modifiedByLine).text.indexOf(":") + 1;
                editObj.replace(new Range(modifiedByLine, start, modifiedByLine, 100), " " + authorName);
            }
            if (vscode.version < "1.43.0") {
                editor.document.save();
            }
        });
    }

    /**
     * 插入修改日志
     */
    private async insertChangeLog() {
        const editor: TextEditor = window.activeTextEditor;
        if (!editor) {
            window.showErrorMessage('nuomi-vscode requires an active document.');
            return;
        }

        let doc: TextDocument = editor.document;
        if (!doc) {
            return;
        }

        if (this.docNeedsHeader(doc)) {
            await this.insertFileHeader();
        }

        let findBegin: boolean = false;
        let beginLine: number = -1;
        let endLine: number = -1;
        let changLogLine: number = -1;

        const wsConfig: WorkspaceConfiguration = workspace.getConfiguration(FileHeaderConst.BASE_SETTINGS, doc.uri);
        const config: IConfig = this.getConfig(wsConfig);
        const templateConfig: ILangTemplateConfig = this.getTemplateConfig(wsConfig, doc.languageId, doc.fileName);

        let authorName: string = config.hasOwnProperty("author") ? config.author : await this.getAuthorName();

        for (let i: number = 0; i < doc.lineCount; i++) {
            const lineText = doc.lineAt(i).text;
            if (lineText) {
                if (!findBegin) {
                    //先找到开始的标记
                    if (lineText === templateConfig.headerBegin) {
                        findBegin = true;
                        beginLine = i;
                    }
                } else {
                    if (lineText === templateConfig.headerEnd) {
                        endLine = i;
                        break;
                    }
                    if (lineText && lineText.indexOf(FileHeaderConst.CHANGE_LOG_CAPTION) !== -1) {
                        changLogLine = i;
                    }
                }
            }
        }

        if (endLine > 0) {
            let templates: Array<string> = [];
            if (changLogLine === -1) {
                templates.push("{{headerPrefix}} " + FileHeaderConst.CHANGE_LOG_CAPTION);
                for (let i: number = 0; i < FileHeaderConst.CHANGE_LOG_TEMPLATE.length; i++) {
                    templates.push("{{headerPrefix}} " + FileHeaderConst.CHANGE_LOG_TEMPLATE[i]);
                }
            }
            templates.push("{{headerPrefix}} {{lastModifiedDate}}  {{author}}    ");
            let logText: string = templates.join("\n");
            let ret = this.doArtTemplateRender(logText, authorName, editor, wsConfig, templateConfig, config);
            ret = "\n" + ret;

            const insertRow: number = endLine - 1;
            const insertCol: number = editor.document.lineAt(insertRow).text.length;
            const pos = new Position(insertRow, insertCol);
            editor.selection = new Selection(pos, pos);
            editor.edit(function (edit) {
                edit.insert(editor.selection.active, ret);
            });
        }
    }

    private doArtTemplateRender(text: string, authorName: string, editor: TextEditor, wsConfig: WorkspaceConfiguration, templateConfig: ILangTemplateConfig, config: IConfig): string {
        let ret = artTemplate.render(text, Object.assign(
            {
                author: authorName,
                company: config.company || "Your Company",
                description: "??",
                createdDate: this.getFileBirthDateTime(editor),
                lastModifiedDate: this.getDateTime(),
                headerBegin: templateConfig.headerBegin,
                headerPrefix: templateConfig.headerPrefix,
                headerEnd: templateConfig.headerEnd,
            },
            this.getMergedVariables(wsConfig),
            this.getPredefinedVariables(editor),
        ));
        return ret;
    }

    //#region 配置相关

    /**
     * 如果是3秒内创建的文件，则认为是新文件
     */
    private fileIsNew(filename): boolean {
        const fCreated: Date = this.getFileCreationDate(filename);
        return fCreated && !moment(fCreated).isBefore(moment().subtract(3, 's'));
    }

    /**
     * 判断需不需要加文件头信息
     */
    private docNeedsHeader(doc: TextDocument) {
        let ignore = this.docIsIgnore(doc);
        if (ignore) {
            return false;
        }
        let result: boolean = doc.lineCount <= 1;
        if (!result) {
            result = true;
            const wsConfig: WorkspaceConfiguration = workspace.getConfiguration(FileHeaderConst.BASE_SETTINGS, doc.uri);
            const templateConfig: ILangTemplateConfig = this.getTemplateConfig(wsConfig, doc.languageId, doc.fileName);

            let findBegin: boolean = false;
            let beginLine: number = -1;
            let endLine: number = -1;
            for (let i: number = 0; i < doc.lineCount; i++) {
                const lineText: string = doc.lineAt(i).text;
                if (lineText) {
                    if (!findBegin) {
                        if (lineText === templateConfig.headerBegin) {
                            findBegin = true;
                            beginLine = i;
                        }
                    } else {
                        if (lineText === templateConfig.headerEnd) {
                            endLine = i;
                            break;
                        }
                        if (lineText.indexOf("file") !== -1) {
                            result = false;
                            break;
                        }
                        if (lineText.indexOf("author") !== -1) {
                            result = false;
                            break;
                        }
                        if (lineText.indexOf("created") !== -1) {
                            result = false;
                            break;
                        }
                        if (lineText.indexOf("last-modified") !== -1) {
                            result = false;
                            break;
                        }
                        if (lineText.indexOf("Copyright") !== -1) {
                            result = false;
                            break;
                        }
                        if (lineText.indexOf(FileHeaderConst.CHANGE_LOG_CAPTION) !== -1) {
                            result = false;
                            break;
                        }
                    }
                }
            }
        }
        return result;
    }

    /**
     * 是否开启自动插入文件头信息
     */
    private docNeedsAutoHeader(doc: TextDocument) {
        const wsConfig: WorkspaceConfiguration = workspace.getConfiguration(FileHeaderConst.BASE_SETTINGS, doc.uri);
        const config: IConfig = this.getConfig(wsConfig);
        return config.autoHeader;
    }

    /**
     * 是否忽略的文件
     */
    private docIsIgnore(doc: TextDocument) {
        const wsConfig: WorkspaceConfiguration = workspace.getConfiguration(FileHeaderConst.BASE_SETTINGS, doc.uri);
        const config: IConfig = this.getConfig(wsConfig);
        let pathObj = path.parse(doc.fileName);
        if (config.ignore) {
            for (let ige of config.ignore) {
                let reg: RegExp = new RegExp(ige.replace(".", "\\.").replace("*", ".*"));
                if (reg.test(pathObj.base) || reg.test(path.join(pathObj.dir, pathObj.base))) {
                    return true;
                }
            }
        }
        return false;
    }

    private async getAuthorName(): Promise<string> {
        let authorFullName: string;
        try {
            authorFullName = await fullName();
        } catch (error) {
            authorFullName = undefined;
        }
        return authorFullName;
    }

    private getDateTime(): string {
        return moment().format(FileHeaderConst.DEFAULT_DATEFORMAT);
    }

    private getFileBirthDateTime(editor: TextEditor): string {
        let fileStat: any = fs.statSync(editor.document.fileName);
        let birthTime: string = fileStat.birthtime;
        if (birthTime.toString().startsWith("1970")) {
            birthTime = fileStat.ctime; // When birthtime is not available
        }

        return moment(birthTime).format(FileHeaderConst.DEFAULT_DATEFORMAT);
    }

    private getFileCreationDate(filename: string): Date {
        let result: Date = null;
        try {
            if (fs.existsSync(filename)) {
                const stat: fs.Stats = fs.statSync(filename);
                if (stat && stat.birthtime) {
                    result = new Date(stat.birthtime.valueOf());
                }
            }
        } catch (error) {
            result = null;
        }
        return result;
    }

    private getPredefinedVariables(editor: TextEditor): any {
        let pathObj = path.parse(editor.document.fileName);
        const now: Date = new Date();
        return {
            "workspaceFolder": this.getProjectRootPath(editor),
            "workspaceFolderBasename": workspace.name,
            "file": editor.document.fileName,
            "relativeFile": this.getRelativeFilePath(editor),
            "fileBasename": pathObj.base,
            "fileBasenameNoExtension": pathObj.name,
            "fileDirname": pathObj.dir,
            "fileExtname": pathObj.ext,
            "pathSeparator": path.sep,
            "date": new Date(),
            "year": now.getFullYear().toString(),
        };
    }

    private getProjectRootPath(editor: TextEditor, rootDirFileName?: string): string {
        let found: boolean = false;
        const parsed = path.parse(editor.document.fileName);
        const dir: string = parsed ? parsed.dir : '';
        let result: string = dir;
        rootDirFileName = rootDirFileName || 'package.json';
        while (result.includes(path.sep)) {
            if (fs.existsSync(path.join(result, rootDirFileName)) || fs.existsSync(path.join(result, 'package.json'))) {
                found = true;
                break;
            } else {
                result = result.substring(0, result.lastIndexOf(path.sep));
            }
        }
        if (!found) {
            const rootFolder = workspace.getWorkspaceFolder(editor.document.uri);
            result = rootFolder.uri.fsPath;
        }
        return result;
    }

    private getRelativeFilePath(editor: TextEditor, rootDirFileName?: string): string {
        try {
            const rootPath: string = this.getProjectRootPath(editor, rootDirFileName);
            let fullpath = editor.document.fileName;
            return fullpath.substring(rootPath.length + 1);
        } catch (error) {
            return null;
        }
    }

    private getConfig(wsConfig: WorkspaceConfiguration): IConfig {
        let cfg: IConfig = wsConfig && wsConfig.has(FileHeaderConst.CONFIG_SETTING) ? wsConfig.get<IConfig>(FileHeaderConst.CONFIG_SETTING) : { autoHeader: true };
        if (!cfg.hasOwnProperty("autoHeader")) {
            cfg.autoHeader = true;
        }
        return cfg;
    }

    private getMergedVariables(wsConfig: WorkspaceConfiguration): any {
        const cfg: IInspectableConfig<IVariableList> = wsConfig.inspect(FileHeaderConst.VARIABLES_SETTINGS);
        let variables: IVariableList = cfg ? this.mergeVariableLists(cfg.defaultValue || [], cfg.globalValue || [], cfg.workspaceValue || [], cfg.workspaceFolderValue || []) : [];
        let ret = {};
        for (let v of variables) {
            ret[v[0]] = v[1];
        }
        return ret;
    }

    private mergeVariableLists(...lists: IVariableList[]): IVariableList {
        let merged: IVariableList = [];
        for (let list of lists) {
            list.forEach((newVariable: IVariable) => {
                const idx: number = merged.findIndex((mergedVariable: IVariable) => {
                    return mergedVariable[0] === newVariable[0];
                });
                if (idx === -1) {
                    merged.push(newVariable);
                } else {
                    merged.splice(idx, 1, newVariable);
                }
            });
        }
        return merged;
    }

    private getTemplateConfig(wsConfig: WorkspaceConfiguration, langId: string, filename: string): ILangTemplateConfig {
        const templates: ITemplateConfigList = this.getMergedTemplates(wsConfig);
        let def: ILangTemplateConfig = this.getMappableRecord<ILangTemplateConfig>(templates, langId, filename);
        const langConfig: ILangConfig = this.getDefaultLangConfig(langId);
        if (!def || !def.template) {
            def = templates.find(item => item.language === FileHeaderConst.DEFAULT_LANGUAGE);
            if (!def || !def.template) {
                def = {
                    language: langConfig.language,
                    headerBegin: langConfig.headerBegin,
                    headerPrefix: langConfig.headerPrefix,
                    headerEnd: langConfig.headerEnd,
                    template: FileHeaderConst.DEFAULT_TEMPLATE
                };
            }
        }
        if (!def.hasOwnProperty('headerBegin')) {
            def.headerBegin = langConfig.headerBegin;
        }
        if (!def.hasOwnProperty('headerPrefix')) {
            def.headerPrefix = langConfig.headerPrefix;
        }
        if (!def.hasOwnProperty('headerEnd')) {
            def.headerEnd = langConfig.headerEnd;
        }
        return def;
    }

    private getMergedTemplates(wsConfig: WorkspaceConfiguration): ITemplateConfigList {
        const cfg: IInspectableConfig<ITemplateConfigList> = wsConfig.inspect(FileHeaderConst.TEMPLATE_SETTINGS);
        return cfg ? this.mergeTemplateLists(cfg.defaultValue || [], cfg.globalValue || [], cfg.workspaceValue || [], cfg.workspaceFolderValue || []) : [];
    }

    private mergeTemplateLists(...lists: ITemplateConfigList[]): ITemplateConfigList {
        let merged: ITemplateConfigList = [];
        for (let list of lists) {
            list.forEach((newTemplate: ILangTemplateConfig) => {
                const idx: number = merged.findIndex((mergedTemplate: ILangTemplateConfig) => {
                    return mergedTemplate.language === newTemplate.language;
                });
                if (idx === -1) {
                    merged.push(newTemplate);
                } else {
                    merged.splice(idx, 1, newTemplate);
                }
            });
        }
        return merged;
    }

    private mergeTemplate(languageCfg: ILangTemplateConfig): string {
        let templates: Array<string> = [];
        templates.push("{{headerBegin}}");
        if (languageCfg.template) {
            for (let i: number = 0; i < languageCfg.template.length; i++) {
                templates.push("{{headerPrefix}} " + languageCfg.template[i]);
            }
        } else {
            templates.push("{{headerPrefix}}");
        }
        templates.push("{{headerEnd}}");
        return templates.join("\n");
    }

    private getMappableRecord<T extends IMappableLanguage>(list: Array<T>, langId: string, filename: string): T {
        let def: T;
        const fileExt: string = !!filename ? path.extname(filename) : '';
        if (fileExt && fileExt.length > 0) {
            def = list.find(item => item.language.toLowerCase() === fileExt.toLowerCase());
        }
        if (!def) {
            def = list.find(item => item.language.toLowerCase() === langId.toLowerCase());
        }
        if (def && def.hasOwnProperty('mapTo')) {
            def = list.find(item => item.language.toLowerCase() === def.mapTo.toLowerCase());
        }
        if (!def) {
            def = list.find(item => item.language === FileHeaderConst.DEFAULT_LANGUAGE);
        }
        return def;
    }

    private getDefaultLangConfig(langId: string) {
        let config: ILangConfig = { language: '*', headerBegin: '/*', headerPrefix: ' * ', headerEnd: ' */' };
        switch (langId) {
            case "swift":
                this.mapLangConfig({ headerBegin: '/**' }, config);
                break;
            case "lua":
                this.mapLangConfig({ headerBegin: '--[[', headerPrefix: '--', headerEnd: '--]]' }, config);
                break;
            case "perl":
            case "ruby":
                this.mapLangConfig({ headerBegin: '#', headerPrefix: '#', headerEnd: '#' }, config);
                break;
            case "vb":
                this.mapLangConfig({ headerBegin: "'", headerPrefix: "'", headerEnd: "'" }, config);
                break;
            case 'clojure':
                this.mapLangConfig({ headerBegin: ';;', headerPrefix: ';', headerEnd: ';;' }, config);
                break;
            case 'python':
                this.mapLangConfig({ headerBegin: "'''", headerPrefix: '', headerEnd: "'''" }, config);
                break;
            case "xml":
            case "html":
                this.mapLangConfig({ headerBegin: '<!--', headerPrefix: '', headerEnd: '-->' }, config);
                break;
            case "matlab":
                this.mapLangConfig({ headerBegin: '%{', headerPrefix: '%', headerEnd: '%}' }, config);
        }
        return config;
    }

    private mapLangConfig(source: Object, target: ILangConfig) {
        if (source) {
            mapProperty(source, target, "language");
            mapProperty(source, target, "mapTo");
            mapProperty(source, target, "headerBegin");
            mapProperty(source, target, "headerPrefix");
            mapProperty(source, target, "headerEnd");
        }
    }

    //#endregion 配置相关
}