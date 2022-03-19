/*
 *  @file: src\fileheader\FileHeaderConstants.ts
 *  @author: nuomifans
 *  @created: 2022-03-09 01:13:19
 *  @description: 定义一些常量
 *  -----
 *  @last-modified: 2022-03-19 09:32:47
 *  @modified: by nuomifans
 *  -----
 *  @Copyright (c) 2022 nuomi.studio
 *  -----
 */

export const BASE_SETTINGS: string = 'nuomi-vscode';

export const FILE_HEADER_COMMAND = BASE_SETTINGS + '.insertFileHeader';
export const CHANGE_LOG_INSERT_COMMAND = BASE_SETTINGS + '.insertChangeLog';
export const FILE_BODY_INSERT_COMMAND = BASE_SETTINGS + '.insertFileBody';

export const CONFIG_SETTING: string = "config";
export const VARIABLES_SETTINGS: string = "variables";
export const TEMPLATE_SETTINGS: string = 'templates';

export const DEFAULT_LANGUAGE: string = '*';
export const DEFAULT_DATEFORMAT = "YYYY-MM-DD HH:mm:ss";
export const DEFAULT_TEMPLATE: Array<string> = [
    "@file: {{relativeFile}}",
    "@author: {{author}}",
    "@created: {{createdDate}}",
    "@description: {{description}}",
    "-----",
    "@last-modified: {{lastModifiedDate}}",
    "@modified: by {{author}}",
    "-----",
    "@Copyright (c) {{year}} {{company}}",
    "-----",
];

export const CHANGE_LOG_CAPTION: string = "HISTORY:";
export const CHANGE_LOG_TEMPLATE: Array<string> = [
    "Date                 By           Comments",
    "----------           ---          ----------",
];

