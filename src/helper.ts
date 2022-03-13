/*
 *  @file: src\helper.ts
 *  @author: nuomifans
 *  @created: 2022-03-11 00:39:20
 *  @description: 公用的方法
 *  -----
 *  @last-modified: 2022-03-13 22:34:55
 *  @modified: by nuomifans
 *  -----
 *  @Copyright (c) 2022 nuomi.studio
 *  -----
 */

/**
 * 转义特殊字符
 */
export function escapeRegExp(value: string): string {
    return value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function trimStart(s: string) {
    const r = /^\s+/;
    return s.replace(r, '');
}

export function mapProperty(source: Object, target: Object, key: string) {
    if (source.hasOwnProperty(key)) {
        target[key] = source[key];
    }
}