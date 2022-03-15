/*
 *  @file: src\fileheader\FileHeaderInterfaces.ts
 *  @author: nuomifans
 *  @created: 2022-03-12 09:43:34
 *  @description: 配置的数据结构
 *  -----
 *  @last-modified: 2022-03-13 22:36:04
 *  @modified: by nuomifans
 *  -----
 *  @Copyright (c) 2022 nuomi.studio
 *  -----
 */

export interface IInspectableConfig<T extends any> {
    key: string;
    defaultValue?: T;
    globalValue?: T;
    workspaceValue?: T;
    workspaceFolderValue?: T;
}

export interface IConfig {
    autoHeader?: boolean,
    author?: string;
    authorEmail?: string;
    dateformat?: string;
    company?: string;
    ignore?: Array<string>;
}

export type IVariable = [string, string];

export type IVariableList = Array<IVariable>;

export interface IMappableLanguage {
    language: string;
    mapTo?: string;
}

export interface ILangConfig extends IMappableLanguage {
    headerBegin?: string;
    headerPrefix?: string;
    headerEnd?: string;
}

export interface ILangTemplateConfig extends ILangConfig {
    template?: Array<string>;
    body?: Array<string>;
}

export type ITemplateConfigList = Array<ILangTemplateConfig>;